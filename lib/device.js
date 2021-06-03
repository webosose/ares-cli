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
    mkdirp = require('mkdirp'),
    chalk = require('chalk'),
    luna = require('./base/luna'),
    novacom = require('./base/novacom'),
    errHndl = require('./base/error-handler'),
    pullLib = require('./pull'),
    convertJsonToList = require('./../lib/util/json').convertJsonToList;

(function() {

    const log = npmlog;
    log.heading = 'device';
    log.level = 'warn';

    const device = {

        /**
         * @property {Object} log an npm log instance
         */
        log: log,

        /**
         * Print system information of the given device
         * @property options {String} device the device to connect to
         */
        systemInfo: function(options, next) {
            if (typeof next !== 'function') {
                throw errHndl.getErrMsg("MISSING_CALLBACK", "next", util.inspect(next));
            }
            options = options || {};
            async.series([
                _makeSession,
                _getOsInfo,
                _getDeviceInfo,
                _getChromiumVersion,
                _getQtbaseVersion,
            ],  function(err, results) {
                log.verbose("device#systemInfo()", "err: ", err, "results:", results);
                let resultTxt = "";
                for (let i = 1; i < results.length; i++) {
                    resultTxt += results[i] + "\n";
                }
                next(err, {msg : resultTxt.trim()});
            });

            function _makeSession(next) {
                options.nReplies = 1; // -n 1
                if (!options.session) {
                    options.session = new novacom.Session(options.device, next);
                } else {
                    next();
                }
            }

            function _getOsInfo(next) {
                log.info("device#systemInfo#_getOsInfo()");
                const target = options.session.getDevice(),
                    addr = target.lunaAddr.osInfo,
                    param = {
                            // luna param
                            parameters:["webos_build_id","webos_imagename","webos_name","webos_release",
                                        "webos_manufacturing_version", "core_os_kernel_version"],
                            subscribe: false
                        };

                luna.send(options, addr, param, function(lineObj, next) {
                    log.silly("device#systemInfo#_getOsInfo():", "lineObj:", lineObj);
                    const resultValue = lineObj;

                    if (resultValue.returnValue) {
                        log.verbose("device#systemInfo#_getOsInfo():", "success");
                        delete resultValue.returnValue; // remove unnecessary data
                        next(null, _makeReturnTxt(resultValue));
                    } else {
                        log.verbose("device#systemInfo#_getOsInfo():", "failure");
                        log.verbose('device#systemInfo#_getOsInfo(): luna-send command failed' +
                                    (resultValue.errorText ? ' (' + resultValue.errorText + ')' :
                                    (resultValue.errorMessage ? ' (' + resultValue.errorMessage + ')' : '')));
                    }
                }, next);
            }

            function _getDeviceInfo(next) {
                log.info("device#systemInfo#_getDeviceInfo()");
                const target = options.session.getDevice(),
                    addr = target.lunaAddr.deviceInfo,
                    param = {
                            // luna param
                            subscribe: false
                        };

                luna.send(options, addr, param, function(lineObj, next) {
                    log.silly("device#systemInfo#_getDeviceInfo():", "lineObj:", lineObj);
                    const resultValue = lineObj,
                        returnObj ={};

                    if (resultValue.returnValue) {
                        log.verbose("device#systemInfo#_getDeviceInfo():", "success");
                        returnObj.device_name = resultValue.device_name;
                        returnObj.device_id = resultValue.device_id;
                        next(null, _makeReturnTxt(returnObj));
                    } else {
                        log.verbose("device#systemInfo#_getDeviceInfo():", "failure");
                        log.verbose('device#systemInfo#_getDeviceInfo(): luna-send command failed' +
                                    (resultValue.errorText ? ' (' + resultValue.errorText + ')' :
                                    (resultValue.errorMessage ? ' (' + resultValue.errorMessage + ')' : '')));
                    }
                }, next);
            }

            function _getChromiumVersion(next) {
                log.info("device#systemInfo#_getChromiumInfo()");

                // opkg is required permission as root.
                if (options.session.getDevice().username !== 'root') {
                    return next(null, "chromium_version : " + "not supported");
                } else {
                    const cmd = '/usr/bin/opkg list-installed webruntime';
                    options.session.run(cmd, null, __data, null, function(err) {
                        if (err) {
                            return next(err);
                        }
                    });
                }
                function __data(data) {
                    const str = (Buffer.isBuffer(data)) ? data.toString() : data,
                        exp = /\d*\.\d*\.\d*\.\d*/,
                        version = str.match(exp);

                    next(null, "chromium_version : " + version);
                }
            }

            function _getQtbaseVersion(next) {
                log.info("device#systemInfo#_getQtbaseInfo()");

                // opkg is required permission as root.
                if (options.session.getDevice().username !== 'root') {
                    return next(null, "qt_version : " + "not supported");
                } else {
                    const cmd = '/usr/bin/opkg list-installed qtbase';
                    options.session.run(cmd, null, __data, null, function(err) {
                        if (err) {
                            return next(err);
                    }});
                }
                function __data(data) {
                    const str = (Buffer.isBuffer(data)) ? data.toString() : data,
                        exp = /\d*\.\d*\.\d*/,
                        version = str.match(exp);
                    next(null, "qt_version : " + version);
                }
            }

            function _makeReturnTxt(resultValue){
                log.info("device#systemInfo#_makeReturnTxt()");
                let returnTxt = "";

                for (const key in resultValue) {
                    if (resultValue[key] === undefined) {
                        resultValue[key] = "(unknown)";
                    }
                    returnTxt += key + " : " + resultValue[key] + "\n";
                }
                return returnTxt.trim();
            }
        },
        /**
         * Print session information of the given device
         * @property options {String} device the device to connect to
         */
        sessionInfo: function(options, next) {
            if (typeof next !== 'function') {
                throw errHndl.getErrMsg("MISSING_CALLBACK", "next", util.inspect(next));
            }
            options = options || {};
            async.series([
                _makeSession,
                _getSessionList
            ],  function(err, results) {
                log.verbose("device#sessionInfo()", "err: ", err, "results:", results);
                let resultTxt = "";

                if (results[1] !== undefined) {
                    if (typeof results[1] === "object") {
                        if(results[1].length === 0) {
                            return next(errHndl.getErrMsg("SELECT_PROFILE"));
                        }
                        for (let i = 0; i < results[1].length; i++) {
                            resultTxt += convertJsonToList(results[1][i], 0) + '\n';
                        }
                    } else {
                        resultTxt = results[1];
                    }
                }
                next(err, {msg : resultTxt.trim()});
            });

            function _makeSession(next) {
                options.nReplies = 1; // -n 1
                if (!options.session) {
                    options.session = new novacom.Session(options.device, next);
                } else {
                    next();
                }
            }

            function _getSessionList(next) {
                log.info("device#sessionInfo#_getSessionList()");
                const target = options.session.getDevice(),
                    addr = target.lunaAddr.getSessionList,
                    param = {
                        // luna param
                        subscribe: false
                    };

                luna.send(options, addr, param, function(lineObj, next) {
                    log.silly("device#sessionInfo#_getSessionList():", "lineObj:", lineObj);

                    if (lineObj.returnValue) {
                        log.verbose("device#sessionInfo#_getSessionList():", "success");
                        next(null, lineObj.sessionList);
                    } else {
                        log.verbose("device#sessionInfo#_getSessionList():", "failure" + lineObj.errorText);
                    }
                }, next);
            }
        },
        /**
         * get screen capture of the given device
         * @property options {String} device, display, outputPath
         */
        captureScreen: function(options, next) {
            log.info("device#capture#captureScreen()");
            if (typeof next !== 'function') {
                throw errHndl.getErrMsg("MISSING_CALLBACK", "next", util.inspect(next));
            }
            options = options || {};
            async.series([
                _makeSession,
                _makeCaptureOption,
                _captureScreenFile,
                _copyFileToLocal
            ],  function(err, results) {
                log.verbose("device#capture()", "err: ", err, "results:", results);
                const resultTxt = "Create " + chalk.green(options.captureFileName) + " to " + options.destinationPath +"\nSuccess";

                // clean up /tmp/aresCapture directory in target device
                if (options.createdTmpDir) {
                    _removeTmpDir(function finish(removeErr) {
                        next(err ? err : removeErr, {msg : resultTxt});
                    });
                } else {
                    next(err, {msg : resultTxt});
                }
            });

            function _makeSession(next) {
                options.nReplies = 1; // -n 1
                if (!options.session) {
                    options.session = new novacom.Session(options.device, next);
                } else {
                    next();
                }
            }

            function _makeCaptureOption(next) {
                log.info("device#capture#_makeCaptureOption()");
                let captureFileName = "",
                    destinationPath = "",
                    captureFormat = "PNG"; // PNG is default format

                if (options.outputPath === null){
                    captureFileName = _createDateFileName();
                    destinationPath = path.resolve('.');
                } else {
                    // Get directory path, file path, file Extenstion from given path
                    const parseDirPath = path.dirname(options.outputPath),
                        parseBase = path.parse(options.outputPath).base;

                    let parseExt = path.parse(options.outputPath).ext;
                    parseExt = parseExt.split('.').pop();

                    log.info("device#capture#_makeCaptureOption():" + " dir name : " + parseDirPath 
                        + " ,file name : " + parseBase + " ,inputFormat : " + parseExt);

                    // if given path has extension
                    if (parseBase && parseExt) {
                        if (parseExt === "png" || parseExt === "bmp" || parseExt === "jpg") {
                            captureFormat = parseExt.toUpperCase();
                        } else {
                            return setImmediate(next, errHndl.getErrMsg("INVALID_CAPTURE_FORMAT"));
                        }
                        captureFileName = parseBase;
                        destinationPath = path.resolve(parseDirPath);
                    } else if (parseBase && (parseExt === "")) {
                        // it's directory path. Use it as destination dir Path
                        captureFileName = _createDateFileName();
                        destinationPath = path.resolve(options.outputPath);
                    }
                }

                options.captureFormat = captureFormat;
                options.captureFileName = captureFileName;
                options.captureDirPath = "/tmp/aresCapture/";
                options.sourcePath = options.captureDirPath + captureFileName;
                options.destinationPath = destinationPath;
                options.ignore = true;
                options.silent = true;
                
                next();
            }

            function _createDateFileName() {
                // Capture file name generate : targetname_displayX_yyyymmddhhmmss.png"
                function __getDate(){
                    const curDate = new Date();
                    const dateFormat = __pad(curDate.getFullYear(), 2)
                        +  __pad((curDate.getMonth()+1), 2)
                        + __pad(curDate.getDate(), 2)
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

                const fileName = options.session.target.name + "_" + "display" + options.display + "_" + __getDate() + ".png";
                return fileName;
            }

            function _captureScreenFile(next) {
                log.info("device#capture#_captureScreenFile()");
                const cmd = "/bin/mkdir -p " + options.captureDirPath;
                options.session.run(cmd, null, null, null, function(err) {
                    if (err) {
                        return setImmediate(next, err);
                    } else {
                        options.createdTmpDir = true;
                        const target = options.session.getDevice(),
                            addr = target.lunaAddr.captureCompositorOutput,
                            param = {
                                // luna param
                                subscribe: false,
                                output : options.sourcePath,
                                format: options.captureFormat,
                                displayId : options.display
                            };

                        luna.send(options, addr, param, function(lineObj, next) {
                            log.silly("device#capture#_captureScreenFile():", "lineObj:", lineObj);
                            if (lineObj.returnValue) {
                                log.info("device#capture#_captureScreenFile():","Capture file in target : " + lineObj.output);
                                next(null, {});
                            }
                        }, next);
                    }
                });
            }

            function _copyFileToLocal(next) {
                log.info("device#capture#_copyFileToLocal()");
                if (!fs.existsSync(options.destinationPath)) {
                    mkdirp(options.destinationPath, function(err) {
                        if (err) {
                            return setImmediate(next, errHndl.getErrMsg(err));
                        } else {
                            pullLib.pull(options, next);
                        }
                    });
                } else {
                    pullLib.pull(options, next);
                }
            }

            function _removeTmpDir(next) {
                log.info("device#capture#_removeTmpDir()");
                const cmd = '/bin/rm -rf ' + options.captureDirPath;
                options.session.run(cmd, null, null, null, function(err) {
                    if (err) {
                        return setImmediate(next, err);
                    } else {
                        next();
                    }
                });
            }
        }
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = device;
    }
}());
