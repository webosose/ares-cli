/*
 * Copyright (c) 2023 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const exec = require('child_process').exec,
    common = require('../common-spec'),
    inspecter = require('../../../lib/inspect'),
    async = require('async');

const aresCmd = 'Inspecter',
    inspectOptions = {
        open: true,
    };

let options;

beforeAll(function (done) {
    common.getOptions()
    .then(function(result) {
        options = result;
        done();
    });
});

describe("Test setting", function() {
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

    it('Install sample ipk to device', function(done) {
        const installCmd = common.makeCmd('ares-install');
        exec(installCmd + ` ${options.ipkPath}`, function (error, stdout, stderr) {
            if (stderr && stderr.length > 0) {
                common.detectNodeMessage(stderr);
            }
            expect(stdout).toContain("Success");
            done();
        });
    });
});

describe(aresCmd + '.inspect()', function() {
    it('Run web inspector for sample app', function(done) {
        inspectOptions.appId = options.pkgId;
        async.waterfall([
            inspecter.inspect.bind(inspecter, inspectOptions),
            function(inspectInfo, next) {
                expect(inspectInfo.msg).toContain('Application Debugging - http://localhost');
                setTimeout(() => {
                    inspecter.stop(inspectInfo.session, next);
                }, 5000);
            }
        ], function(err, results) {
            expect(results.msg).toContain('This inspection has stopped');
            done();
            delete inspectOptions.appId;
        });
    });
});

describe(aresCmd + '.inspect()', function() {
    it('Run service inspector for sample service', function(done) {
        inspectOptions.serviceId = options.pkgService;
        async.waterfall([
            inspecter.inspect.bind(inspecter, inspectOptions),
            function(inspectInfo, next) {
                expect(inspectInfo.msg).toContain('To debug your service, set');
                expect(inspectInfo.msg).toContain("Cannot support \"--open option\" on platform node version 8 and later");
                setTimeout(() => {
                    inspecter.stop(inspectInfo.session, next);
                }, 7000);
            }
        ], function(err, results) {
            expect(results.msg).toContain('This inspection has stopped');
            done();
        });
    });
});