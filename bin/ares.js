#!/usr/bin/env node

/*
 * Copyright (c) 2020 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const nopt = require('nopt'),
    async = require('async'),
    path = require('path'),
    fs = require('fs'),
    log = require('npmlog'),
    commonTools = require('./../lib/base/common-tools'),
    Table = require('easy-table');

const cliControl = commonTools.cliControl,
    version = commonTools.version,
    help = commonTools.help,
    appdata = commonTools.appdata,
    errHndl = commonTools.errMsg,
    finish = errHndl.finish;

const processName = path.basename(process.argv[1]).replace(/.js/, '');

process.on('uncaughtException', function(err) {
    log.error('uncaughtException', err.toString());
    log.verbose('uncaughtException', err.stack);
    cliControl.end(-1);
});

if (process.argv.length === 2) {
    process.argv.splice(2, 0, '--help');
}

const knownOpts = {
    "help" : Boolean,
    "list" : Boolean,
    "version":  Boolean,
    "level":    ['silly', 'verbose', 'info', 'http', 'warn', 'error']
};

const shortHands = {
    "h" : ["--help"],
    "l" : ["--list"],
    "V": ["--version"],
    "v": ["--level", "verbose"]
};
const argv = nopt(knownOpts, shortHands, process.argv, 2);

log.heading = processName;
log.level = argv.level || 'warn';
log.verbose("argv", argv);

let op;
if (argv.list) {
    op = commandList;
} else if (argv.version) {
    version.showVersionAndExit();
} else if(argv.help) {
    showUsage();
    cliControl.end();
} else {
    op = display;
}

if (op) {
    version.checkNodeVersion(function() {
        async.series([
            op.bind(this)
        ],finish);
    });
}

function commandList (next) {
    let commandsList;
    const table = new Table();
    const profile = appdata.getConfig(true).profile;
    try {
        commandsList = JSON.parse(fs.readFileSync(path.join(__dirname, '../', 'files', 'conf', 'ares.json')));
        Object.keys(commandsList).forEach(function(cmd){
            if(commandsList[cmd].profile && commandsList[cmd].profile.indexOf(profile) === -1){
                return;
            } else if(!fs.existsSync(path.join(__dirname, cmd + '.js'))){
                return;
            }
            table.cell('CMD', cmd);
            table.cell('Description', commandsList[cmd].description);
            table.newRow();
        });
        console.log(table.print());
        next();
    } catch (e){
        next(errHndl.getErrMsg("INVALID_JSON_FORMAT"));
    }
}

function display (next) {
    let commandsList;
    let found = false;
    try{
        commandsList = JSON.parse(fs.readFileSync(path.join(__dirname, '../', 'files', 'conf', 'ares.json')));
        for(const arg in argv){
            if(Object.hasOwnProperty.call(commandsList, 'ares-'+ arg) && fs.existsSync(path.join(__dirname, 'ares-'+ arg + '.js'))){
                help.display('ares-'+arg, appdata.getConfig(true).profile);
                found = true;
            }
        }

        if(found === false) {
            next(errHndl.getErrMsg("INVALID_COMMAND"));
        } else {
            next();
        }
        
    } catch(e){
        next(errHndl.getErrMsg("INVALID_JSON_FORMAT"));
    }
}

function showUsage () {
    help.display(processName, appdata.getConfig(true).profile);
}
