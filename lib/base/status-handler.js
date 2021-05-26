/*
 * Copyright (c) 2021 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const log = require('npmlog');
const ora = require('ora');

(function () {
    const spinner = ora({ 
        text : 'Processing',
        color : "white",
        //spinner : "star"
        //frames : ['-', '+', '-'],
        spinner : "simpleDots",
        interval : 300,
        stream :  process.stdout
    });

    const statusMsgHdlr = {},
        StatusMsgMap = {
            // ares-device common
            "SET_TARGET_DEVICE" : "Set target device",
            "FILE_SAVED_TO_LOCAL" : "Capture file copy to local host",
        };

    statusMsgHdlr.startSpinner = function(text) {
        if (text) {
            spinner.text = text ;
        }
        spinner.start();
    };

    statusMsgHdlr.stopSpinner = function() {
        if (spinner.isSpinning) {
            spinner.stop();
        }
    };

    statusMsgHdlr.succeedSpinner = function() {
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
            //console.log("[Status] " + mapStatusMsg);
            console.log(mapStatusMsg);
        } else {
            console.log(key);
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
