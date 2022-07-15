const {promisify} = require('util'),
    aresLauncher = require('./lib/launch');

const Launcher = {
    launch: promisify(aresLauncher.launch),
    close: promisify(aresLauncher.close),
    listRunningApp: promisify(aresLauncher.listRunningApp)
};

module.exports = {
    Launcher
};
