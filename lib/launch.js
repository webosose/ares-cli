/*
 * Copyright (c) 2020 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const util = require('util'),
    async = require('async'),
    npmlog = require('npmlog'),
    luna = require('./base/luna'),
    path = require('path'),
    inspector = require('./inspect'),
    installer = require('./install'),
    novacom = require('./base/novacom'),
    errHndl = require('./base/error-handler'),
    sessionLib = require('./session'),
    os = require( 'os' );

(function() {
    const log = npmlog;
    log.heading = 'launcher';
    log.level = 'warn';

    const launcher = {
        /**
         * @property {Object} log an npm log instance
         */
        log: log,

        /**
         * Launch the given application id
         * @param {Object} options
         * @property options {String} device the device to connect to
         * @property options {Boolean} inspect run the application with web-inspector turned on
         */
        launch: function(options, id, params, next) {
            if (typeof next !== 'function') {
                throw errHndl.getErrMsg("MISSING_CALLBACK", "next", util.inspect(next));
            }
            const self = this,
                hostedAppId = "com.sdk.ares.hostedapp";
            let hostedAppInstalled = false;
            options = options || {};

            async.series([
                _checkInstalledApp,
                _checkRunningApp,
                _installHostedApp,
                _makeSession,
                _runAppServer,
                _setAppServerInfo,
                _getSessionList,
                _checkDisplayAffinity,
                _launch,
                _runInspector
            ],  function(err, results) {
                log.verbose("launcher#launch()", "err: ", err, "results:", results);
                const result = results[7];
                if (!err) {
                    result.msg = "Launched application " + id;
                    if (self.displayId !== undefined) {
                        result.msg += " on display " + self.displayId;
                    }
                }
                next(err, result);
            });

            function _checkInstalledApp(next){
                if (options.installMode === "Hosted") {
                    installer.list(options, function(err, result) {
                        for (const index in result) {
                            if (result[index].id === hostedAppId) {
                                hostedAppInstalled = true;
                                break;
                            }
                        }
                        next(err);
                    });
                } else {
                    next();
                }
            }

            function _checkRunningApp(next){
                if (options.installMode === "Hosted") {
                    self.listRunningApp(options, function(err, result) {
                        for (const index in result) {
                            if (result[index].id === hostedAppId) {
                                self.close(options,hostedAppId, params, next);
                                return;
                            }
                        }
                        next(err);
                    });
                } else {
                    next();
                }
            }

            function _installHostedApp(next) {
                if (options.installMode === "Hosted" && !hostedAppInstalled) {
                    const hostedAppUrl = path.join(__dirname,hostedAppId + ".ipk");
                    options.appId = id;
                    installer.install(options, hostedAppUrl, next);
                } else {
                    next();
                }
            }

            function _makeSession(next) {
                options.nReplies = 1; // -n 1
                if (!options.session) {
                    options.session = new novacom.Session(options.device, next);
                } else {
                    next();
                }
            }

            function _runAppServer(next){
                if (options.installMode === "Hosted") {
                    options.session.runHostedAppServer(options.hostedurl, next);
                    console.log("Ares Hosted App is now running...");
                } else {
                    next();
                }
            }

            function _setAppServerInfo(next) {
                if (options.installMode === "Hosted") {
                    const networkInterfaces = os.networkInterfaces();
                    let localIP = "";

                    for (const devName in networkInterfaces) {
                        for(let index = 0; index < networkInterfaces[devName].length; index++) {
                            const alias = networkInterfaces[devName][index];
                            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                                localIP = localIP || alias.address;
                                options.localIP = localIP;
                            }
                        }
                    }
                    const port = options.session.getHostedAppServerPort();
                    if (params === null) {
                        params = {};
                    }
                    params.hostedurl = "http://"+ localIP + ":" + port + "/";
                }
                next();
            }

            function _getSessionList(next) {
                sessionLib.getSessionList(options, next);
            }

            function _checkDisplayAffinity(next) {
                checkDisplayAffinity(options, params, next);
            }

            function _launch(next) {
                const target = options.session.getDevice(),
                    addr = target.lunaAddr.launch,
                    returnValue = addr.returnValue.split('.'),
                    param = {
                        // luna param
                        id: id,
                        subscribe: false,
                        params: params
                    };

                luna.send(options, addr, param, function(lineObj, next) {
                    log.silly("launcher#launch#_launch():", "lineObj:", lineObj);
                    let resultValue = lineObj;

                    for (let index = 1; index < returnValue.length; index++) {
                        resultValue = resultValue[returnValue[index]];
                    }

                    if (resultValue) {
                        // success: stop
                        log.verbose("launcher#launch#_launch():", "success");

                        // If sam returns "displayId" show displayId in result msg
                        if (lineObj.displayId !== undefined) {
                            self.displayId = lineObj.displayId;
                        }
                        next(null, {procId: resultValue});
                    } else {
                        // failure: stop
                        log.verbose("launcher#launch#_launch():", "failure");
                        next(errHndl.getErrMsg("INVALID_OBJECT"));
                    }
                }, next);
            }

            function _runInspector(next){
                if (options.inspect) {
                    options.appId = id;
                    options.running = true;

                    async.series([
                            inspector.inspect.bind(inspector, options, null),
                            function() {
                                // TODO: hold process to keep alive
                            }
                    ], function(err) {
                        next(err);
                    });
                } else if (options.installMode !== "Hosted") {
                    next();
                }
            }
        },
        /**
         * Close the given application id
         * @param {Object} options
         * @property options {String} device the device to connect to
         * @property options {Boolean} inspect run the application with web-inspector turned on
         */
        close: function(options, id, params, next) {
            if (typeof next !== 'function') {
                throw errHndl.getErrMsg("MISSING_CALLBACK", "next", util.inspect(next));
            }
            const self = this;
            options = options || {};

            async.series([
                _makeSession,
                _getSessionList,
                _checkDisplayAffinity,
                _close
            ], function(err, results) {
                log.verbose("launcher#close()", "err: ", err, "results:", results);
                // 2 steps in async.series, we want to
                // the value returned by the second
                // step (index=1)
                const result = results[2];
                if (!err && result) {
                    result.msg = "Closed application " + id;
                    if (self.displayId !== undefined) {
                        result.msg += " on display " + self.displayId;
                    }
                }
                next(err, result);
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
                sessionLib.getSessionList(options, next);
            }

            function _checkDisplayAffinity(next) {
                checkDisplayAffinity(options, params, next);
            }

            function _close(next) {
                const target = options.session.getDevice(),
                    addr = target.lunaAddr.terminate,
                    returnValue = addr.returnValue.split('.'),
                    param = {
                        // luna param
                        id: id,
                        subscribe: false,
                        params: params
                    };

                luna.send(options, addr, param, function(lineObj, next) {
                    log.silly("launcher#close#_close():", "lineObj:", lineObj);
                    let resultValue = lineObj;

                    for (let index = 1; index < returnValue.length; index++) {
                        resultValue = resultValue[returnValue[index]];
                    }

                    if (resultValue) {
                        // success: stop
                        log.verbose("launcher#close#_close():", "success");

                        // If sam returns "displayId" show displayId in result msg
                        if (lineObj.displayId !== undefined) {
                            self.displayId = lineObj.displayId;
                        }
                        next(null, { procId: resultValue});
                    } else {
                        // failure: stop
                        log.verbose("launcher#close#_close():", "failure");
                        next(errHndl.getErrMsg("INVALID_OBJECT"));
                    }
                }, next);
            }
        },

        /**
         * list the running applications
         * @param {Object} options
         * @property options {String} device the device to connect to
         * @property options {Boolean} inspect run the application with web-inspector turned on
         */
        listRunningApp: function(options, next) {
            if (typeof next !== 'function') {
                throw errHndl.getErrMsg("MISSING_CALLBACK", "next", util.inspect(next));
            }

            options = options || {};
            async.series([
                _makeSession,
                _getSessionList,
                _listRunningApp
            ], function(err, results) {
                log.verbose("launcher#listRunningApp():", "err:", err, "results:", results);
                next(err, results[2]);
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
                sessionLib.getSessionList(options, next);
            }

            function _listRunningApp(next) {
                const target = options.session.getDevice(),
                    addr = target.lunaAddr.running,
                    returnValue = addr.returnValue.split('.'),
                    param = {
                            // luna param
                        subscribe: false
                    };

                if (!addr || !returnValue) {
                    return next(errHndl.getErrMsg("NOT_SUPPORT_RUNNINGLIST"));
                }

                luna.send(options, addr, param, function(lineObj, next) {
                    let resultValue = lineObj;

                    for (let index = 1; index < returnValue.length; index++) {
                        resultValue = resultValue[returnValue[index]];
                    }
                    resultValue = resultValue || [];

                    if (lineObj.returnValue) {
                        // success: stop
                        log.verbose("launcher#listRunningApp():", "success");
                        next(null, resultValue);
                    } else {
                        // failure: stop
                        log.verbose("launcher#listRunningApp():", "failure");
                        next(errHndl.getErrMsg("INVALID_OBJECT"));
                    }
                }, next);
            }
        }
    };

    function checkDisplayAffinity(options, params, next) {
        // case of do not need to call session call(ose), check displayAffinity with display
        if (!options.sessionCall) {
            if (params && params.displayAffinity !== undefined && params.displayAffinity !== null) {
                if (typeof(params.displayAffinity) === 'string') {
                    next(errHndl.getErrMsg("INVALID_DISPLAY"));
                }

                if (options && options.display && (Number(options.display) !== params.displayAffinity)) {
                     if (Number(options.display) !== params.displayAffinity) {
                        next(errHndl.getErrMsg("UNMATCHED_DISPLAY_AFFINITY"));
                    }
                }
            } else {
                params.displayAffinity = 0;
                if (options && options.display) {
                    params.displayAffinity = Number(options.display);
                }
            }
        }
        next(null, {});
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = launcher;
    }
}());
