/*
 * Copyright (c) 2020 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const errHndl = require('../base/error-handler');

// Return a file name based on Date.
function createDateFileName(separator) {
    return __getDate();
    
    function __getDate(){
        const curDate = new Date();
        const dateFormat = __pad(curDate.getFullYear(), 2)
            +  __pad((curDate.getMonth()+1), 2)
            + __pad(curDate.getDate(), 2)
            + separator
            + __pad(curDate.getHours(), 2)
            + __pad(curDate.getMinutes(), 2)
            + __pad(curDate.getSeconds(), 2);
        return dateFormat;
    }

    function __pad(number, length) {
        let str = '' + number;
        while (str.length < length) {
            str = '0' + str;
        }
        return str;
    }
}

module.exports.createDateFileName = createDateFileName;
