/*
 * Copyright (c) 2020 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const util = require('util'),
    async = require('async'),
    path = require('path'),
    npmlog = require('npmlog'),
    request = require('request'),
    luna = require('./base/luna'),
    novacom = require('./base/novacom'),
    server = require('./base/server'),
    sdkenv  = require('./base/sdkenv'),
    errHndl = require('./base/error-handler'),
    installer = require('./install'),
    launcher = require('./launch');

// The node service debugging ways has changed based on node version 8.
const nodeBaseVersion = "8",
    defaultAppInsptPort = "9998",
    defaultNodeInsptPort = "8080",
    defaultServiceDebugPort = "5885";
let platformNodeVersion = "0";

(function() {
    const log = npmlog;
    log.heading = 'inspector';
    log.level = 'warn';

    const inspector = {
        /**
         * @property {Object} log an npm log instance
         */
        log: log,

        inspect: function(options, params, next) {
            if (typeof next !== 'function') {
                throw errHndl.getErrMsg("MISSING_CALLBACK", "next", util.inspect(next));
            }

            options.svcDbgInfo = {}; /* { id : { port : String , path : String } } */
            if (options && Object.prototype.hasOwnProperty.call(options, 'serviceId')) {
                if (options.serviceId instanceof Array) {
                    options.serviceId.forEach(function(id) {
                        options.svcDbgInfo[id] = {};
                    });
                } else {
                    options.svcDbgInfo[options.serviceId] = {};
                }
            }

            async.series([
                _findSdkEnv,
                _getPkgList,
                _makeSession,
                _runApp,
                _runAppPortForwardServer,
                _runAppInspector,
                _runServicePortForwardServer,
                function(next) {
                    log.verbose("inspector#inspect()", "running...");
                    setImmediate(next);
                }
            ], function(err, results) {
                log.verbose("inspector#inspect()", "err: ", err, "results:", results);
                setImmediate(next, err);
            });

            function _findSdkEnv(next) {
                const env = new sdkenv.Env();
                env.getEnvValue("BROWSER", function(browserPath) {
                    options.bundledBrowserPath = browserPath;
                    next();
                });
            }

            function _getPkgList(next) {
                if (!options.serviceId) {
                    return next();
                }

                installer.list(options, function(err, pkgs) {
                    if (pkgs instanceof Array) {
                        options.instPkgs = pkgs;
                    }
                    next(err);
                });
            }

            function _makeSession(next) {
                options.nReplies = 1; // -n 1
                if (!options.session) {
                    options.session = new novacom.Session(options.device, next);
                } else {
                    next();
                }
            }

            function _runApp(next) {
                log.verbose("inspector#inspect()#_runApp");
                if (!options.appId || options.running) {
                    return next();
                }

                launcher.listRunningApp(options, function(err, runningApps) {
                    if (err) {
                        return next(err);
                    }

                    runningApps = [].concat(runningApps);
                    const runAppIds = runningApps.map(function(app) {
                        return app.id;
                    });

                    log.verbose("inspector#inspect()#_runApp#runAppIds", runAppIds.join(','));
                    if (runAppIds.indexOf(options.appId) === -1) {
                        log.verbose("inspector#inspect()#_runApp#launch", options.appId);
                        launcher.launch(options, options.appId, {}, next);
                    } else {
                        next();
                    }
                });
            }

            function _runAppPortForwardServer(next){
                if (options.appId) {
                    const insptPort = options.sessionInsptPort || defaultAppInsptPort;
                    log.verbose("inspector#inspect()#_runAppPortForwardServer()", "insptPort : " + insptPort);

                    options.session.forward(insptPort , options.hostPort || 0 /* random port */, options.appId, next);
                } else {
                    next();
                }
            }

            function _findNewDebugPort(dbgPort, next) {
                const format = "netstat -ltn 2>/dev/null | grep :%s | wc -l",
                    cmdPortInUsed = util.format(format, dbgPort);

                async.series([
                    options.session.run.bind(options.session, cmdPortInUsed, process.stdin, _onData, process.stderr),
                ], function(err) {
                    if (err) {
                        next(err);
                    }
                });

                function _onData(data) {
                    let str;
                    if (Buffer.isBuffer(data)) {
                        str = data.toString().trim();
                    } else {
                        str = data.trim();
                    }

                    if (str === "0") {
                        log.verbose("inspector#inspect()#_findNewDebugPort()", "final dbgPort : " + dbgPort);
                        next(null, dbgPort);
                    } else if (str === "1") {
                        dbgPort = Number(dbgPort) +1;
                        _findNewDebugPort(dbgPort, next);
                    } else {
                        return next(errHndl.getErrMsg("FAILED_GET_PORT"));
                    }
                }
            }

            function _getNodeVersion(next){
                const format = "node -v";
                let count = 0;

                async.series([
                    options.session.run.bind(options.session, format, process.stdin, _onData, process.stderr),
                ], function(err) {
                    if (err) {
                        next(err);
                    }
                });

                function _onData(data) {
                    if (++count > 1)
                        return;

                    if (Buffer.isBuffer(data)) {
                        platformNodeVersion = data.toString().trim();
                    } else {
                        platformNodeVersion = data.trim();
                    }

                    const parsedVersion = platformNodeVersion.split(".");
                    platformNodeVersion = Number(parsedVersion[0].substring(1, parsedVersion[0].length));
                    next();
                }
            }

            function _runServicePortForwardServer(next) {
                const svcIds = Object.keys(options.svcDbgInfo).filter(function(id) {
                    return id !== 'undefined';
                });
                async.forEachSeries(svcIds, __eachServicePortForward, function(err) {
                        next(err);
                    }
                );

                function __eachServicePortForward(serviceId, next) {
                    if (!serviceId) {
                        return next();
                    }

                    // Only for Auto, add display+1 in prefix port
                    const sessionPort = Number(options.display) +1;
                    let dbgPort = defaultServiceDebugPort;

                    if (options.sessionId && options.display !== undefined) {
                        dbgPort = sessionPort + dbgPort;
                    }

                    log.verbose("inspector#inspect()#_eachServicePortForward()", "sessionId : " + options.sessionId + ", default dbgPort : " + dbgPort);
                    const __printInspectGuide = function(svcId, next) {
                        if (options.open) {
                            console.log("Can not support \"--open option\" on platform node version 8 and later");
                        }

                        const guideText = "To debug your service, set " + "\"localhost:" + options.session.getLocalPortByName(svcId) +
                                            "\" on Node's Inspector Client(Chrome DevTools, Visual Studio Code, etc.).";
                        console.log(guideText);
                        next();
                    };

                    const __launchServiceInspector = function(svcId, next) {
                        if (!options.svcDbgInfo[svcId].port) {
                            return next();
                        }
                        // open browser with the following url.
                        // http://localhost:(host random port)/debug?port=(node debug port)
                        const ip = 'localhost',
                            nodeInsptPort = options.session.getLocalPortByName(svcId),
                            nodeDebugPort = options.svcDbgInfo[svcId].port,
                            urlFormat = "http://%s:%s/debug?port=%s",
                            nodeInsptUrl = util.format(urlFormat, ip, nodeInsptPort, nodeDebugPort);
                        let killTimer;

                        request.get(nodeInsptUrl, function(error, response) {
                            if (!error && response.statusCode === 200) {
                                console.log("nodeInsptUrl:", nodeInsptUrl);
                                server.runServer(__dirname, 0, _reqHandler, _postAction);
                                next();
                            }

                            function _reqHandler(code, res) {
                                if (code === "@@ARES_CLOSE@@") {
                                    res.status(200).send();
                                    killTimer = setTimeout(function() {
                                        process.exit(0);
                                    }, 2 * 1000);
                                } else if (code === "@@GET_URL@@") {
                                    clearTimeout(killTimer);
                                    res.status(200).send(nodeInsptUrl);
                                }
                            }

                            function _postAction(err, serverInfo) {
                                if (err) {
                                    process.exit(1);
                                } else if (serverInfo && serverInfo.msg && options.open) {
                                        const serverUrl = 'http://localhost:' + serverInfo.port + '/ares_cli/ares.html';
                                        server.openBrowser(serverUrl, options.bundledBrowserPath);
                                }
                            }
                        });
                    };

                    async.waterfall([
                        function findSvcFilePath(next) {
                            if (options.instPkgs) {
                                options.instPkgs.every(function(pkg) {
                                    if (serviceId.indexOf(pkg.id) !== -1) {
                                        options.svcDbgInfo[serviceId].path = path.join(path.dirname(pkg.folderPath), '..', 'services', serviceId).replace(/\\/g, '/');
                                        return false;
                                    }
                                    return true;
                                });
                            }
                            if (!options.svcDbgInfo[serviceId].path) {
                                return next(errHndl.getErrMsg("FAILED_GET_SVCPATH", serviceId));
                            }
                            next();
                        },
                        function parserMeta(next) {
                            const metaFilePath = path.join(options.svcDbgInfo[serviceId].path, "services.json").replace(/\\/g, '/'),
                                cmdCatServiceInfo = "cat " + metaFilePath;
                            let metaData;

                            async.series([
                                    options.session.run.bind(options.session,cmdCatServiceInfo, process.stdin, _onData, process.stderr)
                            ], function(err) {
                                if (err) {
                                    return next(errHndl.getErrMsg("FAILED_FIND_SERVICE", serviceId));
                                }
                            });

                            function _onData(data) {
                                if (Buffer.isBuffer(data)) {
                                    metaData = data.toString().trim();
                                } else {
                                    metaData = data.trim();
                                }
                                next(null, metaData);
                            }
                        },
                        function checkServiceType(metaData, next) {
                            try {
                                const metaInfo = JSON.parse(metaData);
                                if (metaInfo.engine === "native") {
                                    return next(errHndl.getErrMsg("USE_GDB", serviceId));
                                }
                                next();
                            } catch (err) {
                                next(err);
                            }
                        },
                        function quitPrevService(next) {
                            options.nReplies = 1;
                            const param = {},
                                addr = {
                                    "service": serviceId,
                                    "method": "quit"
                                };

                            luna.send(options, addr, param, function() {
                                next();
                            }, next);
                        },
                        function mkDirForDbgFile(next) {
                            const cmdMkDir = "mkdir -p " + options.svcDbgInfo[serviceId].path + "/_ares";
                            options.session.runNoHangup(cmdMkDir, next);
                        },
                        _findNewDebugPort.bind(this, dbgPort),
                        function makeDbgFile(port, next) {
                            dbgPort = port;
                            const cmdWriteDbgPort = "echo " + dbgPort + " > " + options.svcDbgInfo[serviceId].path + "/_ares/debugger-port";
                            options.session.runNoHangup(cmdWriteDbgPort, next);
                        },
                        function(next) {
                            setTimeout(function(){
                                next();
                            },1000);
                        },
                        function runService(next) {
                            const param = {},
                                addr = {
                                    "service": serviceId,
                                    "method": "info"
                                };
                            options.svcDbgInfo[serviceId].port = dbgPort;
                            options.nReplies = 1;

                            luna.send(options, addr, param, function() {
                                next();
                            }, next);
                        },
                        function(next) {
                            setTimeout(function() {
                                next();
                            },1000);
                        },
                        _getNodeVersion.bind(this),
                        function doPortForward(next){
                            log.info("inspector#inspect()#_doPortForward()", "platformNodeVersion: "+ platformNodeVersion + ", nodeBaseVersion: " + nodeBaseVersion);
                            if (platformNodeVersion < nodeBaseVersion) {
                                options.session.forward(defaultNodeInsptPort, options.hostPort || 0 /* random port */, serviceId, next);
                            }
                            else if (platformNodeVersion >= nodeBaseVersion) {
                                options.session.forward(dbgPort, options.hostPort || 0 /* random port */, serviceId, next);
                            }
                        },
                        function clearDbgFile(next) {
                            const cmdRmDbgFile = "rm -rf " + options.svcDbgInfo[serviceId].path + "/_ares";
                            options.session.runNoHangup(cmdRmDbgFile, next);
                        },
                        // FIXME: this code is need to improve.
                        function printGuide(next){
                            if (platformNodeVersion < nodeBaseVersion) {
                                __launchServiceInspector(serviceId, next);
                            }
                            else if (platformNodeVersion >= nodeBaseVersion) {
                                __printInspectGuide(serviceId, next);
                            }
                        }
                    ], function(err, results) {
                        log.verbose("inspector#inspect()", "err: ", err, "results:", results);
                        next(err, results);
                    });
                }
            }

            function _runAppInspector(next) {
                let url, killTimer,
                    listFiles = [
                    { reqPath: "/pagelist.json", propName: "inspectorUrl" }, /* AFRO, BHV */
                    { reqPath: "/json/list", propName: "devtoolsFrontendUrl" } /* DRD */
                ];

                function _getDisplayUrl(next) {
                    const listFile = listFiles.pop();
                    if (!listFile) {
                        return next();
                    }

                    request.get(url + listFile.reqPath, function (error, response, body) {
                        if (error || response.statusCode !== 200) {
                            return next();
                        }
                        const pagelist = JSON.parse(body);
                        for (const index in pagelist) {
                            if (pagelist[index].url.indexOf(options.appId) !== -1 ||
                                pagelist[index].url.indexOf(options.localIP) !== -1) {
                                if (!pagelist[index][listFile.propName]) {
                                    return next(errHndl.getErrMsg("USING_WEBINSPECTOR"));
                                }
                                url += pagelist[index][listFile.propName];
                                listFiles = [];
                                break;
                            }
                        }
                        next();
                    });
                }

                function _reqHandler(code, res) {
                    if (code === "@@ARES_CLOSE@@") {
                        res.status(200).send();
                        killTimer = setTimeout(function() {
                            process.exit(0);
                        }, 2 * 1000);
                    } else if (code === "@@GET_URL@@") {
                        clearTimeout(killTimer);
                        res.status(200).send(url);
                    }
                }

                function _postAction(err, serverInfo) {
                    if (err) {
                        process.exit(1);
                    } else if (serverInfo && serverInfo.msg && options.open) {
                            const serverUrl = 'http://localhost:' + serverInfo.port + '/ares_cli/ares.html';
                            server.openBrowser(serverUrl, options.bundledBrowserPath);
                    }
                }

                if (options.appId) {
                    url = "http://localhost:" + options.session.getLocalPortByName(options.appId);
                    if (options.session.target.noPortForwarding) {
                        log.verbose("inspector#inspect()","noPortForwarding");
                        const insptPort = options.sessionInsptPort || defaultAppInsptPort;
                        url = "http://" + options.session.target.host + ":" + insptPort;
                    }

                    async.whilst(
                        function() {
                            return listFiles.length > 0;
                        },
                        _getDisplayUrl.bind(this),
                        function (err) {
                            if (err) {
                                return next(err);
                            }
                            console.log("Application Debugging - " + url);
                            server.runServer(__dirname, 0, _reqHandler, _postAction);
                        }
                    );
                }
                next();
            }
        }
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = inspector;
    }
}());
