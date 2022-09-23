const {promisify} = require('util'),
    aresLauncher = require('./lib/launch'),
    AresGenerator = require('./lib/generator'),
    aresPackager = require('./lib/package');

const Launcher = {
    launch: promisify(aresLauncher.launch),
    close: promisify(aresLauncher.close),
    listRunningApp: promisify(aresLauncher.listRunningApp)
};

const Generator = new AresGenerator();
const Packager = new aresPackager.Packager();

module.exports = {
    Launcher,
    Generator,
    Packager
};
