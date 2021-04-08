#!/usr/bin/env node

/*
 * Copyright (c) 2020 LG Electronics Inc.
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
    "save":     String
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
    "s": ["--save"]
};


const argv = nopt(knownOpts, shortHands, process.argv, 2 /* drop 'node' & 'ares-*.js'*/);

log.heading = processName;
log.level = argv.level || 'warn';

let options = {
    device: argv.device,
    argv: argv
};

const configFiles = {
    "ose" : "files/conf-base/profile/config-ose.json"
};

const pmLogOptions = ["follow", "reverse", "lines", "priority", "save", "display", "level", "device"];
const journalLogOptions = ["follow", "reverse", "lines", "since", "until", "pid", "dmesg", 
                            "boot", "output", "file", "priority", "save", "display", "level", "device"];

let op;
if (argv['device-list']) {
    setupDevice.showDeviceListAndExit();
} else if (argv.version) {
    version.showVersionAndExit();
} else if (argv.help) {
    help.display(processName, appdata.getConfig(true).profile);
    cliControl.end();
} else if (argv.argv.cooked.includes('--current-daemon')) { //-cc
    op = checkCurrentDaemon;
} else if (argv.argv.cooked.includes('--switch-daemon')) {
    op = switchDaemon;
} else if (argv['save']) { //to-do: -ss
    op = saveLog;
} else { //to-do: ares-log에서 지원하지 않는 옵션을 걸러야함
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

function saveLog() {
    log.info("ares-log#save");

    checkOption();
    logLib.save(options, finish);
}

// 현재 선택된 로그 데몬 출력, default=journald
function checkCurrentDaemon() {
    log.info("ares-log#checkCurrentDaemon");

    options.currentDaemon = appdata.getConfig(true).logDaemon;
    return finish(null, "Current log daemon is " + options.currentDaemon);
}

// 입력된 로그 데몬으로 변경, to-do
function switchDaemon() {
    log.info("ares-log#switchDaemon");

    if (argv['switch-daemon'] === "true") {
        return finish(new Error("input wanted daemon name"));
    }
    
    //to-do: pmlogd, journald 인 경우만 입력 그 외는 error처리

    const config = appdata.getConfig(true);
    //to-do: config파일에 변경된 데몬으로 write
    
    return finish(null, "Switch log daemon to " + argv['switch-daemon']);
}

// 입력한 옵션이 현재 선택된 로그 데몬에서 지원하는 옵션인지 여부 판별
// 입력한 옵션은 ares-log에서 지원하는 옵션 내에서 선택(그 외 옵션을 따로 처리하도록 수정 필요)
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
    } else { //journald, pmlogd가 아닌 것이 선택된 경우, switchDaemon error처리 정상적으로 하면 발생할 경우 없음.
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
