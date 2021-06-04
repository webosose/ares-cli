/*
 * Copyright (c) 2021 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const util = require('util'),
    async = require('async'),
    npmlog = require('npmlog'),
    fs = require('fs'),
    path = require('path'),
    novacom = require('./base/novacom'),
    errHndl = require('./base/error-handler'),
    sessionLib = require('./session');

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
                throw errHndl.getErrMsg("MISSING_CALLBACK", "next", util.inspect(next));
            }

            options = options || {};
            async.series([
                _makeSession,
                _checkUser,
                _getSession,
                _createLogFile,
                _generateCmd,
                function(next){
                    options.session.run(options.cmd, process.stdin, _onData, process.stderr, next);
                },
            ],  function(err) {
                if (options.argv.save) {
                    next(err, {msg : "\nCreated " + options.argv.argv.remain[0] + "\nSuccess"});
                } else {
                    next(err, null);
                }
            });

            function _getSession(next) {
                log.info("log#_getSession");
                if (options.display) {
                    options.returnWithError = true;
                    sessionLib.getSessionList(options, next);
                } else {
                    next();
                }
            }

            function _generateCmd(next) {
                log.info("log#_generateCmd");
                generateCmd(options, next);
            }

            function _onData(data) {
                log.info("log#_onData");
                const str = (Buffer.isBuffer(data))? data.toString() : data;
                console.log(str); // Do not remove

                if (options.argv.save) {
                    fs.writeFileSync(options.argv.argv.remain[0], data, {encoding: 'utf8', flag:'a'});
                }
            }

            function _createLogFile(next) {
                log.info("log#_createLogFile");
                if (options.argv.save) {
                    createLogFile(options, next);
                } else {
                    next();
                }
            }

            function _makeSession(next) {
                makeSession(options, next);
            }

            function _checkUser(next) {
                checkUser(options, next);
            }
        },

        readMode: function(options, next) {
            log.info("log#readMode");
            if (typeof next !== 'function') {
                throw errHndl.getErrMsg("MISSING_CALLBACK", "next", util.inspect(next));
            }

            options = options || {};
            async.series([
                _makeSession,
                _checkUser,
                _getLogDir,
                _generateCmd,
                _createLogFile,
                function(next){
                    options.session.run(options.cmd, process.stdin, _onData, process.stderr, next);
                },
            ],  function(err) {
                if (options.argv.save) {
                    next(err, {msg : "\nCreated " + options.argv.argv.remain[0] + "\nSuccess"});
                } else {
                    next(err, null);
                }
            });

            function _getLogDir(next) {
                log.info("log#_getLogDir");
                const getLogDirCmd = "ls /run/log/journal/";
                options.session.run(getLogDirCmd, process.stdin, _onDirData, process.stderr, next);
            }

            function _onDirData(data) {
                log.info("log#_onDirData");
                options.logDir = (Buffer.isBuffer(data)) ? data.toString() : data;
                options.logDir = options.logDir.trim();
            }

            function _generateCmd(next) {
                log.info("log#_generateCmd");
                if (options.argv.file === "true") {
                    return next(errHndl.getErrMsg("EMPTY_FILENAME"));
                }

                if (options.argv.file) {
                    options.cmd = "journalctl --file /run/log/journal/" + options.logDir + "/" + options.argv.file;
                    if (options.argv.output) {
                        options.cmd += " --output " + options.argv.argv.remain;
                    }
                }

                if (options.argv['file-list']) {
                    options.cmd = "ls /run/log/journal/" + options.logDir;
                }

                log.info("options.cmd: " + options.cmd);
                next();
            }

            function _createLogFile(next){
                log.info("log#_createLogFile");
                if (options.argv.save) {
                    createLogFile(options, next);
                } else {
                    next();
                }
            }

            function _onData(data) {
                log.info("log#_onData");
                const str = (Buffer.isBuffer(data))? data.toString() : data;
                console.log(str); // Do not remove

                if (options.argv.save) {
                    fs.writeFileSync(options.argv.argv.remain[0], data, {encoding: 'utf8', flag:'a'});
                }
            }

            function _makeSession(next) {
                makeSession(options, next);
            }

            function _checkUser(next) {
                checkUser(options, next);
            }
        },

        printUnitList: function(options, next) {
            log.info("log#printUnitList");
            if (typeof next !== 'function') {
                throw errHndl.getErrMsg("MISSING_CALLBACK", "next", util.inspect(next));
            }

            options = options || {};
            async.series([
                _makeSession,
                _checkUser,
                _getSession,
                _generateCmd,
                function(next){
                    options.session.run(options.cmd, process.stdin, _onData, process.stderr, next);
                },
            ],  function(err) {
                next(err, null);
            });

            function _getSession(next) {
                log.info("log#_getSession");
                if (options.display) {
                    options.returnWithError = true;
                    sessionLib.getSessionList(options, next);
                } else {
                    next();
                }
            }

            function _generateCmd(next) {
                log.info("log#_generateCmd");
                options.cmd = "systemctl list-units --type service";

                if (options.sessionId) {
                    options.cmd = "systemctl --user list-units --type service";
                    options.cmd = `su ${options.sessionId} -l -c "${options.cmd}"`;
                }

                log.info("options.cmd: " + options.cmd);
                next();
            }

            function _onData(data) {
                log.info("log#_onData");
                const str = (Buffer.isBuffer(data))? data.toString() : data;
                const exp = /(\s\w[\S]*\.service)/g;

                if (Array.isArray(str.match(exp))) {
                    str.match(exp).forEach(function(item) {
                        console.log(item.trim()); // Do not remove
                    });
                }
            }

            function _makeSession(next) {
                makeSession(options, next);
            }

            function _checkUser(next) {
                checkUser(options, next);
            }
        }
    };

    function makeSession(options, next){
        log.info("log#makeSession");
        if (!options.session) {
            options.session = new novacom.Session(options.device, next);
        }
    }

    function checkUser(options, next) {
        log.info("log#checkUser");
        if (options.session.getDevice().username !== 'root') {
            return next(errHndl.getErrMsg("NEED_ROOT_PERMISSION"));
        } else {
            next();
        }
    }

    function generateCmd(options, next) {
        log.info("log#generateCmd");

        if (options.currentDaemon === "pmlogd") {
            // to-do
        } else if (options.currentDaemon === "journald") {
            if (options.display && !options.argv.unit) {
                return next(errHndl.getErrMsg("INVALID_COMBINATION"));
            }

            const reservedOption = ["--level", "--device", "--save"];
            let idx;

            reservedOption.forEach(function(item){
                idx = options.argv.argv.cooked.indexOf(item);
                if (idx > -1) {
                    options.argv.argv.cooked.splice(idx, 1);
                    options.argv.argv.cooked.splice(idx, 1);
                }
            });
    
            if (options.argv.pid) {
                idx = options.argv.argv.cooked.indexOf("-pid");

                if (idx === -1) {
                    idx = options.argv.argv.cooked.indexOf("--pid");
                }

                if (idx > -1) {
                    options.argv.argv.cooked.splice(idx, 1, "_PID=");
                }
            }

            if (options.argv.since) {
                if (options.argv.argv.remain.length > 0) {
                    idx = options.argv.argv.cooked.indexOf("--since");

                    let sinceTmp = options.argv.argv.cooked[idx+1];
                    if (options.argv.argv.cooked[idx+2]) {
                        sinceTmp += " " + options.argv.argv.cooked[idx+2];
                    }

                    options.argv.argv.cooked.splice(idx+1, 2, "\"" + sinceTmp + "\"");
                }
            }
    
            if (options.argv.until) {
                if (options.argv.argv.remain.length > 0) {
                    idx = options.argv.argv.cooked.indexOf("--until");

                    let untilTmp = options.argv.argv.cooked[idx+1];
                    if (options.argv.argv.cooked[idx+2]) {
                        untilTmp += " " + options.argv.argv.cooked[idx+2];
                    }

                    options.argv.argv.cooked.splice(idx+1, 2, "\"" + untilTmp + "\"");
                }
            }
 
            options.cmd = `journalctl ${options.argv.argv.cooked.join(" ")}`;
            options.cmd = options.cmd.replace('_PID= ', '_PID=');

            if (options.display && options.argv.unit) {
                idx = options.argv.argv.cooked.indexOf("--unit");
                options.argv.argv.cooked.splice(idx, 1, "--user-unit");

                idx = options.argv.argv.cooked.indexOf("--display");
                options.argv.argv.cooked.splice(idx,2);

                options.cmd = `journalctl ${options.argv.argv.cooked.join(" ")}`;
                options.cmd = `su ${options.sessionId} -l -c "${options.cmd}"`;
            }
            log.info("options.cmd: " + options.cmd);
        }
        next();
    }

    function createLogFile(options, next) {
        log.info("log#createLogFile");
        if (options.argv.argv.remain.length === 0) {
            options.argv.argv.remain[0] = path.resolve(_createDefaultFileName());
        } else {
            if (path.extname(options.argv.argv.remain[0]) === "") {
                options.argv.argv.remain[0] = options.argv.argv.remain[0] + ".log";
            }

            if (path.extname(options.argv.argv.remain[0]) === ".") {
                options.argv.argv.remain[0] = options.argv.argv.remain[0] + "log";
            }

            options.argv.argv.remain[0] = path.resolve(options.argv.argv.remain[0]);
            if (fs.existsSync(options.argv.argv.remain[0])) {
                fs.unlinkSync(options.argv.argv.remain[0]);
            }
        }

        log.info("options.argv.argv.remain[0]: " + options.argv.argv.remain[0]);
        next();
    }

    function _createDefaultFileName() {
        log.info("log#_createDefaultFileName");
        // Default log file name generate : yyyymmdd_hhmmss.log"
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

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = logLib;
    }
}());
