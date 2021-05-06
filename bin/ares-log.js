#!/usr/bin/env node

/*
 * Copyright (c) 2021 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const path = require('path'),
    log = require('npmlog'),
    nopt = require('nopt'),
    async = require('async'),
    logLib = require('./../lib/log'),
    commonTools = require('./../lib/base/common-tools');

const version = commonTools.version,
    cliControl = commonTools.cliControl,
    help = commonTools.help,
    appdata = commonTools.appdata,
    setupDevice = commonTools.setupDevice,
    errHndl = commonTools.errMsg;

const processName = path.basename(process.argv[1]).replace(/.js/, '');

process.on('uncaughtException', function (err) {
    log.error('uncaughtException', err.toString());
    log.verbose('uncaughtException', err.stack);
    cliControl.end(-1);
});

if (process.argv.length === 2) {
    process.argv.splice(2, 0, '--help');
}

const knownOpts = {
    "help":     Boolean,
    "version":  Boolean,
    "level":    ['silly', 'verbose', 'info', 'http', 'warn', 'error'],
    "device":   [String, null],
    "device-list":  Boolean,
    // command options
    "switch-daemon":   String,
    "current-daemon":   Boolean,
    // show options
    "lines":    Number,
    "reverse":  Boolean,
    "follow":   Boolean,
    // filter options
    "since":    String,
    "until":    String,
    "priority": String,
    "kernel":   Boolean,
    "boot":     Boolean,
    "pid":      Number,
    // output option
    "output":   Boolean,
    // save option
    "save":     Boolean,
    // read options
    "file": String,
    "file-list": Boolean,
    // unit options
    "unit":     String,
    "unit-list": Boolean,
    "display": [String, null]
};

const shortHands = {
    // generic aliases
    "h": ["--help"],
    "V": ["--version"],
    "v": ["--level", "verbose"],
    "d": ["--device"],
    "D": ["--device-list"],
    "sd": ["--switch-daemon"],
    "cd": ["--current-daemon"],
    "n": ["--lines"],
    "r": ["--reverse"],
    "f": ["--follow"],
    "S": ["--since"],
    "U": ["--until"],
    "p": ["--priority"],
    "k": ["--dmesg"],
    "b": ["--boot"],
    "pid": ["--pid"],
    "o": ["--output"],
    "s": ["--save"],
    "file": ["--file"],
    "fl": ["--file-list"],
    "u" : ["--unit"],
    "ul" : ["--unit-list"],
    "dp" : ["--display"]
};

const argv = nopt(knownOpts, shortHands, process.argv, 2 /* drop 'node' & 'ares-*.js'*/);

log.heading = processName;
log.level = argv.level || 'warn';
log.verbose("argv", argv);

const options = {
    device: argv.device,
    display: argv.display,
    argv: argv
};

const pmLogOptions = ["follow", "reverse", "lines", "priority", "save", "display", "level", "device"],
    journalLogOptions = ["follow", "reverse", "lines", "since", "until", "pid", "dmesg", "boot", "output", "file",
                        "priority", "save", "display", "level", "device", "file", "file-list", "unit", "unit-list"];

let op;
if (argv['device-list']) {
    setupDevice.showDeviceListAndExit();
} else if (argv.version) {
    version.showVersionAndExit();
} else if (argv.help) {
    help.display(processName, appdata.getConfig(true).profile);
    cliControl.end();
} else if (argv['current-daemon']) {
    op = checkCurrentDaemon;
} else if (argv['switch-daemon']) {
    op = switchDaemon;
} else if (argv['unit-list']) {
    op = showUnitList;
} else if (argv['file-list'] || argv.file) {
    op = readMode;
} else {
    op = showLog;
}
if (op) {
    version.checkNodeVersion(function(err) {
        if (err)
            return finish(err);
        async.series([
            op.bind(this)
        ],finish);
    });
}

function showLog() {
    log.info("ares-log#printLog");

    checkOption();
    logLib.show(options, finish);
}

function readMode() {
    log.info("ares-log#readMode");

    checkOption();
    logLib.readMode(options, finish);
}

function showUnitList() {
    log.info("ares-log#showUnitList");

    checkOption();
    logLib.printUnitList(options, finish);
}

function checkCurrentDaemon() {
    log.info("ares-log#checkCurrentDaemon");

    options.currentDaemon = appdata.getConfig(true).logDaemon;
    return finish(null, "Current log daemon is " + options.currentDaemon);
}

function switchDaemon() {
    log.info("ares-log#switchDaemon");

    if (argv['switch-daemon'] === "true") {
        return finish(new Error("input wanted daemon name"));
    }
    
    // to-do: Input only in case of pmlogd, journald, and other error processing
    // to-do: Write to the changed daemon in the config file

    return finish(null, "Switched log daemon to " + argv['switch-daemon']);
}

function checkOption() {
    log.info("ares-log#checkOption");

    options.currentDaemon = appdata.getConfig(true).logDaemon;
    options.currentOption = Object.keys(argv);
    options.currentOption.splice(-1, 1);

    if (options.currentDaemon === "journald") {
        log.info("journald options");

        options.currentOption.forEach(function(item){
            if (!journalLogOptions.includes(item)) {
                return finish(new Error("Journal daemon is not suppported \"" + item +"\" option"));
            }
        });
    } else if (options.currentDaemon === "pmLogd") {
        log.info("pmlogd options");

        options.currentOption.forEach(function(item){
            if(!pmLogOptions.includes(item)) {
                return finish(new Error("PmLog daemon is not suppported \"" + item +"\" option"));
            }
        });
    } else {
        return finish(new Error("Do not support daemon"));
    }
}

function finish(err, value) {
    if (err) {
        log.error(err.toString());
        log.verbose(err.stack);
        cliControl.end(-1);
    } else {
        log.info('finish():', value);
        if (value) {
            console.log(value);
        }
        cliControl.end();
    }
}
