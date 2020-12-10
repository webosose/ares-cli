/*
 * Copyright (c) 2020 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const exec = require('child_process').exec,
    common = require('./common-spec');

const aresCmd = 'ares-inspect';

let cmd, 
    options;

beforeAll(function (done) {
    cmd = common.makeCmd(aresCmd);
    common.getOptions()
    .then(function(result) {
        options = result;
        done();
    });
});

describe(aresCmd + ' -v', function() {
    it('Print help message with verbose log', function(done) {
        exec(cmd + ' -v', function (error, stdout, stderr) {
            expect(stderr.toString()).toContain("verb argv");
            expect(stdout).toContain("SYNOPSIS");
            expect(error).toBeNull();
            done();
        });
    });
});

describe(aresCmd, function() {
    it("Add device with ares-setup-device", function(done) {
        common.resetDeviceList()
        .then(function() {
            return common.addDeviceInfo();
        }).then(function(result) {
            expect(result).toContain(options.device);
            done();
        }).catch(function(err) {
            expect(err).toContain("The specified value already exist");
            done();
        });
    });
});

describe(aresCmd + ' --device-list(-D)', function() {
    it('Show available device list', function(done) {
        exec(cmd + ' -D', function (error, stdout) {
            expect(stdout).toContain(options.device, error);
            done();
        });
    });
});

describe(aresCmd, function() {
    it('Install sample ipk to device', function(done) {
        const installCmd = common.makeCmd('ares-install');
        exec(installCmd + ` ${options.ipkPath}`, function (error, stdout, stderr) {
            expect(stdout).toContain("Success", stderr);
            setTimeout(() => {
                done();
            }, 2000);
        });
    });
});

describe(aresCmd, function() {
    it('Run web inspector for sample app', function(done) {
        const child = exec(cmd + ` -a ${options.pkgId} -dp 0`);
        let result = null;

        child.stdout.on('data', function (data) {
            process.stdout.write(data.toString());
            result = data.toString();
            expect(data.toString()).toContain('Application Debugging - http://localhost');
        });

        child.stderr.on('data', function (data) {
            expect(data.toString()).toBeNull(data.toString());
            result = data.toString();
        });

        setTimeout(() => {
            child.kill();
            expect(result).not.toBeNull();
            done();
        }, 7000);
    });

    it('Close sample App', function(done) {
        const launchCmd = common.makeCmd('ares-launch');
        exec(launchCmd + ` -c ${options.pkgId} -dp 0`, function (error, stdout) {
            expect(stdout).toContain(`Closed application ${options.pkgId}`, error);
            setTimeout(function(){
                done();
            },3000);
        });
    });
});

describe(aresCmd +' --open(-o)', function() {
    it('Open web inspector for sample app', function(done) {
        const child = exec(cmd + ` -a ${options.pkgId} -o -dp 1`);
        let result = null;

        child.stdout.on('data', function (data) {
            process.stdout.write(data.toString());
            result = data.toString();
            expect(data.toString()).toContain('Application Debugging - http://localhost');
        });

        child.stderr.on('data', function (data) {
            expect(data.toString()).toBeNull(data.toString());
            result = data.toString();
        });

        setTimeout(() => {
            child.kill();
            expect(result).not.toBeNull();
            done();
        }, 3000);
    });

    it('Close sample App', function(done) {
        const launchCmd = common.makeCmd('ares-launch');
        exec(launchCmd + ` -c ${options.pkgId} -dp 1`, function (error, stdout) {
            expect(stdout).toContain(`Closed application ${options.pkgId}`, error);
            setTimeout(function(){
                done();
            },3000);
        });
    });
});

describe(aresCmd, function() {
    let result = null;

    it('Run Node\'s Inspector for sample Service', function(done) {
        const child = exec(cmd + ` -s ${options.pkgService} -dp 1`);

        child.stdout.on('data', function (data) {
            process.stdout.write(data.toString());
            result = data.toString();
            expect(result).not.toContain("null");
            expect(result).toContain("localhost");
        });

        child.stderr.on('data', function (data) {
            result = data.toString();
            expect(data.toString()).toBeNull();
        });

        setTimeout(() => {
            child.kill();
            expect(result).not.toBeNull();
            done();
        }, 10000);
    });
});

describe(aresCmd +' --open(-o)', function() {
    let result = null;

    it('Open Node\'s Inspector for sample Service', function(done) {
        const child = exec(cmd + ` -s ${options.pkgService} -dp 0 -o`);
        const guideTexts = ["To debug your service, set \"localhost",
                            "Can not support \"--open option\" on platform node version 8 and later",
                            "nodeInsptUrl" ];

        child.stdout.on('data', function (data) {
            process.stdout.write(data.toString());
            result = data.trim().replace(/\s+['\n']/g, '\n');
            expect(result).not.toContain("null");
            expect(guideTexts).toContain(String(result).split(":")[0]);
        });

        child.stderr.on('data', function (data) {
            result = data.toString();
            expect(data.toString()).toBeNull();
        });

        setTimeout(() => {
            child.kill();
            done();
        }, 7000);
    });
});

describe(aresCmd, function() {
    it('Remove installed sample app with ares-install', function(done) {
        const installCmd = common.makeCmd('ares-install');
        exec(installCmd + ` -r ${options.pkgId}`, function (error, stdout, stderr) {
            expect(stdout).toContain(`Removed package ${options.pkgId}`, stderr);
            done();
        });
    });
});
