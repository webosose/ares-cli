/*
 * Copyright (c) 2020 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const fs = require('fs'),
    Express = require('express'),
    http = require('http'),
    bodyParser = require('body-parser'),
    spawn = require('child_process').spawn,
    errHndl = require('./error-handler');

(function () {
    const platformOpen = {
        win32: [ "cmd" , '/c', 'start' ],
        darwin:[ "open" ],
        linux: [ "xdg-open" ]
    };

    const server = {};

    /**
     * Run a local web server based on the path
     * @param {path} path where local web server indicates.
     * @param {port} port number for web server. 0 means random port.
     * @param {Function} next a common-JS callback invoked when the DB is ready to use.
     */
    server.runServer =  function(path, port, reqHandlerForIFrame, next) {
        if (typeof reqHandlerForIFrame === 'function' && !next) {
            next = reqHandlerForIFrame;
            reqHandlerForIFrame = null;
        }
        const appPath = fs.realpathSync(path),
            app = new Express();

        app.use("/", Express.static(appPath));
        app.use("/ares_cli", Express.static(__dirname));
        app.use(bodyParser.json());

        if (reqHandlerForIFrame) {
            app.post('/ares_cli/@@ARES_CLOSE@@', function(req, res) {
                reqHandlerForIFrame("@@ARES_CLOSE@@", res);
            });
            app.post('/ares_cli/@@GET_URL@@', function(req, res) {
                reqHandlerForIFrame("@@GET_URL@@", res);
            });
        }

        const localServer = http.createServer(app);
        localServer.on('error', function(err) {
            return next(errHndl.getErrMsg(err));
        });
        localServer.listen(port, function(err) {
            if (err) {
                return next(errHndl.getErrMsg(err));
            }
            const localServerPort = localServer.address().port,
                url = 'http://localhost:' + localServerPort;
            next(null, {
                "msg":"Local server running on " + url,
                "url": url,
                "port": localServerPort
            });
        });
    };

    /**
     * Open url with a web browser
     * @param {url} URL to be opened via web browser.
     * @param {browserPath} browser exectable path. (optional)
     * @param {Function} next a common-JS callback invoked when the DB is ready to use. (optional)
     */
    server.openBrowser = function(url, browserPath, next) {
        let info = platformOpen[process.platform];
        if (typeof browserPath === 'function') {
            next = browserPath;
            browserPath = null;
        }
        if (browserPath && fs.existsSync(browserPath)) {
            if (process.platform === 'linux') {
                info.splice(0, 1); // delete 'xdg-open' command
            }
            info = info.concat([browserPath]);

            if (process.platform === 'darwin') {
                 info = info.concat(['--new', '--args']);
            }
        }

        this.browserProcess = spawn(info[0], info.slice(1).concat([url]));
        if (next) {
            next();
        }
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = server;
    }
}());
