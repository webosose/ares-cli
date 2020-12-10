/*
 * Copyright (c) 2020 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const exec = require('child_process').exec,
    common = require('./common-spec');

const aresCmd = 'ares-config';

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

describe(aresCmd + ' --profile(-p)', function() {
    it("Set a device profile to ose", function(done) {
        exec(cmd + ' -p ose', function (error, stdout) {
            expect(stdout).toContain("profile and config data is changed to ose");
            done();
        });
    });

    it("Set a device profile input", function(done) {
        exec(cmd + ` -p ${options.profile}`, function (error, stdout) {
            expect(stdout).toContain(`profile and config data is changed to ${options.profile}`);
            done();
        });
    });
});

describe(aresCmd + ' --prefile-details(-c)', function() {
    it("Set a device profile to configure", function(done) {
        exec(cmd + ' -c', function (error, stdout) {
            expect(stdout).toContain(`Current profile set to ${options.profile}`, error);
            done();
        });
    });
});
