const {promisify} = require('util'),
    aresInstaller = require('./lib/install');

const Installer = {
    install: promisify(aresInstaller.install),
    remove: promisify(aresInstaller.remove),
    list: promisify(aresInstaller.list)
};

module.exports = {
    Installer
};