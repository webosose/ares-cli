const {promisify} = require('util'),
aresServer = require('./lib/base/server');

const Server = {
    runServer: promisify(aresServer.runServer),
    openBrowser: promisify(aresServer.openBrowser),
    stop: promisify(aresServer.stop)
};

module.exports = {
    Server
};
