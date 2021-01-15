/*
 * Copyright (c) 2020 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const exec = require('child_process').exec,
    common = require('./common-spec');

const aresCmd = 'ares-install';

let cmd,
    options;

beforeAll(function (done) {
    cmd = common.makeCmd(aresCmd);
    common.getOptions()
    .then(function(result){
        options = result;
        done();
    });
});

describe(aresCmd + ' -v', function() {
    it('Print help message with verbose log', function(done) {
        exec(cmd + ' -v', function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
                expect(stderr).toContain("verb argv");
            }
            expect(stdout).toContain("SYNOPSIS");
            expect(error).toBeNull();
            done();
        });
    });
});

describe(aresCmd, function() {
    it("Add device with ares-setup-device", function(done) {
        common.resetDeviceList()
        .then(function(){
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
        exec(cmd + ' -D', function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).toContain(options.device);
            done();
        });
    });
});

describe(aresCmd, function() {
    it('Install sample ipk to device', function(done) {
        exec(cmd + ` ${options.ipkPath}`, function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).toContain("Success", stderr);/////stderr 출력? 앞에 조건을 만족하지 않는 경우에만 stderr
            done();
        });
    });
});

describe(aresCmd + ' --list(-l)', function() {
    it('List the installed apps on device', function(done) {
        exec(cmd + ' -l', function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).toContain(options.pkgId, stderr);
            done();
        });
    });
});

describe(aresCmd + ' --listfull(-F)', function() {
    it('List the installed apps detail information', function(done) {
        exec(cmd + ' -F', function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).toContain(options.pkgId, stderr);
            expect(stdout).toContain("version:0.0.1");
            done();
        });
    });
});

describe(aresCmd + ' --remove(-r)', function() {
    it('Remove installed sample app', function(done) {
        exec(cmd + ` -r ${options.pkgId}`, function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).toContain(`Removed package ${options.pkgId}`, stderr);
            done();
        });
    });
});

describe(aresCmd + ' --list(-l)', function() {
    it('Check removed app is not on installed List', function(done) {
        exec(cmd + ' -l', function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).not.toContain(options.pkgId, stderr);
            done();
        });
    });
});
