#!/usr/bin/env node

/*
 * Copyright (c) 2020 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const fs = require('fs'),
    path = require('path'),
    async = require('async'),
    log = require('npmlog'),
    nopt = require('nopt'),
    launchLib = require('./../lib/launch'),
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
    "device":   [String, null],
    "inspect":  Boolean,
    "open": Boolean,
    "device-list":  Boolean,
    "close":    Boolean,
    "hosted":   Boolean,
    "running":  Boolean,
    "display" : [String, null],
    "params":   [String, Array],
    "host-port": [String, null],
    "version":  Boolean,
    "help":     Boolean,
    "hidden-help":      Boolean,
    "level":    ['silly', 'verbose', 'info', 'http', 'warn', 'error']
};

const shortHands = {
    "d": ["--device"],
    "i": ["--inspect"],
    "o": ["--open"],
    "D": ["--device-list"],
    "c": ["--close"],
    "r": ["--running"],
    "dp": ["--display"],
    "p": ["--params"],
    "P": ["--host-port"],
    "V": ["--version"],
    "h": ["--help"],
    "hh": ["--hidden-help"],
    "H": ["--hosted"],
    "v": ["--level", "verbose"]
};

const argv = nopt(knownOpts, shortHands, process.argv, 2 /* drop 'node' & 'ares-install.js'*/);

log.heading = processName;
log.level = argv.level || 'warn';
launchLib.log.level = log.level;
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
    if (argv.argv.remain.length===0 && (Object.keys(argv)).length === 1) {
        argv.help=true;
    }
}

const options = {
        device: argv.device,
        inspect: argv.open || argv.inspect,
        open: argv.open,
        installMode: "Installed",
        hostPort: argv["host-port"],
        display: argv.display
    },
    appId = argv.argv.remain[0];

if (argv.argv.remain.length > 1) {
    finish("Please check arguments");
}

let op,
    params = {};
if (argv.help || argv['hidden-help']) {
    showUsage(argv['hidden-help']);
    cliControl.end();
} else if (argv.close) {
    op = close;
} else if (argv.running) {
    op = running;
} else if (argv['device-list']) {
    setupDevice.showDeviceListAndExit();
} else if (argv.version) {
    version.showVersionAndExit();
} else if (argv.hosted){
    options.installMode = "Hosted";
    op = launchHostedApp;
} else {
    op = launch;
}

if (op) {
    version.checkNodeVersion(function() {
        async.series([
            op.bind(this)
        ],finish);
    });
}

function showUsage(hiddenFlag) {
    if (hiddenFlag) {
        help.display(processName, appdata.getConfig(true).profile, hiddenFlag);
    } else {
        help.display(processName, appdata.getConfig(true).profile);
    }
}

function launch() {
    const pkgId = appId;
    params = getParams();
    log.info("launch():", "pkgId:", pkgId);
    if (!pkgId) {
        showUsage();
        cliControl.end(-1);
    }
    launchLib.launch(options, pkgId, params, finish);
}

function launchHostedApp() {
    const hostedurl = fs.realpathSync(appId);
    const pkgId = "com.sdk.ares.hostedapp";
    options.hostedurl = hostedurl;
    params = getParams();
    log.info("launch():", "pkgId:", pkgId);
    launchLib.launch(options, pkgId, params, finish);
}

function getParams() {
    const inputParams = argv.params || [];
    params = {};
    if (inputParams.length === 1 && inputParams[0].indexOf('{') !== -1 && inputParams[0].indexOf('}') !== -1 &&
        ( (inputParams[0].split("'").length - 1) % 2) === 0) {
        // eslint-disable-next-line no-useless-escape
        inputParams[0] = inputParams[0].replace(/\'/g,'"');
    }
    inputParams.forEach(function(strParam) {
        try {
            const data = JSON.parse(strParam);
            for (const k in data) {
                params[k] = data[k];
            }
        } catch (err) {
            const tokens = strParam.split('=');
            if (tokens.length === 2) {
                params[tokens[0]] = tokens[1];
            } else {
                log.warn('Ignoring invalid arguments:', strParam);
            }
        }
    });

    if (argv.display !== undefined && isNaN(Number(argv.display))) {
        return finish(errHndl.getErrMsg("INVALID_DISPLAY"));
    }

    log.info("getParams():", "params:", JSON.stringify(params));
    return params;
}

function close() {
    const pkgId = appId;
    params = getParams();
    log.info("close():", "pkgId:", pkgId);
    if (!pkgId) {
        showUsage();
        cliControl.end(-1);
    }
    launchLib.close(options, pkgId, params, finish);
}

function running() {
    launchLib.listRunningApp(options, function(err, runningApps) {
        let strRunApps = "";
        let cnt = 0;

        if (err) {
            return finish(err);
        }
        if (runningApps instanceof Array) runningApps.forEach(function (runApp) {
            if (cnt++ !== 0) {
                strRunApps = strRunApps.concat('\n');
            }
            strRunApps = strRunApps.concat(runApp.id);
            if (runApp.displayId !== undefined) {
                strRunApps += " - display " + runApp.displayId;
            }
        });
        finish(null, {msg : strRunApps});
    });
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
