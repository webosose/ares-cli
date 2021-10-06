/*
 * Copyright (c) 2020 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const async = require('async'),
    chalk = require('chalk'),
    fs = require('fs'),
    mkdirp = require('mkdirp'),
    npmlog = require('npmlog'),
    path = require('path'),
    util = require('util'),
    Table = require('easy-table'),
    pullLib = require('./pull'),
    errHndl = require('./base/error-handler'),
    luna = require('./base/luna'),
    novacom = require('./base/novacom'),
    createDateFileName = require('./util/createFileName').createDateFileName,
    convertJsonToList = require('./util/json').convertJsonToList;

(function() {
    const log = npmlog;
    log.heading = 'device';
    log.level = 'warn';

    const device = {

        /**
         * @property {Object} log an npm log instance
         */
        log: log,

        /**
         * Print system information of the given device
         * @property options {String} device the device to connect to
         */
        systemInfo: function(options, next) {
            if (typeof next !== 'function') {
                throw errHndl.getErrMsg("MISSING_CALLBACK", "next", util.inspect(next));
            }
            options = options || {};
            async.series([
                _makeSession,
                _getOsInfo,
                _getDeviceInfo,
                _getChromiumVersion,
                _getQtbaseVersion,
            ],  function(err, results) {
                log.silly("device#systemInfo()", "err:", err, ", results:", results);
                let resultTxt = "";
                for (let i = 1; i < results.length; i++) {
                    resultTxt += results[i] + "\n";
                }
                next(err, {msg : resultTxt.trim()});
            });

            function _makeSession(next) {
                makeSession(options, next);
            }

            function _getOsInfo(next) {
                log.info("device#systemInfo()#_getOsInfo()");
                const target = options.session.getDevice(),
                    addr = target.lunaAddr.osInfo,
                    param = {
                            // luna param
                            parameters:["webos_build_id","webos_imagename","webos_name","webos_release",
                                        "webos_manufacturing_version", "core_os_kernel_version"],
                            subscribe: false
                        };

                luna.send(options, addr, param, function(lineObj, next) {
                    const resultValue = lineObj;

                    if (resultValue.returnValue) {
                        log.verbose("device#systemInfo()#_getOsInfo()", "success");
                        delete resultValue.returnValue; // remove unnecessary data
                        next(null, _makeReturnTxt(resultValue));
                    } else {
                        log.verbose("device#systemInfo()#_getOsInfo()", "failure");
                        next(errHndl.getErrMsg("INVALID_OBJECT"));
                    }
                }, next);
            }

            function _getDeviceInfo(next) {
                log.info("device#systemInfo()#_getDeviceInfo()");
                const target = options.session.getDevice(),
                    addr = target.lunaAddr.deviceInfo,
                    param = {
                            // luna param
                            subscribe: false
                        };

                luna.send(options, addr, param, function(lineObj, next) {
                    const resultValue = lineObj,
                        returnObj ={};

                    if (resultValue.returnValue) {
                        log.verbose("device#systemInfo()#_getDeviceInfo()", "success");
                        returnObj.device_name = resultValue.device_name;
                        returnObj.device_id = resultValue.device_id;
                        next(null, _makeReturnTxt(returnObj));
                    } else {
                        log.verbose("device#systemInfo()#_getDeviceInfo()", "failure");
                        next(errHndl.getErrMsg("INVALID_OBJECT"));
                    }
                }, next);
            }

            function _getChromiumVersion(next) {
                log.info("device#systemInfo()#_getChromiumInfo()");

                // opkg is required permission as root.
                if (options.session.getDevice().username !== 'root') {
                    return next(null, "chromium_version : " + "not supported");
                } else {
                    const cmd = '/usr/bin/opkg list-installed webruntime';
                    options.session.run(cmd, null, __data, null, function(err) {
                        if (err) {
                            return next(err);
                        }
                    });
                }
                function __data(data) {
                    const str = (Buffer.isBuffer(data)) ? data.toString() : data,
                        exp = /\d*\.\d*\.\d*\.\d*/,
                        version = str.match(exp);

                    next(null, "chromium_version : " + version);
                }
            }

            function _getQtbaseVersion(next) {
                log.info("device#systemInfo()#_getQtbaseInfo()");

                // opkg is required permission as root.
                if (options.session.getDevice().username !== 'root') {
                    return next(null, "qt_version : " + "not supported");
                } else {
                    const cmd = '/usr/bin/opkg list-installed qtbase';
                    options.session.run(cmd, null, __data, null, function(err) {
                        if (err) {
                            return next(err);
                    }});
                }
                function __data(data) {
                    const str = (Buffer.isBuffer(data)) ? data.toString() : data,
                        exp = /\d*\.\d*\.\d*/,
                        version = str.match(exp);
                    next(null, "qt_version : " + version);
                }
            }

            function _makeReturnTxt(resultValue){
                let returnTxt = "";

                for (const key in resultValue) {
                    if (resultValue[key] === undefined) {
                        resultValue[key] = "(unknown)";
                    }
                    returnTxt += key + " : " + resultValue[key] + "\n";
                }
                return returnTxt.trim();
            }
        },
        /**
         * Print session information of the given device
         * @property options {String} device the device to connect to
         */
        sessionInfo: function(options, next) {
            if (typeof next !== 'function') {
                throw errHndl.getErrMsg("MISSING_CALLBACK", "next", util.inspect(next));
            }
            options = options || {};
            async.series([
                _makeSession,
                _getSessionList
            ],  function(err, results) {
                log.silly("device#sessionInfo()", "err:", err, ", results:", results);
                let resultTxt = "";

                if (results[1] !== undefined) {
                    if (typeof results[1] === "object") {
                        if(results[1].length === 0) {
                            return next(errHndl.getErrMsg("SELECT_PROFILE"));
                        }
                        for (let i = 0; i < results[1].length; i++) {
                            resultTxt += convertJsonToList(results[1][i], 0) + '\n';
                        }
                    } else {
                        resultTxt = results[1];
                    }
                }
                
                next(err, {msg : resultTxt.trim()});
            });

            function _makeSession(next) {
                makeSession(options, next);
            }

            function _getSessionList(next) {
                log.info("device#sessionInfo#_getSessionList()");
                const target = options.session.getDevice(),
                    addr = target.lunaAddr.getSessionList,
                    param = {
                        // luna param
                        subscribe: false
                    };

                luna.send(options, addr, param, function(lineObj, next) {
                    if (lineObj.returnValue) {
                        log.verbose("device#sessionInfo()#_getSessionList()", "success");
                        next(null, lineObj.sessionList);
                    } else {
                        log.verbose("device#sessionInfo()#_getSessionList()", "failure");
                        next(errHndl.getErrMsg("INVALID_OBJECT"));
                    }
                }, next);
            }
        },
        /**
         * Print session information of the given device
         * @property options {String} device the device to connect to
         */
        resourceMonitor: function(options, next) {
            if (typeof next !== 'function') {
                throw errHndl.getErrMsg("MISSING_CALLBACK", "next", util.inspect(next));
            }
            options = options || {};
            const systemGroup = {};
            systemGroup.initialExecution = true;

            // resource-monitor CPU & Memory
            async.series([
                _makeSession,
                _getResource
            ],  function(err, results) {
                log.silly("device#resourceMonitor()", "err:", err, ", results:", results);
                next(err);
            });

            function _makeSession(next) {
                makeSession(options, next);
            }

            function _getResource(next) {
                let repeatCount = 0;
                const snapRepeat = 3;
                let timerId;

                if(!options.interval) {
                    try{
                        timerId = setTimeout(function repeat() {
                            _getResourceFromTarget();
                            repeatCount ++;
                            if(repeatCount === snapRepeat){
                                clearTimeout(timerId);
                                next(null);
                            } else {
                                timerId = setTimeout(repeat, 1000);
                            }
                        }, 100);
                    } catch (e) {
                        clearTimeout(timerId);
                        next(null, e.toString());
                    }
                } else {
                        timerId = setTimeout(function repeat() {
                        try{
                            _getResourceFromTarget();
                            timerId = setTimeout(repeat, options.interval * 1000);
                        } catch (e) {
                            clearTimeout(timerId);
                            next(null);
                        }
                    }, 100);
                }
            }

            function _getResourceFromTarget() {
                log.info("device#resourceMonitor()#_getResourceFromTarget()", systemGroup.initialExecution);
                let result = "";

                const cmd = 'date ; grep -c ^processor /proc/cpuinfo; grep "cpu *" /proc/stat; free -k ; echo \'endString\'';
                options.session.run(cmd, null, __data, null, function(err) {
                    if (err) {
                        return next(err);
                    }
                });
                
                function __data(data) {
                    const str = (Buffer.isBuffer(data)) ? data.toString() : data;
                    
                    if(str.trim() === 'endString') {
                        __setResourceInfo(result);
                        systemGroup.initialExecution = false;
                    } else {
                        result += str;
                    }
                }
            }

            function __setResourceInfo(CPUdata) {
                const CPU_PATTERN = /\s+/;
                let sysinfo = {};

                const cpuinfo = {};
                const meminfo = {};
    
                const allvalues = CPUdata.split("\n");
    
                // setup date
                const date = allvalues[0];
                const pcore = +allvalues[1] * 100;

                let index, columns;
                let isBuff_Cached = false; // This is to check the format version of kernel to find system memory parameter
    
                try{
                    for (index = 2; index < (allvalues.length - 1); index++ ) {
                        columns = allvalues[index].split(CPU_PATTERN);
    
                        // setup cpuinfo
                        if (columns[0].indexOf('cpu') === 0) {
                            const prevTotal = "prev" + columns[0] + "Total";
                            const prevIdle = "prev" + columns[0] + "Idle";
                            const prevUser = "prev" + columns[0] + "User";
                            const prevkernel = "prev" + columns[0] + "Kernel";
                            const prevOther = "prev" + columns[0] + "Other";
                            if(!systemGroup[prevTotal]){
                                systemGroup[prevTotal] = 0;
                                systemGroup[prevIdle] = 0;
                                systemGroup[prevUser] = 0;
                                systemGroup[prevkernel] = 0;
                                systemGroup[prevOther] = 0;
                            }
                            const user = parseInt(columns[1]);
                            const nice = parseInt(columns[2]);
                            const kernel = parseInt(columns[3]);
                            const idle = parseInt(columns[4]);
                            const other = nice + parseInt(columns[5]) + parseInt(columns[6]) + parseInt(columns[7]) + parseInt(columns[8]) +
                            parseInt(columns[9]) + parseInt(columns[10]);
                            const subTotal = user + nice + kernel + idle + other;
                            if (!systemGroup.initialExecution) {
                                const diffIdle = idle - systemGroup[prevIdle];
                                const diffUser = user - systemGroup[prevUser];
                                const diffKernel = kernel - systemGroup[prevkernel];
                                const diffOther = other - systemGroup[prevOther];
                                const diffTotal = subTotal - systemGroup[prevTotal];
                                let userModeCpuOccupation = (diffUser/diffTotal) * 100;
                                let kernelModeCpuOccupation = (diffKernel/diffTotal) * 100;
                                let otherModeCpuOccupation = (diffOther/diffTotal) * 100;
                                let overallCpuOccupation = ((diffTotal - diffIdle)/diffTotal) * 100;
                                userModeCpuOccupation < 0 ? (userModeCpuOccupation = 0) : userModeCpuOccupation;
                                userModeCpuOccupation > pcore ? (userModeCpuOccupation = pcore) : userModeCpuOccupation;
                                kernelModeCpuOccupation < 0 ? (kernelModeCpuOccupation = 0) : kernelModeCpuOccupation;
                                kernelModeCpuOccupation > pcore ? (kernelModeCpuOccupation = pcore) : kernelModeCpuOccupation;
                                otherModeCpuOccupation < 0 ? (otherModeCpuOccupation = 0) : otherModeCpuOccupation;
                                otherModeCpuOccupation > pcore ? (otherModeCpuOccupation = pcore) : otherModeCpuOccupation;
                                overallCpuOccupation < 0 ? (overallCpuOccupation = 0) : overallCpuOccupation;
                                overallCpuOccupation > pcore ? (overallCpuOccupation = pcore) : overallCpuOccupation;
    
                                cpuinfo[columns[0]] = {
                                    "overall": +overallCpuOccupation.toFixed(2),
                                    "usermode": +userModeCpuOccupation.toFixed(2),
                                    "kernelmode": +kernelModeCpuOccupation.toFixed(2),
                                    "others": +otherModeCpuOccupation.toFixed(2)
                                };
                            }
                            systemGroup[prevIdle] = idle;
                            systemGroup[prevUser] = user;
                            systemGroup[prevkernel] = kernel;
                            systemGroup[prevOther] = other;
                            systemGroup[prevTotal] = subTotal;
                        }
    
                        if(!systemGroup.initialExecution){
                            // setup meminfo
                            if (columns[5] && columns[5].indexOf('buff/cache') !== -1) isBuff_Cached = true;
                            if (columns[0].indexOf('Mem:') === 0) {
                                meminfo['memory'] = !isBuff_Cached ? {
                                    "total": +columns[1],
                                    "used": +columns[2],
                                    "free": +columns[3],
                                    "shared": +columns[4],
                                    "buffers": +columns[5],
                                    "cached": +columns[6]
                                } : {
                                    "total": +columns[1],
                                    "used": +columns[2],
                                    "free": +columns[3],
                                    "shared": +columns[4],
                                    "buff_cache": +columns[5],
                                    "available": +columns[6]
                                };
                            }
    
                            if (columns[0].indexOf('-/+') === 0) {
                                meminfo['buffers'] = {
                                    "used": +columns[2],
                                    "free": +columns[3]
                                };
                            }
    
                            if (columns[0].indexOf('Swap:') === 0) {
                                meminfo['swap'] = {
                                    "total": +columns[1],
                                    "used": +columns[2],
                                    "free": +columns[3]
                                };
                            }
                        }
                    }

                    if(!systemGroup.initialExecution) {
                        sysinfo = {
                                "date": date, // *1000
                                "cpuinfo": cpuinfo,
                                "meminfo": meminfo
                        };
                        
                        __printResource(sysinfo);
                    }
                }catch(e){
                    next(e);
                }
            }
            
            function __printResource(sysinfo) {
                const cpuInfo = sysinfo.cpuinfo;
                const memInfo = sysinfo.meminfo;

                const cpuInfoTable = new Table();
                const memInfoTable = new Table();

                // cpuInfo
                for(const key in cpuInfo) {
                    cpuInfoTable.cell('(%)', key );
                    cpuInfoTable.cell('overall', cpuInfo[key].overall);
                    cpuInfoTable.cell('usermode', cpuInfo[key].usermode);
                    cpuInfoTable.cell('kernelmode', cpuInfo[key].kernelmode);
                    cpuInfoTable.cell('others', cpuInfo[key].others);
                    cpuInfoTable.newRow();
                }

                // memoryInfo
                for(const key in memInfo) {
                    memInfoTable.cell('(KB)', key );
                    memInfoTable.cell('total', memInfo[key].total);
                    memInfoTable.cell('used', memInfo[key].used);
                    memInfoTable.cell('free', memInfo[key].free);
                    memInfoTable.cell('shared', memInfo[key].shared);
                    memInfoTable.cell('buff/cache', memInfo[key].buff_cache);
                    memInfoTable.cell('available', memInfo[key].available);
                    memInfoTable.newRow();
                }
                console.log("DATE : " + sysinfo.date);
                console.log(cpuInfoTable.toString());
                console.log(memInfoTable.toString());
                console.log("================================================================\n");
            }
        },

        resourceList: function(options, next) {
            if (typeof next !== 'function') {
                throw errHndl.getErrMsg("MISSING_CALLBACK", "next", util.inspect(next));
            }
            options = options || {};
            const processGroup = {};

            // resource-monitor CPU & Memory
            async.series([
                _makeSession,
                _getProcessList
            ],  function(err, results) {
                log.silly("device#resourceList()", "err:", err, ", results:", results);
                next(err);
            });

            function _makeSession(next) {
                makeSession(options, next);
            }

            function _getProcessList(next) {
                let repeatCount = 0;
                const snapRepeat = 3;
                let timerId;

                if(!options.interval) {
                    try{
                        timerId = setTimeout(function repeat() {
                            _getResourceFromTarget();
                            repeatCount ++;
                            if(repeatCount === snapRepeat){
                                clearTimeout(timerId);
                                next(null);
                            } else {
                                timerId = setTimeout(repeat, 1000);
                            }
                        }, 100);
                    } catch (e) {
                        clearTimeout(timerId);
                        next(null, e.toString());
                    }
                } else {
                        timerId = setTimeout(function repeat() {
                        try{
                            _getResourceFromTarget();
                            timerId = setTimeout(repeat, options.interval * 1000);
                        } catch (e) {
                            clearTimeout(timerId);
                            next(null);
                        }
                    }, 100);
                }
            }

            function _getResourceFromTarget() {
                log.info("device#resourceList()#_getResourceFromTarget()");
                let result = "";

                const cmd = 'date ; grep "cpu *" /proc/stat | sed "1d" | awk \'{for (i=0;i<NR;i++){if(i==NR-1){totalSum+=$2+$3+$4+$5+$6+$7+$8+$9+$10+$11;idleSum+=$5}}} END { for (i=0;i<NR;i++){if(i==NR-1){print idleSum;print totalSum}}}\'; cat /proc/[0-9]*/stat;  luna-send-pub -n 1 -f luna://com.webos.applicationManager/dev/running \'{}\'; grep -c ^processor /proc/cpuinfo ; echo \'endString\'';
                options.session.run(cmd, null, __data, null, function(err) {
                    if (err) {
                        return next(err);
                    }
                });
                
                function __data(data) {
                    const str = (Buffer.isBuffer(data)) ? data.toString() : data;
                    
                    if(str.trim() === 'endString') {
                        __setProcessInfo(result);
                        processGroup.initialExecution = false;
                    } else {
                        result += str;
                    }
                }
            }

            function __setProcessInfo(processData) {
                const PROC_GROUP_INFO_PATTERN = /\s+/;
                try{
                    // Intialize temporary groups with values
                    const processList = ["Service", "System"];
                    const tempProcGrps = {};
                    // loop through all the categories and create groups
                    for(let i = 0; i < processList.length; i++) {
                        tempProcGrps[processList[i]] = {};
                        tempProcGrps[processList[i]]["pid"] = 0;
                        tempProcGrps[processList[i]]["cputime"] = 0;
                        tempProcGrps[processList[i]]["RSS"] = 0;
                        tempProcGrps[processList[i]]["pmem"] = 0;
                    }
                    // const processgrpinfo = {};
                    const processinfo = [];
    
                    const allvalues = processData.split("\n");
                    const otherList = [];
                    const date = allvalues[0];
                    const lastIndex = allvalues.length;
                    allvalues.splice(lastIndex - 1, 1);
                    
                    const pcore = +allvalues[allvalues.length-1] * 100;
                    /* memCol[1] from 'grep "MemTotal *" /proc/meminfo' is not used */
                    let totalRAM = 0;
                    const idleCPUtime = +allvalues[1];
                    const totalCPUtime = +allvalues[2];
                    const appStartIndex = allvalues.indexOf("{", 2); // From where to start (2)
                    
                    // Some times dreadlocks platform does not gives list of running info itself then appStartIndex becomes -1 - CHNSDK-9614
                    if(appStartIndex < 0){
                        __setProcessInfo(function(){});
                        return;
                    }
                    const appEndIndex = allvalues.length-1;
                    let strActiveApps = "";
                    for(let i = appStartIndex; i < appEndIndex ;i++) {
                        strActiveApps+= allvalues[i];
                    }
                    let objActiveApps;
                    try{
                        objActiveApps = JSON.parse(strActiveApps);
                    }
                    catch(e){
                        __setProcessInfo(function(){});
                        return;
                    }
                    const arrActiveApps = objActiveApps["running"];
                    const groupObjList = {};
                    // 1st row is date, 2nd row is total CPU time and last row is total RAM(Meminfo) hence ignore it
                    for(let k = 3; k < appStartIndex;k++) {
                        const columns = allvalues[k].trim().split(PROC_GROUP_INFO_PATTERN);
                        const procname = columns[1].trim().split(/.*\(|\)/gi)[1];
                        const grpname = getProcessGrp(procname);
                        const pid = parseInt(columns[0]);
                        const pname = procname;
                        const ppid = parseInt(columns[3]);
                        const cputime = parseInt(columns[13]) + parseInt(columns[14]);
                        const rss = parseInt(columns[23]) * 4;
                        const pmem = (rss * 100);
                        // sum total used RSS
                        totalRAM +=rss;
                        if(grpname === "Other"){
                            const objOther = {};
                            objOther["pid"] = pid;
                            objOther["pname"] = pname;
                            objOther["ppid"] = ppid;
                            objOther["cputime"] = cputime;
                            objOther["RSS"] = rss;
                            objOther["pmem"] = pmem;
                            otherList.push(objOther);
                        }
                        else{
                            tempProcGrps[grpname]["pid"] = pid;
                            tempProcGrps[grpname]["cputime"]+= cputime;
                            tempProcGrps[grpname]["RSS"]+= rss;
                            tempProcGrps[grpname]["pmem"]+= pmem;
                        }
                    }
                    // Get the Children of Service
                    for (const k in tempProcGrps){
                        const attrName = k;
                        if(attrName === "System") continue;
                        const objOther = tempProcGrps[k];
                        for (let i=0; i < otherList.length; i++){
                            if(objOther["pid"] !== otherList[i]["ppid"])continue;
                            tempProcGrps[attrName]["pid"] = otherList[i]["pid"];
                            tempProcGrps[attrName]["cputime"]+= otherList[i]["cputime"];
                            tempProcGrps[attrName]["RSS"]+= otherList[i]["RSS"];
                            tempProcGrps[attrName]["pmem"]+= otherList[i]["pmem"];
                            otherList.splice(i, 1);
                            i--;
                        }
                    }
                    // This variable will mantain the aggregate pcpuVal of Service + dynamic apps
                    let aggcpuVal = 0;
                    // Get the Web App processes data
                    if(arrActiveApps.length === 0) {
                        // Get only the existing categories(3) if no running apps.
                        // Dispose all the existing process variables
                        for(const name in processGroup) {
                            // If propertyName starts with "prev_" then dispose it
                            if (!Object.prototype.hasOwnProperty.call(processGroup, name))
                                continue;
        
                            if(name.indexOf("prev_") >= 0){
                                processGroup[name] = undefined;
                            }
                        }
                    } else {
                      // Loop through each of the running apps
                      // In loop - Check if app is newly running app (or) already existing running app
                      for(let j = 0; j < arrActiveApps.length; j++) {
                          const objActApp = arrActiveApps[j];
                          let processId;
                          const webprocId = objActApp["webprocessid"];
                          const procId = objActApp["processid"];
                          if(webprocId !== "" && webprocId !== undefined && webprocId !== "undefined")
                              processId = webprocId;
                          else if(procId !== "" && procId !== undefined && procId !== "undefined")
                              processId = procId;
                          else
                              break;
                          const prevcpuTime = "prev" + "_" + processId + "cputime";
                          let pcputime = 0;
                          const appid = parseInt(processId);
                          // Get the cputime from otherList
                          for (let l=0; l < otherList.length; l++){
                              if(otherList[l]["pid"] !== appid)
                                  continue;
    
                              pcputime = otherList[l]["cputime"];
                              if(!processGroup[prevcpuTime]){
                                  processGroup[prevcpuTime] = pcputime;
                                  break;
                              }
                              let webpcpuval = ((pcputime - processGroup[prevcpuTime]) * 100/(totalCPUtime - processGroup.prevTotalcputime));
                              // Restrict showing the negative % values by making lowest to be zero.
                              if(webpcpuval < 0 || webpcpuval === undefined || isNaN(webpcpuval)) webpcpuval = 0;
                                aggcpuVal+= webpcpuval;
                                groupObjList[objActApp["id"]] = {
                                        "pid": appid,
                                        "cpu": webpcpuval,
                                        "memory": {
                                            "size": otherList[l]["RSS"],
                                            "percent": otherList[l]["pmem"].toFixed(2)
                                        }
                              };
                              processGroup[prevcpuTime] = pcputime;
                              otherList.splice(l, 1);
                              break;
                          }
                        }
                    }
                    // Get the remaining System Category processes
                    for (let i=0; i < otherList.length; i++){
                        tempProcGrps["System"]["pid"] = otherList[i]["pid"];
                        tempProcGrps["System"]["cputime"]+= otherList[i]["cputime"];
                        tempProcGrps["System"]["RSS"]+= otherList[i]["RSS"];
                        tempProcGrps["System"]["pmem"]+= otherList[i]["pmem"];
                    }
                    if(!processGroup.initialExecution){
                        const diffIdle = idleCPUtime - processGroup.prevIdlecputime;
                        const diffTotal = totalCPUtime - processGroup.prevTotalcputime;
                        const overallCpuOccupation = ((diffTotal - diffIdle)/diffTotal) * 100;
                        // Assign all the values to return Object
                        for (const key in tempProcGrps){
                            const processName = key;
                            let tempPcpuval = 0;
                            if(processName === "Service"){
                                tempPcpuval = ((tempProcGrps[processName]["cputime"] - processGroup.prevServicecputime) * 100/diffTotal);
                            }
                            // Restrict showing the negative % values by making lowest to be zero.
                            if(tempPcpuval < 0 || tempPcpuval === undefined || isNaN(tempPcpuval)) tempPcpuval = 0;
                            aggcpuVal+= tempPcpuval;
                            // System = overallCpuOccupation - (Service used + dynamic apps used);
                            if(processName === "System"){
                                tempPcpuval = overallCpuOccupation - aggcpuVal;
                            }
                            // Restrict Negative/peak values due to cores fluctuation
                            tempPcpuval < 0 ? (tempPcpuval = 0) : tempPcpuval;
                            tempPcpuval > pcore ? (tempPcpuval = pcore) : tempPcpuval;
                            tempProcGrps[processName]["pmem"] /= totalRAM;
                            const procinfo = {
                                    "pid": tempProcGrps[processName]["pid"],
                                    "appid": processName,
                                    "cpu": parseFloat(tempPcpuval.toFixed(2)),
                                    "memory": {
                                        "size": tempProcGrps[processName]["RSS"],
                                        "percent": tempProcGrps[processName]["pmem"].toFixed(2)
                                    }
                            };
                            processinfo.push(procinfo);
                        }
                        // Push the calculated groups into list
                        for(const propertyName in groupObjList) {
                            if (!Object.prototype.hasOwnProperty.call(groupObjList, propertyName)) continue;
    
                            const procObj = groupObjList[propertyName];
                            let pcpuval = parseFloat(procObj["cpu"].toFixed(2));
                            if(pcpuval === undefined || isNaN(pcpuval)) pcpuval = 0;
                            procObj["memory"]["percent"] /= totalRAM;
                            const procinfo = {
                                    "pid": procObj["pid"],
                                    "appid": propertyName,
                                    "cpu": pcpuval,
                                    "memory": {
                                        "size": procObj["memory"]["size"],
                                        "percent": parseFloat(procObj["memory"]["percent"]).toFixed(2)
                                    }
                            };
                            processinfo.push(procinfo);
                            if(processList.indexOf(propertyName) < 0)
                                processList.push(propertyName);
                        }
                    }
                    processGroup.prevIdlecputime = idleCPUtime;
                    processGroup.prevTotalcputime = totalCPUtime;
                    processGroup.prevServicecputime = tempProcGrps["Service"]["cputime"];
    
                    if(!processGroup.initialExecution){
                        const processgrpinfo = {
                            "date": date,
                            "processinfo": processinfo,
                            "processList": processList
                        };
                        __printResourceList(processgrpinfo);
                    }
                }catch(e){
                    console.log(e);
                    return;
                }
            }

            function getProcessGrp(pname) {
                let group;
                switch (pname) {
                case 'ls-hubd':
                    group = 'Service'; break;
                default:
                    group = 'Other'; // It could be children of above categories or System
                }
                return group;
            }
            
            function __printResourceList(processData) {
                console.log(JSON.stringify(processData));
                const processInfo = processData.processinfo;
                const processInfoTable = new Table();
                // cpuInfo

                if(Array.isArray(processInfo)){
                    
                    processInfo.forEach(function(process){
                        processInfoTable.cell('id', process.appid );
                        processInfoTable.cell('pid', process.pid);
                        const memoryInfo = process.memory;
                        processInfoTable.cell('memory (KB)', memoryInfo.size);
                        processInfoTable.cell('memory (%)', memoryInfo.percent);
                        processInfoTable.newRow();
                    });
                }
                console.log("DATE : " + processData.date);
                console.log(processInfoTable.toString());
                console.log("================================================================\n");
            }
        },
        /**
         * get screen capture of the given device
         * @property options {String} device, display, outputPath
         */


        captureScreen: function(options, next) {
            if (typeof next !== 'function') {
                throw errHndl.getErrMsg("MISSING_CALLBACK", "next", util.inspect(next));
            }
            options = options || {};
            async.series([
                _makeSession,
                _makeCaptureOption,
                _captureScreenFile,
                _copyFileToLocal
            ],  function(err, results) {
                log.silly("device#captureScreen()", "err:", err, ", results:", results);
                const resultTxt = "Create " + chalk.green(options.captureFileName) + " to " + options.destinationPath +"\nSuccess";

                // clean up /tmp/aresCapture directory in target device
                if (options.createdTmpDir) {
                    _removeTmpDir(function finish(removeErr) {
                        next(err ? err : removeErr, {msg : resultTxt});
                    });
                } else {
                    next(err, {msg : resultTxt});
                }
            });

            function _makeSession(next) {
                makeSession(options, next);
            }

            function _makeCaptureOption(next) {
                log.info("device#captureScreen()#_makeCaptureOption()");
                let captureFileName = options.session.target.name + "_" + "display" + options.display + "_",
                    destinationPath = "",
                    captureFormat = "PNG"; // PNG is default format

                if (options.outputPath === null) {
                    captureFileName += createDateFileName(null, captureFormat.toLowerCase());
                    destinationPath = path.resolve('.');
                } else {
                    // Get directory path, file path, file Extenstion from given path
                    const parseDirPath = path.dirname(options.outputPath),
                        parseBase = path.parse(options.outputPath).base;

                    let parseExt = path.parse(options.outputPath).ext;
                    parseExt = parseExt.split('.').pop();

                    log.info("device#captureScreen()#_makeCaptureOption()" + "dir name:" + parseDirPath
                        + " ,file name:" + parseBase + " ,inputFormat:" + parseExt);

                    // If specific path is given
                    if (parseBase) {
                        // parseBase is [filename].[ext] format
                        if (parseExt) {
                            if (parseExt === "png" || parseExt === "bmp" || parseExt === "jpg") {
                                captureFormat = parseExt.toUpperCase();
                            } else {
                                return setImmediate(next, errHndl.getErrMsg("INVALID_CAPTURE_FORMAT"));
                            }
                            captureFileName = parseBase;
                            destinationPath = path.resolve(parseDirPath);
                        } else if (parseExt === "") {
                            // paresBase is directory path. Use it as destination directory path
                            captureFileName += createDateFileName(null, captureFormat.toLowerCase());
                            destinationPath = path.resolve(options.outputPath);
                        }
                    } else if (parseDirPath) {
                        // the path has only "directory" without parseBase
                        // For example, "ares-device -c /" or "ares-defvice -c ."
                        captureFileName += createDateFileName(null, captureFormat.toLowerCase());
                        destinationPath = path.resolve(parseDirPath);
                    }
                }

                options.captureFormat = captureFormat;
                options.captureFileName = captureFileName;
                options.captureDirPath = "/tmp/aresCapture/";
                options.sourcePath = options.captureDirPath + captureFileName;
                options.destinationPath = destinationPath;
                options.ignore = true;
                options.silent = true;
                
                next();
            }

            function _captureScreenFile(next) {
                log.info("device#captureScreen()#_captureScreenFile()");
                const cmd = "/bin/mkdir -p " + options.captureDirPath;
                options.session.run(cmd, null, null, null, function(err) {
                    if (err) {
                        return setImmediate(next, err);
                    } else {
                        options.createdTmpDir = true;
                        const target = options.session.getDevice(),
                            addr = target.lunaAddr.captureCompositorOutput,
                            param = {
                                // luna param
                                subscribe: false,
                                output : options.sourcePath,
                                format: options.captureFormat,
                                displayId : options.display
                            };

                        luna.send(options, addr, param, function(lineObj, next) {
                            if (lineObj.returnValue) {
                                log.verbose("device#captureScreen()#_captureScreenFile()","Capture file in target:" + lineObj.output);
                                next(null, {});
                            } else {
                                log.verbose("device#captureScreen()#_captureScreenFile()", "failure");
                                next(errHndl.getErrMsg("INVALID_OBJECT"));
                            }
                        }, next);
                    }
                });
            }

            function _copyFileToLocal(next) {
                log.info("device#captureScreen()#_copyFileToLocal()");
                if (!fs.existsSync(options.destinationPath)) {
                    mkdirp(options.destinationPath, function(err) {
                        if (err) {
                            return setImmediate(next, errHndl.getErrMsg(err));
                        } else {
                            pullLib.pull(options, next);
                        }
                    });
                } else {
                    pullLib.pull(options, next);
                }
            }

            function _removeTmpDir(next) {
                log.info("device#captureScreen()#_removeTmpDir()");
                const cmd = '/bin/rm -rf ' + options.captureDirPath;
                options.session.run(cmd, null, null, null, function(err) {
                    if (err) {
                        return setImmediate(next, err);
                    } else {
                        next();
                    }
                });
            }
        }
    };

    function makeSession(options, next){
        options.nReplies = 1; // -n 1
        if (!options.session) {
            log.info("device#makeSession()", "need to make new session");
            const printTarget = true;
            options.session = new novacom.Session(options.device, printTarget, next);
        } else {
            log.info("device#makeSession()", "already exist session");
            next();
        }
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = device;
    }
}());
