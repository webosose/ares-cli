/*
 * Copyright (c) 2020 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const log = require('npmlog');
const cliControl = require('./cli-control');

(function () {
    const errMsgHdlr = {},
        ErrMsgMap = {
            // service's error message, common
            "for category \"/dev\"" : "Please enable \"Developer options\" on your device",

            // appinstalld
            "failed to extract ipk file" : "Please check whether the ipk file is packaged by CLI or not",
            "Failed to parse control" : "Please check whether the ipk file is packaged by CLI or not",
            "Failed to extract package" : "Please check whether the ipk file is packaged by CLI or not",
            "duplicate command" : "Please wait and retry the command",
            "update manifest file failed" : "Please wait and retry the command",
            "Cannnot install privileged app on developer mode" : "Please change the app id (app id should not start with 'com.lge', 'com.webos', 'com.palm')",
            "Cannnot remove privileged app on developer mode" : "You cannot remove the privileged app whose app id start with 'com.lge', 'com.webos', 'com.palm'",
            "unable to execute smack" : "Please remove the app and install again",
            "FAILED_REMOVE" :"Please check app is installed to device by ares-install -l",

            // applicationmanager
            "Cannot find proper launchPoint" : "The app is not installed app. Please check the list by ares-install -l",
            "is not running" : "Please check the list of running apps using ares-launch -r",
            "was not found OR Unsupported Application Type" : "The app is not installed. Please check the list of installed apps using ares-install -l",
            "invalid parameters" : "Invalid parameters are passed. Please check the parameters",
            "app is locked" : "The app is now installing/updating/deleting. Please try again later",

            // com.webos.service.sessionmanager
            "Service does not exist: com.webos.service.sessionmanager" : "This device does not support multiple sessions",

            // com.webos.surfacemanager
            "ERR_INVALID_DISPLAY" : "Please use a valid value for display id",

            "EACCES" : "No permission to execute. Please check the directory permission",
            "ECONNREFUSED": "Connection refused. Please check the device IP address or the port number",
            "ECONNRESET": "Unable to connect to the device. Please check the device",
            "ENOENT": "Please check if the path is valid",
            "TIME_OUT": "Connection timed out. Please check the device IP address or the port number",
            "NO_FREE_SPACE": "Installation failure. Please check if there is sufficient free space in the disk",

            // can be external lib error
            "Authentication failure": "ssh authentication failure. Please check the ssh connection info such as password, private key and username again",
            "connect Unknown system" : "Please check the device IP address or the port number",
            "Unable to parse private key": "Wrong passphrase for ssh key. Please check passphrase again",
            "Unable to request a pseudo-terminal": "Unable to open terminal (Target does not allow to open pty)",

            // invalid appinfo, service
            "REQUIRED_FIELD" : "Please input required field",
            "INVALID_ID_RULE": "The app/pkg ID should consist of lowercase letters (a-z), numbers (0-9), plus (+) and minus (-) signs and periods (.)",
            "INVALID_VERSION_RULE" : "The app/pkg version number should consist of three non-negative integers, separated by dots.\nEach number cannot exceed 9 digits and cannot contain leading zeroes",
            "NOT_EXCLUDE_APPINFO" : "You cannot exclude the appinfo.json file",
            "NOT_RELATIVE_PATH_APPINFO" : "The pathname must be relative to the directory where the appinfo.json file is located",
            "NO_METAFILE" : "No meta file (ex. appinfo.json, services.json) exists in the project directory",
            "NO_ACCOUNT" : "Account directory is not supported. Please delete the 'account-templates.json' file.",
            "OVER_APPCOUNT" : "You can package only one application at once",
            "INVALID_SERVICEID" : "ServiceID must start with package id",
            "FAILED_MINIFY" : "Failed to minify code. Please check the source code",

            // invalid value
            "INVALID_JSON_FORMAT" : "Invalid JSON format",
            "INVALID_ARGV" : "Please check arguments",
            "INVALID_DISPLAY" : "Please use nonnegative integer value for the \"display\" option",
            "INVALID_TEMPLATE" : "Invalid template name",
            "INVALID_FILE" : "Invalid file",
            "INVALID_VALUE" : "Invalid value",
            "INVALID_DEVICENAME" : "Invalid device name. Do not use letters starting with '%' or '$'",
            "INVALID_OBJECT" : "Object format error",
            "INVALID_MODE" : "Please specify an option, either '--add' or '--modify'",
            "INVALID_CAPTURE_FORMAT" : "Please specify the file extension(.png, .bmp or .jpg)",
            "INVALID_COMMAND" : "This command is invalid. Please check the supported commands using ares -l",
            
            // set value & type error
            "EMPTY_PROFILE" : "Profile is empty",
            "EMPTY_VALUE" : "Please specify a value",
            "EXISTING_VALUE" : "The specified value already exists",
            "EXISTING_FILETYPE_PATH" : "A file with the same name at the specified location already exists",
            "NOT_DIRTYPE_PATH" : "The specified path is not a directory",
            "NOT_EXIST_PATH" : "The specified path does not exist",
            "NOT_EXIST_SSHKEY_PASSWD" : "Private key file or password does not exist",
            "NOT_EXIST_DISPLAY" : "No existing displayId from getSessionList",
            "NOT_SUPPORT_SESSION" : "This device does not support multiple sessions",
            "NOT_SUPPORT_ENYO" : "Enyo app packaging is not supported",
            "NOT_SUPPORT_AUTHTYPE" : "Not supported auth type",
            "NOT_SUPPORT_RUNNINGLIST" : "Not supported method to get running app information",
            "NOT_USE_WITH_OPTIONS" : "Do not use together with options",

            "USE_WITH_OPTIONS" : "Use together with options",
            "USE_PKGID_PKGINFO" : "packageId must be provided by using either the '--pkgid' or the '--pkginfofile' option",
            "USE_GDB" : "Please use GDB to debug a native serivce",
            "NOT_IMPLEMENTED" : "Not implemented",
            "NOT_HANDLE_FILE" : "Don't know how to handle",
            "NOT_OVERWRITE_DIR" : "Cannot overwrite the directory",

            "UNMATCHED_DEVICE" : "No matched device",
            "CANNOT_REMOVE_DEVICE" : "Cannot remove the device",
            "UNMATCHED_DISPLAY_AFFINITY" : "Please use the same value for \"display\" and \"displayAffinity\"",

            "FAILED_CALL_LUNA" : "luna-send command failed",
            "FAILED_GET_PORT" : "Failed to get Debug port",
            "FAILED_GET_SVCPATH" : "Failed to get service installation path",
            "FAILED_GET_SSHKEY" : "Failed to get ssh private key",
            "FAILED_TRANSMIT_FILE" : "File transmission error. Please try again",
            "FAILED_CREATE_DIR" : "Cannot create directory in the destination path - permission denied",
            "FAILED_REMOVE_PACKAGE" : "No packages installed or removed",
            "FAILED_FIND_SERVICE" : "Failed to find a service with the specified name",

            "CONNECTED_MULTI_DEVICE" : "Multiple devices are connected by novacom. Please specify the target name",
            "SET_DEFAULT_MULTI_DEVICE" : "Multiple devices are set to default target. Please reset device list",
            "NEED_ROOT_PERMISSION" : "Unable to connect to the target device. root access required",
            "MISSING_CALLBACK" : "Missing completion callback",
            "USING_WEBINSPECTOR" : "Web Inspector is already connected with another browser. Please close the previous connection",
            "UNKNOWN_OPERATOR" : "Unknown operator",
            "UNABLE_USE_SFTP" : "Unable to use sftp",
        };

    errMsgHdlr.finish = function(err, value) {
        if(err) {
            if (typeof(err) === "string") {
                log.error(err.toString());
                log.verbose(err.stack);
            } else if (typeof(err) == "object") {
                if (err.length === undefined) { // single error
                    log.error(err.heading, err.message);
                    log.verbose(err.stack);
                } else if (err.length > 0) { // [service/system] + [tips] error
                    for(const index in err) {
                        log.error(err[index].heading, err[index].message);
                    }
                    log.verbose(err[0].stack);
                }
            }
            cliControl.end(-1);
        } else {
            log.info('finish():', value);
            if (value && value.msg) {
                console.log(value.msg);
            }
            cliControl.end();
        }
    };

    errMsgHdlr.getServiceErrMsg = function(service, errKey, errText) {
        log.info("errMsgHdlr#getServiceErrMsg():", "service:", service, "errKey:", errKey, "errText:" + errText);
        
        // make [service] error with errKey & errText
        const resultErr = [];
        const serviceErr = errMsgHdlr.getErrMsg(errKey, errText, null, service);
        if(serviceErr.message){
            resultErr.push(serviceErr);
        }

        const tipsErr = errMsgHdlr.getErrMsg(errText);
        if(tipsErr.message){
            resultErr.push(tipsErr);
        }
            
        return resultErr;         
    };

    errMsgHdlr.getSyscallErrMsg = function(err) {
        log.info("errMsgHdlr#getSyscallErrMsg():", "code:", err.code, "syscall:", err.syscall, "message:" + err.message);

        // only handle object type's system or ssh err
        // if error is not oject, return err.
        if(typeof(err) !== "object") {
            return err;
        }

        const resultErr = [],
            message = err.message.trim(),
            option = err.path;

        let heading = "syscall",
            code = err.code;

        // handle as "ssh execution error"
        if (!err.syscall) {
            heading = "ssh exec";
            code = err.message.trim();
        }
        
        const sysCallErr = new CLIError(heading, message);
        if(sysCallErr.message){
            resultErr.push(sysCallErr);
        }

        const tipsErr = errMsgHdlr.getErrMsg(code, option);
        if(tipsErr.message){
            resultErr.push(tipsErr);
        }

        return resultErr;        
    };

    // Tips cli error msg
    errMsgHdlr.getErrMsg = function(errKey, option, value, heading) {
        log.info("errMsgHdlr#getErrMsg():", "errKey:", errKey, "option:", option, "value:", value, "heading:", heading);

        if(!errKey){
            return errKey;
        }

        let returnMsg;
        if(typeof(errKey) === 'string') {
            for (const key in ErrMsgMap) {
                if (errKey.toString() === key || errKey.includes(key)) {
                    returnMsg = ErrMsgMap[key];
                    if (option) {
                        returnMsg = returnMsg + " <" + option+ ">";
                    }
                    if (value) {
                        returnMsg = returnMsg + " : " + value;
                    }
                    break;
                }
            }
        }

        if(!returnMsg) {
            return errKey; // Do not change modify this line.
        }
        return new CLIError(heading, returnMsg);
    };

    function CLIError(heading, message) {
        if(heading) {
             this.heading = "[" + heading + " failure"+ "]:";
        }
        this.message = message;
        this.stack = Error().stack;
    }

    CLIError.prototype = Object.create(Error.prototype);
    CLIError.prototype.heading = "[Tips]:";
    CLIError.prototype.name = "";

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = errMsgHdlr;
    }
}());
