/*
 * Copyright (c) 2020 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const path = require('path'),
    fs = require('fs'),
    nopt = require('nopt'),
    exec = require('child_process').exec,
    shelljs = require('shelljs');

const commonSpec = {};
const options = {
    profile: "ose",
    device : "emulator",
    ip : "127.0.0.1",
    port : 6622,
    pkgId : "com.jasmine.web.app",
    pkgService : "com.jasmine.web.app.service",
    ipkFile : "com.jasmine.web.app_0.0.1_all.ipk",
    ipkPath : path.join(__dirname, "..", "tempFiles",  "com.jasmine.web.app_0.0.1_all.ipk")
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = commonSpec;
}

const knownOpts = {
    "device":  String,
    "ip":  String,
    "port": String
};
const shortHands = {
    "d": ["--device"],
    "ip": ["--ip"],
    "port": ["--port"]
};

commonSpec.getOptions = function() {
    return new Promise(function(resolve, reject){
        const argv = nopt(knownOpts, shortHands, process.argv, 2);

        if(argv.device)
            options.device = argv.device;
        if(argv.ip)
            options.ip = argv.ip;
        if(options.device !== "emulator")
            options.port = argv.port ? argv.port : 22;

        console.info(`device : ${options.device}, ip : ${options.ip}, port : ${options.port}`);

        // set profile
        const cmd = commonSpec.makeCmd('ares-config');
        exec(cmd, function (error, stdout) {
            if(error){
                console.error("set config error " +  error);
                reject(stdout);
            }
            resolve(options);
        });
    });
};

commonSpec.getExpectedResult = function(aresCmd) {
    return new Promise(function(resolve){
        try {
            const text = fs.readFileSync(path.join(__dirname, "../test_data", aresCmd + '.json'), 'utf8');
            const resultJson = JSON.parse(text);
            resolve(resultJson[options.profile]);
        } catch(err) {
            console.error(err);
            process.exit(1);
        }
    });
};

commonSpec.resetDeviceList = function() {
    return new Promise(function(resolve, reject) {
        const cmd = commonSpec.makeCmd('ares-setup-device');
        exec(cmd + ' -R', function (error, stdout, stderr) {
            if(!stderr){
                resolve(true);
            } else {
                reject(error);
            }
        });
    });
};

commonSpec.addDeviceInfo = function() {
    return new Promise(function(resolve, reject) {
        const cmd = commonSpec.makeCmd('ares-setup-device');
        exec(cmd + ` -a ${options.device} -i port=${options.port} -i username=root -i host=${options.ip} -i default=true`,
        function (error, stdout, stderr) {
            if(stderr) {
                reject(stderr);
            } else {
                resolve(stdout);
            }
        });
    });
};

commonSpec.makeCmd = function(cmd) {
    return `node ${path.join('bin', cmd + '.js')}`;
};

commonSpec.removeOutDir = function(filePath) {
    if(fs.existsSync(filePath))
        shelljs.rm('-rf', filePath);
};

commonSpec.detectNodeMessage = function(stderr) {
    if (stderr.includes("node:")) {
        return fail(stderr);
    }
};
