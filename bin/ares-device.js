#!/usr/bin/env node

/*
 * Copyright (c) 2020 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const path = require('path'),
    async = require('async'),
    log = require('npmlog'),
    nopt = require('nopt'),
    deviceLib = require('./../lib/device'),
    commonTools = require('./../lib/base/common-tools');

const version = commonTools.version,
    cliControl = commonTools.cliControl,
    help = commonTools.help,
    setupDevice = commonTools.setupDevice,
    appdata = commonTools.appdata,
    errHndl = commonTools.errMsg;

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
    "system-info": Boolean,
    "session-info": Boolean,
    "capture-screen" : Boolean,
    "display" : Number,
    "device":   [String, null],
    "device-list":  Boolean,
    "version":  Boolean,
    "help":     Boolean,
    "level":    ['silly', 'verbose', 'info', 'http', 'warn', 'error']
};

const shortHands = {
    "i": ["--system-info"],
    "s": ["--session-info"],
    "c": ["--capture-screen"],
    "dp" : ["--display"],
    "d": ["--device"],
    "D": ["--device-list"],
    "V": ["--version"],
    "h": ["--help"],
    "v": ["--level", "verbose"]
};

const argv = nopt(knownOpts, shortHands, process.argv, 2 /* drop 'node' & 'ares-install.js'*/);

log.heading = processName;
log.level = argv.level || 'warn';
log.verbose("argv", argv);

/**
 * For consistent of "$command -v", argv is used.
 * By nopt, argv is parsed and set key-value in argv object.
 * If -v or --level option is input with command, it is set key-value in argv.
 * After it is deleted, If remained key is only one in argv object
 * (If any other are remained, it's mean another options is input)
 * and there is no remaining after parsing the input command by nopt
 * (If any other are remained, it's mean another parameters ares input),
 * each command of webOS CLI print help message with log message.
 */
if (argv.level) {
    delete argv.level;
    if (argv.argv.remain.length === 0 && (Object.keys(argv)).length === 1) {
        argv.help = true;
    }
}

const options = {
    device: argv.device,
    display : argv.display || 0,
    outputPath : argv.argv.remain[0] || null,
};

let op;
if (argv['device-list']) {
    setupDevice.showDeviceListAndExit();
} else if (argv.version) {
    version.showVersionAndExit();
} else if (argv.help) {
    showUsage();
    cliControl.end();
} else if (argv['system-info']) {
    op = getDeviceInfo;
} else if (argv['session-info']) {
    op = getSessionInfo;
} else if (argv['capture-screen']) {
    op = captureScreen;
} else {
    showUsage();
    cliControl.end();
}

if (argv.argv.remain.length > 1) {
    finish(errHndl.getErrMsg("INVALID_ARGV"));
}

if (op) {
    version.checkNodeVersion(function(err) {
        if(err)
            return finish(err);
        async.series([
            op.bind(this)
        ],finish);
    });
}

function showUsage() {
    help.display(processName, appdata.getConfig(true).profile);
}

function getDeviceInfo() {
    deviceLib.systemInfo(options, finish);
}

function getSessionInfo() {
    deviceLib.sessionInfo(options, finish);
}

function captureScreen() {
    deviceLib.captureScreen(options, finish);
}

function finish(err, value) {
    if (err) {
        // handle err from getErrMsg()
        if (Array.isArray(err) && err.length > 0) {
            for(const index in err) {
                log.error(err[index].heading, err[index].message);
            }
            log.verbose(err[0].stack);
        } else {
            // handle general err (string & object)
            log.error(err.toString());
            log.verbose(err.stack);
        }
        cliControl.end(-1);
    } else {
        log.info('finish():', value);
        if (value && value.msg) {
            console.log(value.msg);
        }
        cliControl.end();
    }
}
