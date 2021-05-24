/*
 * Copyright (c) 2021 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const log = require('npmlog');
const ora = require('ora');

(function () {
    const spinner = ora('processing ...');
    spinner.stream =  process.stdout;
    const statusMsgHdlr = {},
        StatusMsgMap = {
            // ares-device common
            "SET_TARGET_DEVICE" : "set target device",
            "FILE_SAVED_TO_LOCAL" : "capture file copy to local host",

            "RUN_SERVER" : "capture file copy to local host",

            //ares-install
            "INSTALL_PACAKGE" :"installing package"
        };

    statusMsgHdlr.startSpinner = function(text){
        spinner.text = text ;
        spinner.start();
    };

    statusMsgHdlr.stopSpinner = function(){
        spinner.stop();
    };

    // Pure CLI status message : errKey(string), option, value
    statusMsgHdlr.printStatusMsg = function(key, option, value) {
        log.info("statusMsgHdlr#printStatusMsg():", "Key:", key, "option:", option, "value:", value);
        
        // return errKey when errKey is null
        if (!key) {
            return key;
        }

        let mapStatusMsg = "";
        // Create Tips message
        mapStatusMsg = statusMsgHdlr.getStatusMsgFromMap(key, option, value);

        if (mapStatusMsg) {
            console.log("[Status] " + mapStatusMsg);
        } else {
            console.log("[Status] " + key);
        }
        return ;
    };

    statusMsgHdlr.getStatusMsgFromMap = function(key, option, value) {
        log.info("statusMsgHdlr#getStatusMsgFromMap():", "Key:", key, "option:", option, "value:", value);
        
        if (!key) {
            return key;
        }

        let returnMsg;
        if (typeof key === 'string') {
            for (const k in StatusMsgMap) {
                if (key.toString() === k || key.includes(k)) {
                    returnMsg = StatusMsgMap[k];
                    if (option) {
                        returnMsg = returnMsg + " <" + option+ ">";
                    }
                    if (value) {
                        returnMsg = returnMsg + " : " + value;
                    }
                    break;
                }
            }
        }
        return returnMsg;
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = statusMsgHdlr;
    }
}());
