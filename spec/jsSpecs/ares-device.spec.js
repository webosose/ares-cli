/*
 * Copyright (c) 2020 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const exec = require('child_process').exec,
    path = require('path'),
    fs = require('fs'),
    common = require('./common-spec');

const captureDirPath = path.join(__dirname, "..", "tempFiles", "deviceCapture"),
    reg = new RegExp("[A-Za-z0-9]*_display[0-9]_[0-9]*.png");

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

describe(aresCmd + ' --capture-screen(-c)', function() {
    let generatedFile = "";

    beforeEach(function(done) {
        common.removeOutDir(captureDirPath);
        done();
    });
    afterEach(function(done) {
        common.removeOutDir(generatedFile);
        common.removeOutDir(captureDirPath);
        generatedFile = "";
        done();
    });

    it('Capture', function(done) {
        exec(cmd + ` -c`, function (error, stdout) {
            expect(stdout).toContain(options.device);
            expect(stdout).toContain(new Date().getFullYear());
            expect(stdout).toContain("display0");
            expect(stdout).toContain(".png");
            expect(stdout).toContain(path.resolve('.'));

            const arr = stdout.match(reg);

            generatedFile = path.join(path.resolve('.'), arr[0]);
            console.log("capture file name : " + arr[0]);
            expect(fs.existsSync(generatedFile)).toBe(true);
            done();
        });
    });

    it('Capture with filename', function(done) {
        exec(cmd + ` -c screen.png`, function (error, stdout) {
            expect(stdout).not.toContain(options.device);
            expect(stdout).not.toContain("display0");
            expect(stdout).toContain("screen.png");
            expect(stdout).toContain(path.resolve('.'));

            generatedFile = path.join(path.resolve('.'), "screen.png");
            expect(fs.existsSync(generatedFile)).toBe(true);
            done();
        });
    });

    it('Capture with directory Path & display option', function(done) {
        exec(cmd + ` -c ${captureDirPath} --display 1`, function (error, stdout) {
            expect(stdout).toContain(options.device);
            expect(stdout).toContain(new Date().getFullYear());
            expect(stdout).toContain("display1");
            expect(stdout).toContain(".png");
            expect(stdout).toContain(captureDirPath);
            expect(fs.existsSync(captureDirPath)).toBe(true);

            const arr = stdout.match(reg);

            console.log("capture file name : " + arr[0]);
            expect(fs.existsSync(path.join(captureDirPath, arr[0]))).toBe(true);
            done();
        });
    });

    it('Capture with directory & file path(bmp)', function(done) {
        const captureFilePath = path.join(captureDirPath, "screen.bmp");
        exec(cmd + ` -c ${captureFilePath}`, function (error, stdout) {
            expect(stdout).not.toContain(options.device);
            expect(stdout).not.toContain("display0");
            expect(stdout).toContain("screen.bmp");
            expect(stdout).toContain(captureDirPath);
            expect(fs.existsSync(captureDirPath)).toBe(true);
            done();
        });
    });

    it('Capture with directory & file path(jpg)', function(done) {
        const captureFilePath = path.join(captureDirPath, "screen.jpg");
        exec(cmd + ` -c ${captureFilePath}`, function (error, stdout) {
            expect(stdout).not.toContain(options.device);
            expect(stdout).not.toContain("display0");
            expect(stdout).toContain("screen.jpg");
            expect(stdout).toContain(captureDirPath);
            expect(fs.existsSync(captureDirPath)).toBe(true);
            done();
        });
    });
});

describe(aresCmd + ' negative TC', function() {
    it('Capture with invalid file format', function(done) {
        exec(cmd + ` -c "test.abc"`, function (error, stdout, stderr) {
            expect(stderr).toContain("Please specify file extension, either 'png' 'bmp' or 'jpg'");
            done();
        });
    });

    it('Capture with invalid destiation Path', function(done) {
        exec(cmd + ` -c /rootDir`, function (error, stdout, stderr) {
            expect(stderr).toContain("permission denied, mkdir '/rootDir'");
            done();
        });
    });

    it('Capture with invalid display ID', function(done) {
        exec(cmd + ` -c --display 10`, function (error, stdout, stderr) {
            expect(stderr).toContain("luna-send command failed <ERR_INVALID_DISPLAY>");
            done();
        });
    });
});
