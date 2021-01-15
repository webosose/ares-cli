/*
 * Copyright (c) 2020 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const path = require('path'),
    fs = require('fs'),
    exec = require('child_process').exec,
    common = require('./common-spec');

const aresCmd = 'ares-setup-device',
    device = 'testDevice',
    initDevicePath = path.join(__dirname,"../../files/conf","novacom-devices.json");

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
const killUsedPort = function() {
    return new Promise(function(resolve){
        exec("lsof -i :3333 | grep node | awk '{print $2}'", function (error, stdout) {
            console.log("used port pid : " + (stdout? stdout.trim() : "not used"));
            exec("kill -9 " + stdout, function () {
                resolve(true);
            });
        });
    });
};

describe(aresCmd + ' -h -v', function() {
    it('Print help message with verbose log', function(done) {
        exec(cmd + ' -h -v', function (error, stdout, stderr) {
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

describe(aresCmd + ' --add(-a)', function() {
    it('Add DEVICE', function(done) {
        const host = '192.168.0.5';
        const port = '1234';
        const username = 'developer';
        exec(cmd + ` -a ${device} -i username=${username} -i host=${host} -i port=${port}`, function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).toContain(device);
            expect(stdout).toContain(host);
            expect(stdout).toContain(port);
            expect(stdout).toContain(username);
            expect(stdout).toContain("emulator");
            expect(stdout).toContain(options.device + " (default)");
            done();
        });
    });
});

describe(aresCmd + ' --add(-a)', function() {
    it('Add DEVICE as default property', function(done) {
        const host = '192.168.0.5';
        const port = '1234';
        const username = 'developer';
        const newDevice = 'test1';
        exec(cmd + ` -a ${newDevice} -i username=${username} -i host=${host} -i port=${port} -i default=true`, function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).toContain(newDevice);
            expect(stdout).toContain(host);
            expect(stdout).toContain(port);
            expect(stdout).toContain(username);
            expect(stdout).toContain(newDevice + " (default)");
            done();
        });
    });
});

describe(aresCmd + ' --list(-l)', function() {
    it('Should List all device information', function(done) {
        exec(cmd + ' --list', function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).toContain(device);
            done();
        });
    });
});

describe(aresCmd + ' --listfull(-F)', function() {
    it('Should List all device detail information', function(done) {
        exec(cmd + ' -F', function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).toContain(device);
            expect(stdout).toContain("description");
            done();
        });
    });
});

describe(aresCmd + ' --modify(-m)', function() {
    it('Modifiy DEVICE information', function(done) {
        const username = 'developer';
        const host = '192.168.0.1';
        const port = '4321';
        exec(cmd + ` -m ${device} -i username=${username} -i host=${host} -i port=${port}`, function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).toContain(username);
            expect(stdout).toContain(host);
            expect(stdout).toContain(port);
            done();
        });
    });
});

describe(aresCmd + ' --default(-f)', function() {
    it('Set default device', function(done) {
        exec(cmd + ` -f ${device}`, function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).toContain(device + " (default)");
            done();
        });
    });
});

describe(aresCmd + ' --remove(-r)', function() {
    it('Should remove added device information', function(done) {
        exec(cmd + ` -r ${device}`, function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).not.toContain(device);
            expect(error).toBeNull();
            expect(stdout).not.toContain(device);
            expect(stdout).toContain("emulator (default)");
            done();
        });
    });
});

describe(aresCmd + ' --search(-s), --timeout(-t)', function() {
    // Check only "Searching" print
    let checkDone = false;

    beforeEach(function(done) {
        killUsedPort()
        .then(function(){
            done();
        });
    });

    it('Search webOS Devices', function(done) {
        const child = exec(cmd + ' -s -t 1');
        let result;

        child.stdout.on('data', function (data) {
            process.stdout.write(data);
            result = data;
            if(!checkDone) {
                expect(data).toContain("Searching...");
                checkDone = true;
            }
        });

        child.stderr.on('data', function (data) {
            if (data && data.length > 0) {
                common.detectNodeMessage(data);
            }
            result = data;
            expect(data).toBeNull();
        });

        setTimeout(() => {
            child.kill();
            expect(result).not.toBeNull();
            done();
        }, 2000);
    });
});
describe(aresCmd + ' --reset(-R)', function() {
    it('Add DEVICE', function(done) {
        const host = '192.168.0.5';
        const port = '1234';
        const username = 'developer';
        exec(cmd + ` -a ${device} -i username=${username} -i host=${host} -i port=${port}`, function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).toContain(device);
            expect(stdout).toContain(host);
            expect(stdout).toContain(port);
            expect(stdout).toContain(username);
            done();
        });
    });

    it('Reset Device Info', function(done) {
        const initObj = JSON.parse(fs.readFileSync(initDevicePath));
        let initDevice;
        initObj.forEach(function(item) {
            if(item.profile === options.profile) {
                initDevice = item;
            }
        });

        exec(cmd + ' -R', function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).toContain(initDevice.name +" (default)");
            expect(stdout).toContain(initDevice.username);
            expect(stdout).toContain(initDevice.host);
            expect(stdout).toContain(initDevice.port);
            expect(stdout).toContain(initDevice.profile);
            done();
        });
    });
});
