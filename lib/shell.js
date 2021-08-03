/*
 * Copyright (c) 2020 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const async = require('async'),
    npmlog = require('npmlog'),
    sessionLib = require('./session'),
    errHndl = require('./base/error-handler'),
    novacom = require('./base/novacom');

(function() {
    const log = npmlog;

    log.heading = 'logger';
    log.level = 'warn';

    const shell = {
        log: log,

        remoteRun: function(options, runCommand, next) {
            log.info('shell#remoteRun()');
            async.series([
                function(next) {
                    makeSession(options, next);
                },
                function(next) {
                    if (options && options.display) {
                        sessionLib.getSessionList(options, next);
                    } else {
                        next();
                    }
                },
                function(next) {
                    if (options && options.display && !options.sessionCall) {
                        setImmediate(next, errHndl.getErrMsg("NOT_SUPPORT_SESSION"), {});
                    }
                    next();
                },
                function(next) {
                    if (options.sessionId) {
                        if (options.session.getDevice().username !== 'root') {
                            return setImmediate(next, errHndl.getErrMsg("NEED_ROOT_PERMISSION", "connect user session"));
                        }

                        // -l : make the shell a login shell, -c : command
                        runCommand = `su ${options.sessionId} -l -c '${runCommand}'`;
                    } else {
                        runCommand = "source /etc/profile && " + runCommand;
                    }

                    log.info("shell#remoteRun()", "cmd :", runCommand);
                    options.session.run(runCommand, process.stdin, process.stdout, process.stderr, next);
                }
            ], function(err) {
                setImmediate(next, err);
            });
        },

        shell: function(options, next) {
            log.info('shell#shell()');
            const _ssh = function(session, finish) {
                log.info('shell#shell()');
                async.series([
                    function(next) {
                        makeSession(options, next);
                    },
                    function(next) {
                        const winOpts = {
                            // "rows": process.stdout.rows,
                            // "columns": process.stdout.columns,
                            "term": 'screen'
                        };
                        session.ssh.shell(winOpts, function(err, stream) {
                            if (err) {
                                return setImmediate(next, errHndl.getErrMsg(err));
                            }
                            open_shell();
                            function open_shell() {
                                stream.on('exit', function(code, signal) {
                                    log.silly('Stream :: exit :: code: ' + code + ', signal: ' + signal);
                                    session.ssh.end();
                                    next();
                                });

                                stream.on('data', function() {
                                    arrangeWindow(stream);
                                });

                                process.stdout.on('resize', function() {
                                    arrangeWindow(stream);
                                });

                                function  _printGuide() {
                                    // TO-DO: uncaughtException TypeError: process.stdin.setRawMode is not a function
                                    process.stdin.setRawMode(true);
                                }

                                if (options.sessionId) {
                                    if (options.session.getDevice().username !== 'root') {
                                        return setImmediate(next, errHndl.getErrMsg("NEED_ROOT_PERMISSION", "connect user session"));
                                    }

                                    _printGuide();

                                    const cmd = `su ${options.sessionId} -l`;
                                    session.runWithOption(cmd, {pty: true}, process.stdin, process.stdout, process.stderr, function() {
                                        session.ssh.end();
                                        next();
                                    });
                                } else {
                                    _printGuide();
                                    process.stdin.pipe(stream);
                                    stream.pipe(process.stdout);
                                }

                                function arrangeWindow(window) {
                                    if (winOpts.rows !== process.stdout.rows || winOpts.columns !== process.stdout.columns) {
                                        window.setWindow(process.stdout.rows, process.stdout.columns);
                                        winOpts.rows = process.stdout.rows;
                                        winOpts.columns = process.stdout.columns;
                                    }
                                }
                            }
                        });
                    }
                ], function(err, result) {
                    let flag_reboot = false;
                    if (result.indexOf("id") > 0) {
                        flag_reboot = true;
                    }
                    finish(err,flag_reboot);
                });
            };

            async.series([
                function(next) {
                    makeSession(options, next);
                },
                function(next) {
                    if (options && options.display) {
                        sessionLib.getSessionList(options, next);
                    } else {
                        next();
                    }
                },
                function(next) {
                    if (options && options.display && !options.sessionCall) {
                        setImmediate(next, errHndl.getErrMsg("NOT_SUPPORT_SESSION"), {});
                    }
                    next();
                },
                function(next) {
                    _ssh(options.session, next);
                }
            ], function(err) {
                setImmediate(next, err);
            });
        }
    };

    function makeSession(options, next){
        log.info("shell#makeSession()");
        options.nReplies = 1; // -n 1
        if (!options.session) {
            const printTarget = false;
            options.session = new novacom.Session(options.device, printTarget, next);
        } else {
            next();
        }
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = shell;
    }
}());
