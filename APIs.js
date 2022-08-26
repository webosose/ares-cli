const {promisify} = require('util'),
    aresLauncher = require('./lib/launch'),
    aresGenerator = require('./lib/generator');

const Launcher = {
    launch: promisify(aresLauncher.launch),
    close: promisify(aresLauncher.close),
    listRunningApp: promisify(aresLauncher.listRunningApp)
};

const Generator = new aresGenerator();

module.exports = {
    Launcher,
    Generator
};
