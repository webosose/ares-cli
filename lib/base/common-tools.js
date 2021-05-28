/*
 * Copyright (c) 2020 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const help = require('./help-format'),
    version = require('./version-tools'),
    errMsg = require('./error-handler'),
    cliControl = require('./cli-control'),
    setupDevice = require('./setup-device'),
    Appdata = require('./cli-appdata'),
    sdkenv = require('./sdkenv');


(function() {
    const commonTools = {};

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = commonTools;
    }

    commonTools.help = help;
    commonTools.version = version;
    commonTools.errMsg = errMsg;
    commonTools.cliControl = cliControl;
    commonTools.setupDevice = setupDevice;
    commonTools.appdata = new Appdata();
    commonTools.sdkenv = new sdkenv.Env();
}());
