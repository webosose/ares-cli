/*
 * Copyright (c) 2020 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

(function () {
    const errMsgHdlr = {},
        ErrCodeMap = {},
        ErrMsgMap = {
        "EACCES" : "Permission denied. Please check the directory permission",
        "ECONNREFUSED": "Connection refused. Please check the device IP address or the port number",
        "ECONNRESET": "Unable to connect to the device. Please check the device",
        "TIME_OUT": "Connection timed out. Please check the device IP address or the port number",
        "NO_FREE_SPACE": "Installation failure. Please check if there is sufficient free space in the disk",

        // can be external lib error
        "Authentication failure": "ssh authentication failure. Please check the ssh connection info such as password, private key and username again",
        "connect Unknown system" : "Please check the device IP address or the port number",
        "Unable to parse private key": "Wrong passphrase for ssh key. Please check passphrase again",
        "Unable to request a pseudo-terminal": "Unable to open terminal (Target does not allow to open pty)",

        // invalid appinfo
        "REQUIRED_FIELD" : "Please input required field",
        "INVALID_ID_RULE": "The app/pkg ID should consist of lowercase letters (a-z), numbers (0-9), plus (+) and minus (-) signs and periods (.)",
        "INVALID_VERSION_RULE" : "The app/pkg version number should consist of three non-negative integers, separated by dots.\n\t\t Each number cannot exceed 9 digits and cannot contain leading zeroes",
        "NOT_EXCLUDE_APPINFO" : "You cannot exclude the appinfo.json file",
        "NOT_RELATIVE_PATH_APPINFO" : "The pathname must be relative to the directory where the appinfo.json file is located",

        // invalid value
        "INVALID_JSON_FORMAT" : "Invalid JSON format",
        "INVALID_ARGV" : "Please check arguments",
        "INVALID_DISPLAY" : "Please use nonnegative integer values for the \"display\" option",
        "INVALID_TEMPLATE" : "Invalid template name",
        "INVALID_FILE" : "Invalid file",
        "INVALID_VALUE" : "Invalid value",
        "INVALID_DEVICENAME" : "Invalid device name. Please use letters, numbers and allowed characters ('-', '_', '#')",
        "INVALID_OBJECT" : "Object format error",
        "INVALID_MODE" : "Please specify an option, either '--add' or '--modify'",
        "INVALID_CAPTURE_FORMAT" : "Please specify file extension, either 'png' 'bmp' or 'jpg'",

        // set value & type error
        "EMPTY_PROFILE" : "Profile is empty",
        "EMPTY_VALUE" : "Please specify a value",
        "EXISTING_VALUE" : "The specified value already exists",
        "EXISTING_FILETYPE_PATH" : "A file with the same name at the specified location already exists",
        "NOT_DIRTYPE_PATH" : "The speficied path is not a directory",
        "NOT_EXIST_PATH" : "The specified path does not exist",
        "NOT_EXIST_SSHKEY_PASSWD" : "Private key file or password does not exist",
        "NOT_EXIST_DISPLAY" : "No existing displayId from getSessionList",
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

    errMsgHdlr.getErrMsg = function(service, code) {
        if (Object.prototype.hasOwnProperty.call(ErrCodeMap, service)) {
            return ErrCodeMap[service][code];
        }
        return undefined;
    };

    errMsgHdlr.changeErrMsg = function(err, option, value) {
        if (!err) {
            return err; // err is undefinded
        }

        let returnMsg;
        for (const key in ErrMsgMap) {
            if (err.toString() === key) {
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

        if (!returnMsg) {
            return err;
        }
        return new CLIError(returnMsg);
    };

    function CLIError(message) {
        this.message = message;
        this.stack = Error().stack;
    }

    CLIError.prototype = Object.create(Error.prototype);
    CLIError.prototype.name = "CLI";

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = errMsgHdlr;
    }
}());
