/*
 * Copyright (c) 2020 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const async = require('async'),
    Table = require('easy-table'),
    chalk = require('chalk'),
    novacom = require('./novacom');

(function () {
    const devicetools = {};
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = devicetools;
        module.exports.isValidDeviceName = isValidDeviceName;
        module.exports.isValidIpv4 = isValidIpv4;
        module.exports.isValidPort =isValidPort;
    }

    function isValidDeviceName(name) {
        const re = new RegExp("^[_a-zA-Z][a-zA-Z0-9#_-]*");
        return (name === String(name.match(re)));
    }

    function isValidIpv4(host) {
        return host.match(/^(\d|[1-9]\d|1\d\d|2([0-4]\d|5[0-5]))\.(\d|[1-9]\d|1\d\d|2([0-4]\d|5[0-5]))\.(\d|[1-9]\d|1\d\d|2([0-4]\d|5[0-5]))\.(\d|[1-9]\d|1\d\d|2([0-4]\d|5[0-5]))$/);
    }

    function isValidPort(port) {
        return String(port).match(/^[0-9]+$/);
    }

    function finish(returnValue, next){
        if(next && typeof next === 'function'){
            if (!returnValue)
                return setImmediate(next);
            return setImmediate(next, null, returnValue);
        }
        return returnValue;
    }

    function getDeviceInfo(mode, next){
        const datas= [],
            resolver = new novacom.Resolver();
        async.waterfall([
            resolver.load.bind(resolver),
            resolver.list.bind(resolver),
            function(devices, next){
                if(Array.isArray(devices)){
                    devices.forEach(function(device){
                        const conn = device.conn.concat([]),
                            info = (device.username && device.host && device.port) ? device.username + '@' + device.host + ':' + device.port : device.id,
                            item = {
                                profile : device.profile,
                                name : device.name,
                                default : device.default,
                                deviceinfo : {},
                                connection: device.conn || ['ssh'],
                                details: {
                                    platform : device.type
                                }
                            };

                        if(conn.length === 1 && conn.indexOf('novacom') !== -1) {
                            item.deviceinfo.uid = device.id;
                            item.details.type = device.name.slice(0,3);
                        } else {
                            item.deviceinfo = {
                                ip : device.host,
                                port : String(device.port),
                                user : device.username
                            };

                            item.details.password = device.password;
                            item.details.privatekey = device.privateKeyName;
                            item.details.passphrase = device.passphrase;
                            item.details.description = device.description;
                        }

                        if(device.id) {
                            item.deviceinfo.uid = device.id;
                            item.details.type = device.name.slice(0,3);
                        }
                        const data = (mode === 'full') ? item : {name: device.name, default: device.default,info:info, connection: (device.conn || 'ssh'), profile: device.profile };
                        datas.push(data);
                    });
                }
                next(datas);
            }
        ], function(err){
                finish(err, next);
        });
    }

    devicetools.showDeviceListAndExit = function(showMode){
        const mode = showMode || 'list';
        async.waterfall([
            getDeviceInfo.bind(this, mode),
            function(data, next){
                if(mode === 'full'){
                    console.log(JSON.stringify(data, null, 4));
                } else {
                    const table = new Table();
                    data.forEach(function(item){
                        if (!isValidDeviceName(item.name)) {
                            return;
                        }
                        table.cell('name', (item.default === true) ? item.name + chalk.green(' (default)') : item.name );
                        table.cell('deviceinfo', item.info);
                        table.cell('connection', item.connection);
                        table.cell('profile', item.profile);
                        table.newRow();
                    });
                    console.log(table.toString());
                }
                next();
            }
        ], function(){
            process.exit(0);
        });
    };

    devicetools.showDeviceList = function(next){
        async.waterfall([
            getDeviceInfo.bind(this, 'list'),
            function(data, next){
                const table = new Table();
                data.forEach(function(item){
                    if (!isValidDeviceName(item.name)) {
                        return;
                    }
                    table.cell('name', (item.default === true) ? item.name + chalk.green(' (default)') : item.name );
                    table.cell('deviceinfo', item.info);
                    table.cell('connection', item.connection);
                    table.cell('profile', item.profile);
                    table.newRow();
                });
                console.log(table.toString());
                next();
            }
        ], function(err){
            finish(err, next);
        });
    };
}());
