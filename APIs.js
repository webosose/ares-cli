const {promisify} = require('util'),
    aresSetupDevice = require('./lib/base/setup-device');

const SetupDevice = {
    showDeviceList: promisify(aresSetupDevice.showDeviceList),
    showDeviceListFull: promisify(aresSetupDevice.showDeviceListFull),
    resetDeviceList: promisify(aresSetupDevice.resetDeviceList),
    setDefaultDevice: promisify(aresSetupDevice.setDefaultDevice),
    modifyDevice: promisify(aresSetupDevice.modifyDeviceInfo),
    removeDevice: promisify(aresSetupDevice.removeDeviceInfo)
};

module.exports = {
    SetupDevice
};
