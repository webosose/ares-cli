/*
 * Copyright (c) 2020 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const exec = require('child_process').exec,
    common = require('./common-spec');

const aresCmd = 'ares-device';

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
        exec(cmd + ' -D', function (error, stdout) {
            expect(stdout).toContain(options.device);
            done();
        });
    });
});

describe(aresCmd, function() {
    it('Retrieve device information', function(done) {
        const keys = ["webos_build_id","webos_imagename","webos_name","webos_release",
                    "webos_manufacturing_version", "core_os_kernel_version", "device_name",
                    "device_id", "chromium_version", "qt_version"];
        exec(cmd + ` -i ${options.device}`, function (error, stdout) {
            keys.forEach(function(key) {
                expect(stdout).toContain(key);
            });
            done();
        });
    });
});

describe(aresCmd, function() {
    it('Retrieve session information', function(done) {
        const keys = ["sessionId", "displayId"];
        exec(cmd + ` -s ${options.device}`, function (error, stdout, stderr) {
            if (stderr.length > 0) {
                expect(stderr).toContain("This device does not support the session.");
            }
            else {
                keys.forEach(function(key) {
                    expect(stdout).toContain(key);
                });
            }
            done();
        });
    });
});
