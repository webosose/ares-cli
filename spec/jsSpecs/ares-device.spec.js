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
    dateFileReg = new RegExp("[A-Za-z0-9]*_display[0-9]_[0-9]*.png"),
    csvDirPath = path.join(__dirname, "..", "tempFiles", "csvDir"),
    csvFileReg = new RegExp("[0-9]*.csv");

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
    it('Retrieve device information', function(done) {
        const keys = ["webos_build_id","webos_imagename","webos_name","webos_release",
                    "webos_manufacturing_version", "core_os_kernel_version", "device_name",
                    "device_id", "chromium_version", "qt_version"];
        exec(cmd + ` -i ${options.device}`, function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
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
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
                expect(stderr).toContain("ares-device ERR! [com.webos.service.sessionmanager failure]: " +
                                        "luna-send command failed <Service does not exist: com.webos.service.sessionmanager.>");
                expect(stderr).toContain("ares-device ERR! [Tips]: This device does not support multiple sessions");
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

describe(aresCmd, function() {
    const installCmd = common.makeCmd('ares-install');
    it('Install sample ipk to device with ares-install', function(done) {
        exec(installCmd + ` ${options.ipkPath}`, function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).toContain("Success", stderr);
            setTimeout(function(){
                done();
            }, 3000);
        });
    });
});

describe(aresCmd + ' --resource-monitor(-r)', function() {
    beforeAll(function(done) {
        common.removeOutDir(csvDirPath);
        done();
    });
    afterAll(function(done) {
        common.removeOutDir(csvDirPath);
        done();
    });

    it('Print all system resource', function(done) {
        exec(cmd + " -r", function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            else {
                expect(stdout).toContain("cpu0");
                expect(stdout).toContain("memory");
            }
            done();
        });
    });

    it('Save csv file for all system resource', function(done) {
        exec(cmd + ` -r -S ${csvDirPath}`, function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            else {
                expect(stdout).toContain("cpu0");
                expect(stdout).toContain(csvDirPath);

                const matchedFiles = stdout.match(csvFileReg);
                expect(fs.existsSync(path.join(csvDirPath, matchedFiles[0]))).toBe(true);
                done();
            }
        });
    });

    it('Print all system resource repeatedly', function(done) {
        const child = exec(cmd + " -r -t 1");
        let stdoutData;
        child.stdout.on('data', function (data) {
            stdoutData += data;
        });

        child.stderr.on('data', function (data) {
            if (data && data.length > 0) {
                common.detectNodeMessage(data);
            }
            expect(data).toBeNull();
        });

        setTimeout(() => {
            child.kill();
            // Check the menu item count in interval result
            const regCPU = /cpu0/g,
                regMemory= /memory/g,
                matchedCPU = ((stdoutData || '').match(regCPU) || []).length,
                matchedMemory = ((stdoutData || '').match(regMemory) || []).length;

            expect(matchedCPU).toBeGreaterThan(3);
            expect(matchedMemory).toBeGreaterThan(3);
            done();
        }, 6000);
    });
});

describe(aresCmd, function() {
    const launchCmd = common.makeCmd('ares-launch');
    it('Launch sample App', function(done) {
        exec(launchCmd + ` ${options.pkgId}`, function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).toContain("[Info] Set target device : " + options.device);
            expect(stdout).toContain(`Launched application ${options.pkgId}`, error);
            setTimeout(function(){
                done();
            }, 3000);
        });
    });
});

describe(aresCmd + ' --resource-monitor(-r)', function() {
    beforeAll(function(done) {
        common.removeOutDir(csvDirPath);
        done();
    });
    afterAll(function(done) {
        common.removeOutDir(csvDirPath);
        done();
    });

    it('Print running app resource', function(done) {
        exec(cmd + " -r --list", function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            else {
                expect(stdout).toContain("[Info] Set target device : " + options.device);
                expect(stdout).toContain(options.pkgId, error);
                expect(stdout).toContain("PID");
                expect(stdout).toContain("CPU");
                expect(stdout).toContain("MEMORY");
            }
            done();
        });
    });

    it('Print running app resource repeatedly', function(done) {
        const child = exec(cmd + " -r --list -t 1");
        let stdoutData;
        child.stdout.on('data', function (data) {
            stdoutData += data;
        });

        child.stderr.on('data', function (data) {
            if (data && data.length > 0) {
                common.detectNodeMessage(data);
            }
            expect(data).toBeNull();
        });

        setTimeout(() => {
            child.kill();
            const idReg = new RegExp(options.pkgId, 'g');
            const matchedApp = ((stdoutData || '').match(idReg) || []).length;
            expect(matchedApp).toBeGreaterThan(3);
            done();
        }, 6000);
    });

    it('Print specific app resource', function(done) {
        exec(cmd + ` -r -id ${options.pkgId}`, function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            else {
                expect(stdout).toContain("[Info] Set target device : " + options.device);
                expect(stdout).toContain(options.pkgId);
                expect(stdout).toContain("PID");
            }
            done();
        });
    });

    it('Save csv file for specific app resource', function(done) {
        exec(cmd + ` -r -id ${options.pkgId} -S ${csvDirPath}`, function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            else {
                expect(stdout).toContain(options.pkgId);
                expect(stdout).toContain(csvDirPath);

                const matchedFiles = stdout.match(csvFileReg);
                expect(fs.existsSync(path.join(csvDirPath, matchedFiles[0]))).toBe(true);
                done();
            }
            done();
        });
    });

    it('Print specific app is not running', function(done) {
        exec(cmd + ` -r -id com.test.app`, function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            else {
                expect(stdout).toContain("[Info] Set target device : " + options.device);
                expect(stdout).toContain("<com.test.app> is not running. Please launch the app or service.");
            }
            done();
        });
    });
});

describe(aresCmd + ' --remove(-r)', function() {
    const installCmd = common.makeCmd('ares-install');
    it('Remove installed sample app', function(done) {
        exec(installCmd + ` -r ${options.pkgId}`, function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).toContain(`Removed package ${options.pkgId}`, stderr);
            done();
        });
    });
});

describe(aresCmd + ' --capture-screen(-c)', function() {
    let generatedFile = "";

    beforeEach(function(done) {
        generatedFile = "";
        common.removeOutDir(captureDirPath);
        done();
    });
    afterEach(function(done) {
        common.removeOutDir(generatedFile);
        common.removeOutDir(captureDirPath);
        done();
    });

    it('Capture', function(done) {
        exec(cmd + ` -c`, function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).toContain(options.device);
            expect(stdout).toContain(new Date().getFullYear());
            expect(stdout).toContain("display0");
            expect(stdout).toContain(".png");
            expect(stdout).toContain(path.resolve('.'));

            const matchedFiles = stdout.match(dateFileReg);

            generatedFile = path.join(path.resolve('.'), matchedFiles[0]);
            console.log("capture file name : " + matchedFiles[0]);
            expect(fs.existsSync(generatedFile)).toBe(true);
            done();
        });
    });

    it('Capture with filename', function(done) {
        exec(cmd + ` -c screen.png`, function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).toContain("[Info] Set target device : " + options.device);
            expect(stdout).not.toContain("display0");
            expect(stdout).toContain("screen.png");
            expect(stdout).toContain(path.resolve('.'));

            generatedFile = path.join(path.resolve('.'), "screen.png");
            expect(fs.existsSync(generatedFile)).toBe(true);
            done();
        });
    });

    it('Capture with directory Path & display option', function(done) {
        exec(cmd + ` -c ${captureDirPath} --display 1`, function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).toContain(options.device);
            expect(stdout).toContain(new Date().getFullYear());
            expect(stdout).toContain("display1");
            expect(stdout).toContain(".png");
            expect(stdout).toContain(captureDirPath);
            expect(fs.existsSync(captureDirPath)).toBe(true);

            const matchedFiles = stdout.match(dateFileReg);

            console.log("capture file name : " + matchedFiles[0]);
            expect(fs.existsSync(path.join(captureDirPath, matchedFiles[0]))).toBe(true);
            done();
        });
    });

    it('Capture with directory & file path(bmp)', function(done) {
        const captureFilePath = path.join(captureDirPath, "screen.bmp");
        exec(cmd + ` -c ${captureFilePath}`, function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).not.toContain("display0");
            expect(stdout).toContain("screen.bmp");
            expect(stdout).toContain(captureDirPath);
            expect(fs.existsSync(captureDirPath)).toBe(true);
            done();
        });
    });

    it('Capture with directory & file path(jpg)', function(done) {
        const captureFilePath = path.join(captureDirPath, "screen.jpg");
        exec(cmd + ` -c ${captureFilePath}`, function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).not.toContain("display0");
            expect(stdout).toContain("screen.jpg");
            expect(stdout).toContain(captureDirPath);
            expect(fs.existsSync(captureDirPath)).toBe(true);
            done();
        });
    });
});

describe(aresCmd + ' negative TC', function() {
    const noPermDirPath = path.join(__dirname, "..", "tempFiles", "noPermDir");

    beforeAll(function(done) { 
        common.createOutDir(noPermDirPath, '0577');
        done();
    });

    afterAll(function(done) {
        common.removeOutDir(noPermDirPath);
        done();
    });

    it('Monitor system resource with invalid file extensiton', function(done) {
        exec(cmd + ` -r -S test.abc`, function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
                expect(stderr).toContain("ares-device ERR! [Tips]: Please specify the file extension(.csv)");
            }
            done();
        });
    });

    it('Capture with invalid destiation Path', function(done) {
        exec(cmd + ` -r -S ${noPermDirPath}`, function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
                expect(stderr).toContain("ares-device ERR! [syscall failure]: EACCES: permission denied");
                expect(stderr).toContain("ares-device ERR! [Tips]: No permission to execute. Please check the directory permission");
            }
            done();
        });
    });
    
    it('Capture with invalid file format', function(done) {
        exec(cmd + ` -c "test.abc"`, function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
                expect(stderr).toContain("ares-device ERR! [Tips]: Please specify the file extension(.png, .bmp or .jpg)");
            }
            done();
        });
    });

    it('Capture with invalid destiation Path', function(done) {
        exec(cmd + ` -c ${noPermDirPath}`, function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
                expect(stderr).toContain("ares-device ERR! [syscall failure]: EACCES: permission denied");
                expect(stderr).toContain("ares-device ERR! [Tips]: No permission to execute. Please check the directory permission");
            }
            done();
        });
    });

    it('Capture with invalid display ID', function(done) {
        exec(cmd + ` -c --display 10`, function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
                expect(stderr).toContain("ares-device ERR! [com.webos.surfacemanager failure]: luna-send command failed <ERR_INVALID_DISPLAY>");
                expect(stderr).toContain("ares-device ERR! [Tips]: Please use a valid value for display id");
            }
            done();
        });
    });
});
