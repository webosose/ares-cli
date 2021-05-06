/*
 * Copyright (c) 2020 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable no-useless-escape */

const exec = require('child_process').exec,
    path = require('path'),
    fs = require('fs'),
    common = require('./common-spec');

const aresCmd = 'ares-log',
    savedlogPath = path.join(__dirname, "..", "tempFiles", "savedlog.log"),
    exp = /\w+ \d+ \d\d:\d\d:\d\d [\w|\d]+ [\w|\d|\.|\-]+\[\d+]:/g;

let cmd,
    options;

beforeAll(function (done) {
    cmd = common.makeCmd(aresCmd);
    common.removeOutDir(savedlogPath);
    common.getOptions()
    .then(function(result){
        options = result;
        done();
    });
});

afterAll(function (done) {
    common.removeOutDir(savedlogPath);
    done();
});

describe(aresCmd + " -h -v", function() {
    it("Print help message with verbose log", function(done) {
        exec(cmd + " -h -v", function (error, stdout, stderr) {
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

describe(aresCmd + " --device-list(-D)", function() {
    it("Show available device list", function(done) {
        exec(cmd + " -D", function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).toContain(options.device);
            done();
        });
    });
});

describe(aresCmd + " -cd", function() {
    it("Print current log daemon", function(done) {
        exec(cmd + " -cd", function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).toContain("Current log daemon is journald");
            done();
        });
    });
});

describe(aresCmd + " -sd", function() {
    it("Print current log daemon", function(done) {
        exec(cmd + " -sd journald", function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).toContain("Switched log daemon to journald");
            done();
        });
    });
});

describe(aresCmd + " -n 2", function() {
    it('Show log with --lines option', function(done) {
        exec(cmd + " -n 2", function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).toContain("-- Logs begin at");
            expect(stdout.match(exp).length).toBe(2);
            done();
        });
    });
});

describe(aresCmd + " -fl", function() {
    it("Print .journal log file list", function(done) {
        exec(cmd + " -fl", function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).toContain("system.journal");
            done();
        });
    });
});

describe(aresCmd + " --file", function() {
    it("Show log with --file option", function(done) {
        exec(cmd + " --file system.journal", function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).toContain("-- Logs begin at");
            expect(stdout.match(exp).length > 0).toBeTrue();
            done();
        });
    });
});

describe(aresCmd + " -ul", function() {
    it("Print unit list", function(done) {
        exec(cmd + " -ul", function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).toContain("bootd.service");
            done();
        });
    });
});

describe(aresCmd + " -ul -dp 1", function() {
    it("Print unit list with dp option", function(done) {
            exec(cmd + " -ul -dp 1", function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
                expect(stderr).toContain("This device does not support the session.");
            } else {
                expect(stdout).toContain("sam.service");
            }
            done();
        });
    });
});

describe(aresCmd + "-n 2 -s logfile", function() {
    it("Save log to file", function(done) {
        exec(cmd + ` -n 2 -s ${savedlogPath}`, function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(fs.existsSync(savedlogPath)).toBe(true);
            done();
        });
    });
});

describe(aresCmd + " -n 1 -o json", function() {
    it("Show log with output option", function(done) {
        exec(cmd + " -n 1 -o json", function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(typeof JSON.parse(stdout)).toBe('object');
            done();
        });
    });
});

describe(aresCmd + " -k", function() {
    it("Show kenel log with --kernel option", function(done) {
            exec(cmd + " -k", function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            } else {
                expect(stdout).toContain("-- Logs begin at");
            }
            done();
        });
    });
});

describe(aresCmd + " -b", function() {
    it("Show boot log with --boot option", function(done) {
            exec(cmd + " -b", function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            } else {
                expect(stdout).toContain("-- Logs begin at");
            }
            done();
        });
    });
});

describe(aresCmd + " --pid", function() {
    let pid;
    it("Get a pid from log", function(done) {
        const pidExp = /\w+ \d+ \d\d:\d\d:\d\d [\w|\d]+ [\w|\d|\.|\-]+\[(\d+)]:/;
            exec(cmd + " -n 1", function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            } else {
                expect(stdout).toContain("-- Logs begin at");
                expect(stdout.match(pidExp).length > 0).toBeTrue();
                pid = stdout.match(pidExp)[1];
                done();
            }
        });        
    });
    it("Show log with --pid option", function(done) {
            exec(cmd + ` --pid ${pid} -n 3`, function (error, stdout, stderr) {
            const expectedPid = `[${pid}]`;
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            } else {
                expect(stdout).toContain("-- Logs begin at");
                expect(stdout.match(expectedPid).length > 0).toBeTrue();
                done();
            }
        });
    });
});

describe(aresCmd + " --unit memorymanager", function() {
    it("Install sample ipk to device with ares-install", function(done) {
        const installCmd = common.makeCmd("ares-install");
        exec(installCmd + ` ${options.ipkPath}`, function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).toContain("Success", stderr);
            done();
        });
    });

    it("Launch sample App", function(done) {
        const launchCmd = common.makeCmd("ares-launch");
        exec(launchCmd + ` ${options.pkgId}`, function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).toContain(`Launched application ${options.pkgId}`, error);
            done();
        });
    });

    it("Show log with --unit option", function(done) {
            exec(cmd + " --unit memorymanager", function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            } else {
                const unitExp = /\w+ \d+ \d\d:\d\d:\d\d [\w|\d]+ memorymanager/g;
                expect(stdout).toContain("-- Logs begin at");
                expect(stdout.match(unitExp).length > 0).toBeTrue();
                done();
            }
        });
    });
});

describe(aresCmd +" -u sam -dp 1", function() {
    it("Show log with unit and dp option", function(done) {
            exec(cmd + " -u sam -dp 1", function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
                expect(stderr).toContain("This device does not support the session.");
            } else {
                const unitExp = /\w+ \d+ \d\d:\d\d:\d\d [\w|\d]+ sam/g;
                expect(stdout).toContain("-- Logs begin at");
                expect(stdout.match(unitExp).length > 0).toBeTrue();
            }
            done();
        });
    });
});

describe(aresCmd + " -S today", function() {
    it("Show log with --since option", function(done) {
            exec(cmd + " -S today", function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            } else {
                expect(stdout).toContain("-- Logs begin at");
            }
            done();
        });
    });
});

describe(aresCmd + " -U yesterday", function() {
    it("Show log with --until option", function(done) {
            exec(cmd + " -U yesterday", function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            } else {
                expect(stdout).toContain("-- Logs begin at");
            }
            done();
        });
    });
});

// negative tc
describe(aresCmd + " -aaa", function() {
    it("Not support option", function(done) {
            exec(cmd + " -aaa", function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
                expect(stderr).toContain("is not suppported \"aaa\" option");
            }
            done();
        });
    });
});

describe(aresCmd + " -f", function() {
    it("Show log with --follow option", function(done) {
        const child = exec(cmd + " -f");
        let result = "";

        child.stdout.on("data", function (data) {
            result += data;
        });

        child.stderr.on("data", function (data) {
            if (data && data.length > 0) {
                common.detectNodeMessage(data);
            }
            expect(data).toBeNull();
        });

        setTimeout(() => {
            child.kill();
            expect(result).toContain("-- Logs begin at");
            expect(result.match(exp).length > 0).toBeTrue();
            done();
        }, 1000);
    });
});

describe(aresCmd + " -r", function() {
    it("Show log with --reverse option", function(done) {
        const child = exec(cmd + " -r");
        let result = "";

        child.stdout.on('data', function (data) {
            result += data;
        });

        child.stderr.on('data', function (data) {
            if (data && data.length > 0) {
                common.detectNodeMessage(data);
            }
            expect(data).toBeNull();
        });

        setTimeout(() => {
            child.kill();
            expect(result).toContain('-- Logs begin at');
            expect(result.match(exp).length > 0).toBeTrue();
            done();
        }, 1000);
    });
});
