/*
 * Copyright (c) 2020 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const exec = require('child_process').exec,
    path = require('path'),
    fs = require('fs'),
    common = require('./common-spec');

const aresCmd = 'ares-device';

const tempDirPath = path.join(__dirname, "..", "tempFiles");

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

//Remove created file in AfterAll
describe(aresCmd + ' --capture(-c)', function() {
    it('Capture screen', function(done) {
        exec(cmd + ` --capture`, function (error, stdout) {
            const curDate = new Date();
            expect(stdout).toContain(options.device);
            expect(stdout).toContain(curDate.getFullYear());
            expect(stdout).toContain("display0");
            expect(stdout).toContain(".png");
            expect(stdout).toContain(path.resolve('.'));

            console.log(stdout);
            console.log("asdf : " + stdout.replace(/^[a-zA-Z0-9]*_$/g));

            //        const parseBase = path.parse(options.inputPath).base;
            //        let parseExt = path.parse(options.inputPath).ext;
            //        parseExt = parseExt.split('.').pop();
            //existsSync? 

            done();
        });
    });

    it('Capture screen with filename', function(done) {
        exec(cmd + ` --capture test.png`, function (error, stdout) {
            expect(stdout).not.toContain(options.device);
            expect(stdout).not.toContain("display0");
            expect(stdout).toContain("test.png");
            expect(stdout).toContain(path.resolve('.'));

            expect(fs.existsSync(path.join(path.resolve('.', "test.png")))).toBe(true);

            done();
        });
    });

    it('Capture screen with directory Path', function(done) {
        const capDirPath = path.join(tempDirPath, "webOSCap");
        console.log(capDirPath);
        exec(cmd + ` --capture ${capDirPath}`, function (error, stdout) {
            const curDate = new Date();
            expect(stdout).toContain(options.device);
            expect(stdout).toContain(curDate.getFullYear());
            expect(stdout).toContain("display0");
            expect(stdout).toContain(".png");
            expect(stdout).toContain(capDirPath);
            expect(fs.existsSync(capDirPath)).toBe(true);

            done();
        });
    });

    it('Capture screen with directory & fileName', function(done) {
        const capDirPath = path.join(tempDirPath, "webOSCap");
        const capFilePath = path.join(capDirPath, "test.bmp");
        console.log(capFilePath);
        exec(cmd + ` --capture ${capFilePath}`, function (error, stdout) {
            expect(stdout).not.toContain(options.device);
            expect(stdout).not.toContain("display0");
            expect(stdout).toContain("test.bmp");
            expect(stdout).toContain(capDirPath);
            expect(fs.existsSync(capFilePath)).toBe(true);

            done();
        });
    });
});

describe(aresCmd + ' negative TC', function() {
    it('Capture screen with invalid format', function(done) {
        exec(cmd + ` --capture "test.abc"`, function (error, stdout, stderr) {
            expect(stderr).toContain("Please specify file extension, either 'png' 'bmp' or 'jpg'");
            done();
        });
    });

    it('Capture screen with invalid destiation Path', function(done) {
        exec(cmd + ` --capture /webOSCap`, function (error, stdout, stderr) {
            expect(stderr).toContain("permission denied, mkdir '/webOSCap'");
            done();
        });
    });
});