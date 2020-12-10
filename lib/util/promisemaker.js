/*
 * Copyright (c) 2020 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const BluebirdPromise = require('bluebird');

function promiseMaker(childProc) {
    return new BluebirdPromise(function(resolve, reject) {
        childProc.addListener('error', function(code) {
            reject({exitCode: code});
        });
        childProc.addListener('exit', function(code) {
            if (code === 0) resolve();
            else reject({exitCode: code});
        });
    });
}

module.exports = promiseMaker;
