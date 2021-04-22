/*
 * Copyright (c) 2020 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const fs = require('fs'),
    async = require('async'),
    log = require('npmlog'),
    util = require('util'),
    path = require('path'),
    streamBuffers = require('stream-buffers'),
    novacom = require('./base/novacom'),
    errHndl = require('./base/error-handler');

(function () {
    log.heading = 'push';
    log.level = 'warn';

    const TYPE = {
        "FILE": 'f',
        "DIR": 'd',
        "NEW": 'n'
    };

    function Pusher() {
        this.sources = [];
        this.destination = null;
    }

    module.exports = Pusher;
    const proto = Pusher.prototype;

    proto.push = function(srcPaths, dstPath, options, next) {
        /**
            1 file : dest  => dest is a file or an existing directory.
            N files : dest => dest should be an new or existing directory. (If directory is a file, error occurs.)
            dir : dest => dest should be an new or existing directory. (If directory is a file, error occurs.)
        */
        log.verbose("Puser#push()", "srcPaths:", srcPaths, ", dstPath:", dstPath);

        const self = this;
        self.startTime = new Date().getTime();
        self.copyfilesCount = 0;
        self.totalSize = 0;

        let curDstType, copyDstType;

        async.waterfall([
            function(next) {
                if (options.session) {
                    return next(null, options.session);
                } else {
                    options.session = new novacom.Session(options.device, next);
                }
            },
            function(session, next) {
                getDestType(session, dstPath, function(err, type) {
                    curDstType = type;
                    if (!err && type === TYPE.FILE && srcPaths.length > 1) {
                        err = errHndl.getErrMsg("EXISTING_FILETYPE_PATH");
                    }
                    next(err);
                });
            },
            function(next) {
                const session = options.session;
                let dst;

                async.eachSeries(srcPaths, function(src, next) {
                    async.waterfall([
                        fs.lstat.bind(fs, src),
                        function(srcStats, next) {
                            dst = dstPath;
                            if (srcStats.isFile() && srcPaths.length === 1) {
                                if (curDstType === TYPE.DIR) {
                                    dst = path.join(dstPath, path.basename(src));
                                }
                                copyDstType = TYPE.FILE;
                            } else {
                                copyDstType = curDstType;
                            }
                            next();
                        },
                        function(next) {
                            copyFilesToDst.call(self, session, src, dst, copyDstType, options, next);
                        }
                    ], function(err) {
                        next(err);
                    });
                }, next);
            }
        ], function(err) {
            const result = {};
            if (!err) {
                const durSecs = (new Date().getTime() - self.startTime) / 1000;
                console.log(self.copyfilesCount + " file(s) pushed");
                console.log(Math.round((self.totalSize)/(1024*durSecs))+" KB/s ("+self.totalSize+" bytes in "+durSecs+"s)");

                result.msg = "Success";
            } else if(err.code && err.syscall) {
                err = errHndl.getErrMsg(err);
            }
            next(err, result);
        });
    };

    function copyFilesToDst(session, src, dst, dstType, options, next) {
        log.verbose("copyFilesToNewDir()","src:", src, ", dst:", dst);
        const self = this;

        const successMsg = function(_src, _dst, _size, _ignore) {
            if (!_ignore) {
                console.log("Push:", _src, "->", _dst);
            }
            self.copyfilesCount++;
            self.totalSize += _size;
        };

        async.waterfall([
            fs.lstat.bind(fs, src),
            function(stats, next) {
                if (stats.isDirectory()) {
                    log.verbose("copyFilesToNewDir()", "src is a directory");
                    if (dstType === TYPE.FILE) {
                        return next(errHndl.getErrMsg("EXISTING_FILETYPE_PATH"));
                    }

                    const files = fs.readdirSync(src);
                    dst = path.join(dst, path.basename(src));

                    if (process.platform.indexOf('win') === 0) {
                        dst = dst.replace(/\\/g, '/');
                    }

                    if (src.length !== 1 && !options.ignore) {
                        console.log("Push:", src, "->", dst);
                    }

                    mkDir(session, dst, function(err) {
                        if (err) {
                            return setImmediate(next, err);
                        }

                        async.forEach(files, function(file, next) {
                            const nSrc = path.join(src, file);
                            copyFilesToDst.call(self, session, nSrc, dst, TYPE.NEW, options, function(copyError) {
                                next(copyError);
                            });
                        }, function(error) {
                            next(error);
                        });
                    });
                } else {
                    let dstFile;

                    if (dstType === TYPE.FILE) {
                        dstFile = dst;
                        dst = path.join(dst, '..');
                    } else {
                        dstFile = path.join(dst, path.basename(src));
                    }

                    if (process.platform.indexOf('win') === 0) {
                        dst = dst.replace(/\\/g, '/');
                        dstFile = dstFile.replace(/\\/g, '/');
                    }

                    mkDir(session, dst, function(err) {
                        log.verbose("copyFilesToNewDir()", "mkDir#dst:", dst, ",err:", err);
                        session.put(src, dstFile, function(error) {
                            if (!error) {
                                successMsg(src, dstFile, stats.size, options.ignore);
                            }
                            next(error);
                        });
                    });
                }
            }
        ], function(err) {
            next(err);
        });
    }

    function mkDir(session, dstPath, next) {
        async.series([
            session.run.bind(session, "/bin/mkdir -p " + dstPath, null, null, null)
        ], function(err) {
            if (err && err.code === 1) {
                err = errHndl.getErrMsg("FAILED_CREATE_DIR");
            }
            next(err);
        });
    }

    function getDestType(session, dstPath, next) {
        const wStream = new streamBuffers.WritableStreamBuffer();
        let cmdDstType = "[ -d %s ] && echo 'd' || ([ -f %s ] && echo 'f' || echo 'n')";

        if (process.platform.indexOf('win') === 0) {
            dstPath = dstPath.replace(/\\/g, '/');
        }

        cmdDstType = util.format(cmdDstType, dstPath, dstPath);
        session.run(cmdDstType, null, wStream, null, function(err) {
            const dstType = wStream.getContentsAsString().trim();
            log.verbose("Puser#push()","destionation type:", dstType);
            next(err, dstType);
        });
    }
}());
