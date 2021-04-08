/*
 * Copyright (c) 2020 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const util = require('util'),
    async = require('async'),
    npmlog = require('npmlog'),
    fs = require('fs'),
    path = require('path'),
    novacom = require('./base/novacom'),
    errHndl = require('./base/error-handler');

(function() {

    const log = npmlog;
    log.heading = 'log';
    log.level = 'warn';

    const logLib = {

        /**
         * @property {Object} log an npm log instance
         */
        log: log,

        show: function(options, next) {
            log.info("log#show");
            if (typeof next !== 'function') {
                throw errHndl.changeErrMsg("MISSING_CALLBACK", "next", util.inspect(next));
            }

            options = options || {};
            async.series([
                _generateCmd,
                _makeSession,
                function(next){
                    options.session.run(options.cmd, process.stdin, _onData, process.stderr, next);
                }
            ],  function(err) {
                next(err, null);
            });

            function _generateCmd(next) {
                generateCmd(options, next);
            }

            function _makeSession(next) {
                makeSession(options, next);
            }

            function _onData(data) {
                var str = (Buffer.isBuffer(data))? data.toString():data;
                console.log(str);
            }
        },

        save: function(options, next) {
            log.info("log#save");
            if (typeof next !== 'function') {
                throw errHndl.changeErrMsg("MISSING_CALLBACK", "next", util.inspect(next));
            }

            options = options || {};
            async.series([
                _generateCmd,
                _makeSession,
                _createLogFile,
                function(next){
                    options.session.run(options.cmd, process.stdin, _onData, process.stderr, next);
                },
            ],  function(err) {
                next(err, null);
            });

            function _createLogFile(next) {
                log.info("log#_generateFileName");

                if (options.argv.save === "true") {
                    options.argv.save = _createDefaultFileName();
                }
                
                if (path.extname(options.argv.save) === ""){
                    options.argv.save += ".log"
                }
            
                if (path.extname(options.argv.save) === "."){
                    options.argv.save += "log"
                }
            
                options.argv.save = path.join(path.resolve("."), options.argv.save);
                if (fs.existsSync(options.argv.save)) {
                    fs.unlinkSync(options.argv.save);
                }
                next();
            }
            
            function _createDefaultFileName() {
                // Log file name generate : yyyymmdd_hhmmss.log"
                log.info("log#_createDefaultFileName");
                return __getDate() + ".log";

                function __getDate(){
                    const curDate = new Date();
                    const dateFormat = __pad(curDate.getFullYear(), 2)
                        +  __pad((curDate.getMonth()+1), 2)
                        + __pad(curDate.getDate(), 2)
                        + "_"
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

            function _generateCmd(next) {
                generateCmd(options, next);
            }

            function _onData(data) {
                var str = (Buffer.isBuffer(data))? data.toString():data;
                console.log(str); //Do Not Remove
                fs.writeFileSync(options.argv.save, data, {encoding: 'utf8', flag:'a'});
            }

            function _makeSession(next) {
                makeSession(options, next);
            }
        },
    };

    function generateCmd(options, next) {
        log.info("log#generateCmd");
    
        if (options.currentDaemon === "pmLogd") {
            // to-do
        } else if (options.currentDaemon === "journald") {
            let idx;
            const reservedOption = ["--level", "--device", "--save"];
            reservedOption.forEach(function(item){
                idx = options.argv.argv.cooked.indexOf(item);
                if (idx > -1) {
                    options.argv.argv.cooked.splice(idx,1);
                    options.argv.argv.cooked.splice(idx,1);
                }
            });
    
            if (options.argv.pid) {
                idx = options.argv.argv.cooked.indexOf("-pid");
                if (idx == -1){
                    idx = options.argv.argv.cooked.indexOf("--pid");
                }

                if (idx > -1) {
                    options.argv.argv.cooked.splice(idx, 1, "_PID=");
                }
            }

            if(options.argv.since){
                idx = options.argv.argv.cooked.indexOf("--since");
    
                let sinceTmp = options.argv.argv.cooked[idx+1];
                if (options.argv.argv.cooked[idx+2]) {
                    sinceTmp += " " + options.argv.argv.cooked[idx+2];
                }
                options.argv.argv.cooked.splice(idx+1, 2, "\"" + sinceTmp + "\"");
            }
    
            if(options.argv.until){
                idx = options.argv.argv.cooked.indexOf("--until");
                let untilTmp = options.argv.argv.cooked[idx+1];
                if (options.argv.argv.cooked[idx+2]) {
                    untilTmp += " " + options.argv.argv.cooked[idx+2];
                }
                options.argv.argv.cooked.splice(idx+1, 2, "\"" + untilTmp + "\"");
            }
 
            options.cmd = `journalctl ${options.argv.argv.cooked.join(" ")}`;
            options.cmd = options.cmd.replace("_PID= ", "_PID=");
        }
        next();
    }

    function makeSession(options, next){
        options.session = new novacom.Session(options.device, next);
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = logLib;
    }
}());
