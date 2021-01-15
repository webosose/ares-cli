/*
 * Copyright (c) 2020 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const path = require('path'),
    exec = require('child_process').exec,
    common = require('./common-spec');

const aresCmd = 'ares-pull',
    dstPath = path.join(__dirname, "..", "tempFiles");

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
    beforeEach(function(done) {
        const shellCmd = common.makeCmd('ares-shell');
        exec(shellCmd + ' -r "touch /tmp/aresfile"', function () {
            done();
        });
    });

    it('Copy directory from a device to host machine', function(done) {
        exec(cmd + ` /tmp/aresfile ${dstPath}`, function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).toContain(dstPath);
            expect(stdout).toContain("1 file(s) pulled");
            done();
        });
    });
});

describe(aresCmd + ' --ignore(-i)', function() {
    it('Copy directory from a device to host machine', function(done) {
        exec(cmd + ` -i /tmp/aresfile ${dstPath}`, function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).not.toContain(dstPath);
            expect(stdout).toContain("1 file(s) pulled");
            done();
        });
    });

    afterEach(function(done) {
        common.removeOutDir(path.join(dstPath, "aresfile"));
        done();
    });
});
