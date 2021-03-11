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
    commonTools = require('./../lib/base/common-tools');

const version = commonTools.version,
    cliControl = commonTools.cliControl,
    help = commonTools.help,
    appdata = commonTools.appdata,
    errHndl = commonTools.errMsg,
    finish = errHndl.finish;

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
    // generic options
    "help":     Boolean,
    "version":  Boolean,
    "level":    ['silly', 'verbose', 'info', 'http', 'warn', 'error'],
    // command-specific options
    "profile":   [String, null],
    "profile-details":   Boolean
};

const shortHands = {
    // generic aliases
    "h": ["--help"],
    "V": ["--version"],
    "v": ["--level", "verbose"],
    "p": ["--profile"],
    "c": ["--profile-details"]
};

const argv = nopt(knownOpts, shortHands, process.argv, 2 /* drop 'node' & 'ares-*.js'*/);

log.heading = processName;
log.level = argv.level || 'warn';
log.verbose("argv", argv);

const options = {
    profile: argv.profile
};

const configFiles = {
    "ose" : "files/conf-base/profile/config-ose.json"
};

const templateFiles = {
    "ose" : "files/conf-base/template-conf/ose-templates.json"
};

const queryPaths = {
    "common": "files/conf-base/query/"
};

const keyFiles = {
};

let op;
if (argv.version) {
    version.showVersionAndExit();
} else if (argv.help) {
    help.display(processName, appdata.getConfig(true).profile);
    cliControl.end();
} else if (argv['profile-details']) {
    op = curConfig;
} else {
    op = config;
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

function config() {
    log.verbose("profile()", "options:", options);

    if (!Object.prototype.hasOwnProperty.call(configFiles, options.profile)) {
        return finish(errHndl.getErrMsg("INVALID_VALUE", "profile", options.profile));
    }

    const queryPath = queryPaths.common;

    appdata.setQuery(path.join(__dirname, '..', queryPath), function(err, status){
        if(typeof status === 'undefined')
            return finish(errHndl.getErrMsg("INVALID_VALUE", "query configuration"));
    });

    const templateData = require(path.join(__dirname, '..', templateFiles[options.profile]));
    appdata.setTemplate(templateData, function(err, status){
        if(typeof status === 'undefined')
            return finish(errHndl.getErrMsg("INVALID_VALUE", "template configuration"));
    });

    let keyFile = "";
    if (keyFiles[options.profile]) {
        keyFile = path.join(__dirname, '..', keyFiles[options.profile]);
    }
    appdata.setKey(keyFile, function(err){
        if(err)
            return finish(errHndl.getErrMsg("INVALID_VALUE", "key configuration"));
    });

    const configData = require(path.join(__dirname, '..', configFiles[options.profile]));
    appdata.setConfig(configData, function(err, status){
        if(typeof status === 'undefined'){
            return finish(errHndl.getErrMsg("INVALID_VALUE", "configuration"));
        } else {
            console.log("profile and config data is changed to " + status.profile);
        }
        finish(err);
    });
}

function curConfig(next) {
    const curConfigData = appdata.getConfig(true);
    if (typeof curConfigData.profile === 'undefined') {
        return finish(errHndl.getErrMsg("INVALID_VALUE", "profile details"));
    } else if (curConfigData.profile.trim() === "") {
        return finish(errHndl.getErrMsg("EMPTY_PROFILE"));
    } else {
        console.log("Current profile set to " + curConfigData.profile);
        next();
    }
}
