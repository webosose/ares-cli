const {promisify} = require('util'),
aresLauncher = require('./lib/launch'),
aresServer = require('./lib/base/server'),
    aresSetupDevice = require('./lib/base/setup-device');

const Launcher = {
    close: promisify(aresLauncher.close),
    launch: promisify(aresLauncher.launch),
    listRunningApp: promisify(aresLauncher.listRunningApp)
};

const Server = {
    openBrowser: promisify(aresServer.openBrowser),
    runServer: promisify(aresServer.runServer),
    stop: promisify(aresServer.stop)
};

const SetupDevice = {
    modifyDevice: promisify(aresSetupDevice.modifyDeviceInfo),
    removeDevice: promisify(aresSetupDevice.removeDeviceInfo),
    resetDeviceList: promisify(aresSetupDevice.resetDeviceList),
    setDefaultDevice: promisify(aresSetupDevice.setDefaultDevice),
    showDeviceList: promisify(aresSetupDevice.showDeviceList),
    showDeviceListFull: promisify(aresSetupDevice.showDeviceListFull),
};

module.exports = {
    Launcher,
    Server,
    SetupDevice
};
