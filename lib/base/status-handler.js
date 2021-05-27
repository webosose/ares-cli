/*
 * Copyright (c) 2021 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const log = require('npmlog');
const ora = require('ora');

(function () {
    const spinner = ora({ 
        text : 'Processing\n',
        color : "white",
        //spinner : "star"
        //frames : ['-', '+', '-'],
        spinner : "simpleDots",
        interval : 300,
        stream :  process.stdout
    });

    const statusHdlr = {},
        StatusMsgMap = {
            // ares-device common
            "SET_TARGET_DEVICE" : "Set target device",
            "FILE_SAVED_TO_LOCAL" : "Capture file copy to local host",
        };

        statusHdlr.startSpinner = function(text) {
        if (text) {
            spinner.text = text ;
        }
        if (!spinner.isSpinning) {
            spinner.start();
        }
    };

    statusHdlr.stopSpinner = function() {
        if (spinner.isSpinning) {
            spinner.stop();
        }
    };

    statusHdlr.stopAndPersistSpinner = function() {
        // case #1. green mark and stop
        // if(spinner.isSpinning) {
        //     //spinner.succeed("Done");
        //     spinner.succeed();
        // }

        //case #2
        if(spinner.isSpinning) {
            spinner.text = "";
            spinner.stopAndPersist({
                //symbol :'v',
                prefixText : "... Processing",
                text : ""
            });
        }
    };

    // Pure CLI status message : errKey(string), option, value
    statusHdlr.printStatusMsg = function(key, option, value) {
        log.info("statusHdlr#printStatusMsg():", "Key:", key, "option:", option, "value:", value);
        
        // return errKey when errKey is null
        if (!key) {
            return key;
        }

        let mapStatusMsg = "";
        // Create Tips message
        mapStatusMsg = statusHdlr.getStatusMsgFromMap(key, option, value);

        if (mapStatusMsg) {
            //console.log("[Status] " + mapStatusMsg);
            console.log(mapStatusMsg);
        } else {
            console.log(key);
        }
        return ;
    };

    statusHdlr.getStatusMsgFromMap = function(key, option, value) {
        log.info("statusHdlr#getStatusMsgFromMap():", "Key:", key, "option:", option, "value:", value);
        
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
        module.exports = statusHdlr;
    }
}());
