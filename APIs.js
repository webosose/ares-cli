const {promisify} = require('util'),
    aresInspecter = require('./lib/inspect'),
    aresLauncher = require('./lib/launch'),
    aresPuller = require('./lib/pull'),
    aresPusher = require('./lib/pusher'),
    aresShell = require('./lib/shell'),
    aresServer = require('./lib/base/server'),
    aresSetupDevice = require('./lib/base/setup-device');

const Inspecter = {
    inspect: promisify(aresInspecter.inspect),
    stop: promisify(aresInspecter.stop)
};

const Launcher = {
    close: promisify(aresLauncher.close),
    launch: promisify(aresLauncher.launch),
    listRunningApp: promisify(aresLauncher.listRunningApp)
};

const Puller = {
    pull: promisify(aresPuller.pull)
};

const Pusher = new aresPusher();

const Server = {
    openBrowser: promisify(aresServer.openBrowser),
    runServer: promisify(aresServer.runServer),
    stop: promisify(aresServer.stop)
};

const Shell = {
    remoteRun: promisify(aresShell.remoteRun),
    shell: promisify(aresShell.shell)
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
    Inspecter,
    Launcher,
    Puller,
    Pusher,
    Server,
    Shell,
    SetupDevice
};
