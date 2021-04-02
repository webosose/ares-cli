/*
 * Copyright (c) 2020 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const npmlog = require('npmlog'),
    Eof = require('../util/eof'),
    errHndl = require('./error-handler');

(function() {
    const log = npmlog;
    log.heading = 'luna';
    log.level = 'http';

    const luna = {
        /**
         * send a command on a luna bus
         * @property options {novacom.Session} session
         * @param {Object} options
         * @param {Object} addr
         * @property addr {String} service luna service name
         * @property addr {String} [folder] containing folder of the requested method
         * @property addr {String} method the luna method to invoke
         * @param {Object} param the unique luna parameter
         * @param {Function} onResponse the callback invoked at each JSON object received from luna-send
         * @property onResponse {Object} obj the JSON object received
         * @property onResponse {Function} next a common-js callback
         * @param next {Function} next a common-js callback
         */
        send: function(options, addr, param, onResponse, next) {
            const session = options && options.session;
            // 'is' is used to transmit an EOF to
            // terminate the remote luna-send.  this is
            // the only way to terminate an interactive
            // request 'luna-send -i'...
            const is = new Eof(),
                url = ['luna:/', addr.service, addr.folder, addr.method].join('/');
            let result, mode, sessionCall = "";

            is.pause();
            if (options && options.nReplies) {
                mode = "-n " + options.nReplies + " ";
            } else {
                mode = "-i ";
            }

            if (options && options.sessionCall && options.sessionId) {
                sessionCall = "-c " + options.sessionId + " ";
            }

            log.verbose("luna#send()", "calling:", mode + sessionCall + url + " '" + JSON.stringify(param) + "'");
            session.run(session.getDevice().lunaSend + " " + mode + sessionCall + url + " '" + JSON.stringify(param) + "'", is /* stdin*/, _onData, process.stderr, function(err) {
            if (err) {
                next(err);
            }
                // success when the output of the
                // command is correctly interpreted,
                // not simply when the command exit
                // with a success exit code.
            });

            let jsonLine = "";

            // Break string into lines (JSON.parse needs a
            // single object per call).
            function _onData(data) {
                let str;
                if (Buffer.isBuffer(data)) {
                    str = data.toString();
                } else {
                     str = data;
                }
                str.split(/\r?\n/).forEach(_onLine);
            }

            function _onLine(line) {
                jsonLine += line;
                log.verbose('luna#send()', 'JSON line:', jsonLine);

                try {
                    result = JSON.parse(jsonLine);
                    log.verbose('luna#send()', 'JSON object:', result);

                    jsonLine = "";
                    if (result.returnValue === false) {
                        is.destroy();
                        const errValue = (result.errorText ? result.errorText :
                                            (result.errorMessage ? result.errorMessage : ''));
                        next(errHndl.getErrMsg("FAILED_CALL_LUNA", errValue, null, addr.service));
                    } else {
                        onResponse(result, function(err, value) {
                            log.verbose('luna#send()', "err:", err, "value:", value);
                            if (err || value) {
                                log.verbose('luna#send()', "closing exec stream");
                                // processing completed or failed
                                next(err, value);
                            }
                        });
                    }
                } catch(e) {
                    // ignore the parsing error:
                    // the line may be incomplete
                    // & not yet JSON-parseable
                }
            }
        },
        sendWithoutErrorHandle: function(options, addr, param, onResponse, next) {
            const session = options && options.session;
            // 'is' is used to transmit an EOF to
            // terminate the remote luna-send.  this is
            // the only way to terminate an interactive
            // request 'luna-send -i'...
            const is = new Eof(),
                url = ['luna:/', addr.service, addr.folder, addr.method].join('/');
            let result, mode;

            is.pause();
            if (options && options.nReplies) {
                mode = "-n " + options.nReplies + " ";
            } else {
                mode = "-i ";
            }

            log.verbose("luna#send()", "calling:", url + " '" + JSON.stringify(param) + "'");
            session.run(session.getDevice().lunaSend + " " + mode + url + " '" + JSON.stringify(param) + "'", is /* stdin*/, _onData, process.stderr, function(err) {
                if (err) {
                    next(err);
                }
                // success when the output of the
                // command is correctly interpreted,
                // not simply when the command exit
                // with a success exit code.
            });

            let jsonLine = "";

            // Break string into lines (JSON.parse needs a
            // single object per call).
            function _onData(data) {
                let str;
                if (Buffer.isBuffer(data)) {
                    str = data.toString();
                } else {
                     str = data;
                }
                str.split(/\r?\n/).forEach(_onLine);
                log.verbose('luna#send()', '_onData:');
            }

            function _onLine(line) {
                jsonLine += line;
                log.verbose('luna#send()', 'JSON line:', jsonLine);

                try {
                    result = JSON.parse(jsonLine);
                    log.verbose('luna#send()', 'JSON object:', result);

                    jsonLine = "";
                    onResponse(result, function(err, value) {
                        log.verbose('luna#send()', "err:", err, "value:", value);
                        if (err || value) {
                            log.verbose('luna#send()', "closing exec stream");
                            // processing completed or failed
                            next(err, value);
                        }
                    });
                } catch(e) {
                    // ignore the parsing error:
                    // the line may be incomplete
                    // & not yet JSON-parseable
                }
            }
        }
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = luna;
    }
}());

