/*
 * Copyright (c) 2020 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const path = require('path'),
    fs = require('fs'),
    exec = require('child_process').exec,
    common = require('./common-spec');

const aresCmd = 'ares-server',
    sampleAppPath = path.join(__dirname, "..", "tempFiles/sampleApp");

let cmd,
    expectedTemplate;

beforeAll(function (done) {
    cmd = common.makeCmd(aresCmd);
    common.getExpectedResult("ares-generate")
    .then(function(result){
        expectedTemplate = result.template;
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
    beforeEach(function(done) {
        common.removeOutDir(sampleAppPath);
        done();
    });

    it('Generate sample app', function(done) {
        const generateCmd = common.makeCmd('ares-generate');
        exec(generateCmd + ` -t ${expectedTemplate.webapp} -p "id=com.domain.app" ${sampleAppPath}`, function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }

            let outputObj;
            try {
                const text = fs.readFileSync(path.join(sampleAppPath, "appinfo.json"));
                outputObj = JSON.parse(text);
            } catch (err) {
                console.error(err);
            }
            expect(outputObj.id).toBe("com.domain.app");
            expect(error).toBeNull();

            done();
        });
    });
});

describe(aresCmd, function() {
    it('Run a local web server', function(done) {
        const child = exec(cmd + ` ${sampleAppPath}`);
        let result;

        child.stdout.on('data', function (data) {
            process.stdout.write(data);
            result = data;
            expect(data).toContain('Local server running on http://localhost');
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
        }, 3000);
    });
});

describe(aresCmd + ' --open(o)', function() {
    it('Run a local web server on browser ', function(done) {
        const child = exec(cmd + ` ${sampleAppPath} -o`);
        let result;

        child.stdout.on('data', function (data) {
            process.stdout.write(data);
            result = data;
            expect(data).toContain('Local server running on http://localhost');
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
        }, 3000);
    });
});

describe(aresCmd +' --port', function() {
    afterEach(function(done) {
        common.removeOutDir(sampleAppPath);
        done();
    });

    it('Set port for running web server', function(done) {
        const port = Math.floor((Math.random()*(50000 - 10000 + 1)) + 10000);
        const child = exec(cmd + ` -p ${port} ${sampleAppPath}`);
        let result;

        child.stdout.on('data', function (data) {
            process.stdout.write(data);
            result = data;
            expect(data).toContain(`Local server running on http://localhost:${port}`);
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
        }, 3000);
    });
});