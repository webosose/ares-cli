/*
 * Copyright (c) 2020 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const async = require('async'),
    CombinedStream = require('combined-stream'),
    chardet = require('chardet'),
    ElfParser = require('elfy').Parser,
    encoding = require('encoding'),
    fs = require('fs'),
    fstream = require('fstream'),
    log = require('npmlog'),
    mkdirp = require('mkdirp'),
    path = require('path'),
    rimraf = require('rimraf'),
    shelljs = require('shelljs'),
    stripbom = require('strip-bom'),
    temp = require('temp'),
    uglify = require('terser'),
    util = require('util'),
    Validator = require('jsonschema').Validator,
    zlib = require('zlib'),
    crypto = require('crypto'),
    tarFilterPack = require('./tar-filter-pack'),
    errHndl = require('./base/error-handler');

(function () {
    log.heading = 'packager';
    log.level = 'warn';

    const servicePkgMethod = 'id',
        defaultAssetsFields = {
            "main": true,
            "icon": true,
            "largeIcon": true,
            "bgImage": true,
            "splashBackground": true,
            "imageForRecents": true,
            "sysAssetsBasePath": true
        },
        FILE_TYPE = {
            file: 'file',
            dir: 'dir',
            symlink: 'symlink'
        },
        packager = {};
    let objectCounter = 0;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = packager;
    }

    function Packager(options) {
        this.objectId = objectCounter++;
        this.verbose = false;
        this.silent = true;

        if (options && options.level) {
            log.level = options.level;
            if (['warn', 'error'].indexOf(options.level) !== -1) {
                this.silent = false;
            }
        }

        this.noclean = false;
        if (options && options.noclean === true) {
            this.noclean = true;
        }

        this.nativecmd = false;
        if (options && options.nativecmd === true) {
            this.nativecmd = true;
        }

        this.minify = true;
        if (options && Object.prototype.hasOwnProperty.call(options, 'minify')) {
            this.minify = options.minify;
        }

        this.excludeFiles = [];
        if (options && Object.prototype.hasOwnProperty.call(options, 'excludefiles')) {
            if (options.excludefiles instanceof Array) {
                this.excludeFiles = options.excludefiles;
            } else {
                this.excludeFiles.push(options.excludefiles);
            }
        }

        this.rom = false;
        if (options && Object.prototype.hasOwnProperty.call(options, 'rom')) {
            this.rom = options.rom;
        }

        this.encrypt = false;
        if (options && Object.prototype.hasOwnProperty.call(options, 'encrypt')) {
            this.encrypt = options.encrypt;
        }

        this.sign = "";
        if (options && Object.prototype.hasOwnProperty.call(options, 'sign')) {
            this.sign = options.sign;
        }

        this.certificate = "";
        if (options && Object.prototype.hasOwnProperty.call(options, 'certificate')) {
            this.certificate = options.certificate;
        }

        log.verbose("Xtor Packager id=" + this.objectId);
        this.appCount = 0;
        this.services = [];
        this.pkgServiceNames = [];
        this.pkgVersion = options.pkgversion || "1.0.0";

        if (options && Object.prototype.hasOwnProperty.call(options, 'pkgid')) {
            this.pkgId = options.pkgid;
        }

        if (options && Object.prototype.hasOwnProperty.call(options, 'pkginfofile')) {
            this.pkginfofile = options.pkginfofile;
        }
    }

    packager.Packager = Packager;

    Packager.prototype = {
        checkInputDirectories: function(inDirs, options, next) {
            log.verbose("checkInputDirectories: " + inDirs);

            async.forEachSeries(inDirs, checkDirectory.bind(this, options),
                function(err) {
                    if (err) {
                        setImmediate(next, err);
                        return;
                    }
                    setImmediate(next);
                });
            return this.appCount;
        },
        servicePackaging: function(inDirs, destination, options, next) {
            log.verbose("callled servicePackaging");
            async.series([
                    this.checkInputDirectories.bind(this, inDirs, options),
                    setUmask.bind(this, 0),
                    loadPkgInfo.bind(this),
                    createTmpDir.bind(this),
                    excludeIpkFileFromApp.bind(this),
                    createPackageDir.bind(this),
                    fillPackageDir.bind(this),
                    findServiceDir.bind(this, this.services),
                    loadServiceInfo.bind(this),
                    checkServiceInfo.bind(this),
                    createServiceDir.bind(this),
                    copyService.bind(this),
                    addServiceInPkgInfo.bind(this),
                    copyData.bind(this, inDirs, options.force),
                    loadPackageProperties.bind(this, inDirs),
                    excludeFromApp.bind(this),
                    outputPackage.bind(this, destination),
                    encryptPackage.bind(this),
                    copyOutputToDst.bind(this, destination),
                    recoverUmask.bind(this),
                    cleanupTmpDir.bind(this)
                ], function(err) {
                    if (err) {
                        // TODO: call cleanupTmpDir() before returning
                        setImmediate(next, err);
                        return;
                    }
                    // TODO: probably some more checkings are needed
                    setImmediate(next, null, {ipk: this.ipk, msg: "Success"});
                }.bind(this));
        },
        generatePackage: function(inDirs, destination, options, next) {
            log.verbose("generatePackage: from " + inDirs);
            // check whether app or service directories are copied or not
            this.dataCopyCount = 0;
            this.minifyDone = !this.minify;
            async.series([
                    this.checkInputDirectories.bind(this, inDirs, options),
                    setUmask.bind(this, 0),
                    loadAppInfo.bind(this),
                    checkAppInfo.bind(this),
                    createTmpDir.bind(this),
                    createAppDir.bind(this),
                    checkELFHeader.bind(this),
                    fillAssetsField.bind(this),
                    copyAssets.bind(this),
                    copyApp.bind(this),
                    excludeIpkFileFromApp.bind(this),
                    createPackageDir.bind(this),
                    fillPackageDir.bind(this),
                    findServiceDir.bind(this, this.services),
                    loadServiceInfo.bind(this),
                    checkServiceInfo.bind(this),
                    createServiceDir.bind(this),
                    copyService.bind(this),
                    addServiceInPkgInfo.bind(this),
                    removeServiceFromAppDir.bind(this),
                    copyData.bind(this, inDirs, options.force),
                    loadPackageProperties.bind(this, inDirs),
                    excludeFromApp.bind(this),
                    outputPackage.bind(this, destination),
                    encryptPackage.bind(this),
                    copyOutputToDst.bind(this, destination),
                    recoverUmask.bind(this),
                    cleanupTmpDir.bind(this)
                ], function(err) {
                    if (err) {
                        // TODO: call cleanupTmpDir() before returning
                        setImmediate(next, err);
                        return;
                    }
                    // TODO: probably some more checkings are needed
                    setImmediate(next, null, {ipk: this.ipk, msg: "Success"});
                }.bind(this));
        }
    };

    function Service() {
        this.srcDir = "";
        this.dstDirs = [];
        this.valid = false;
        this.serviceInfo = "";
        this.dirName = "";
    }

    // Private functions
    function loadPkgInfo(next) {
        log.verbose("loadPkgInfo");
        let data;

        if (!this.pkginfofile) {
            return setImmediate(next);
        }

        if (fs.existsSync(this.pkginfofile)) {
            if ("packageinfo.json" !== path.basename(this.pkginfofile)) {
                return setImmediate(next, errHndl.changeErrMsg("INVALID_FILE", "packageinfo.json"));
            }

            data = rewriteFileWoBOMAsUtf8(this.pkginfofile, true);
            try {
                log.verbose("PKGINFO >>" + data + "<<");
                this.pkginfo = JSON.parse(data);

                if (!Object.prototype.hasOwnProperty.call(this.pkginfo, 'id')) {
                    return setImmediate(next, errHndl.changeErrMsg("REQUIRED_FIELD", "id"));
                }

                this.pkgId = this.pkginfo.id;
                this.pkgVersion = this.pkginfo.version || this.pkgVersion;
                setImmediate(next);
            }
            catch(err) {
                return setImmediate(next, errHndl.changeErrMsg("INVALID_JSON_FORMAT", "packageinfo.json"));
            }
        } else {
            return setImmediate(next, errHndl.changeErrMsg("NOT_EXIST_PATH", this.pkginfofile));
        }
    }

    function loadAppInfo(next) {
        log.verbose("loadAppInfo");
        if (this.appCount === 0) {
            return setImmediate(next);
        }

        const filepath = path.join(this.appDir, "appinfo.json"),
            data = rewriteFileWoBOMAsUtf8(filepath, true);
        try {
            log.verbose("APPINFO >>" + data + "<<");
            this.appinfo = JSON.parse(data);

            if (!this.appinfo.version || this.appinfo.version === undefined) {
                this.appinfo.version = "1.0.0";
            }

            this.pkgVersion = this.appinfo.version;
            setImmediate(next);
        } catch(err) {
            setImmediate(next, err);
        }
    }

    function checkAppInfo(next) {
        log.verbose("checkAppInfo");
        if (this.appCount === 0) {
            return setImmediate(next);
        }

        // check enyo app
        if (this.pkgJSExist && this.appinfo.main && this.appinfo.main.match(/(\.html|\.htm)$/gi)) {
            const mainFile = path.join(this.appDir, this.appinfo.main);
            if (!fs.existsSync(mainFile)) {
                return setImmediate(next, errHndl.changeErrMsg("NOT_EXIST_PATH", this.appinfo.main));
            }

            const regex = new RegExp("(<script[^>]*src[ \t]*=[ \t]*['\"])[^'\"]*/enyo.js(['\"])"),
                data = fs.readFileSync(mainFile);
            if (data.toString().match(regex)) {
                // If enyo app, stop packaging.
                return setImmediate(next, errHndl.changeErrMsg("NOT_SUPPORT_ENYO"));
            }
        }

        if (!this.appinfo.id || this.appinfo.id === undefined) {
            return setImmediate(next, errHndl.changeErrMsg("REQUIRED_FIELD", "id"));
        }
        if (this.appinfo.id.length < 1 || !(/^[a-z0-9.+-]*$/.test(this.appinfo.id))) {
            log.error(errHndl.changeErrMsg("INVALID_VALUE", "id", this.appinfo.id));
            return setImmediate(next, errHndl.changeErrMsg("INVALID_ID_RULE"));
        }
        if (this.appinfo.version.length < 1 || !(/^([1-9]\d{0,8}|\d)\.([1-9]\d{0,8}|\d)\.([1-9]\d{0,8}|\d)$/.test(this.appinfo.version))) {
            log.error(errHndl.changeErrMsg("INVALID_VALUE", "version", this.appinfo.version));
            return setImmediate(next, errHndl.changeErrMsg("INVALID_VERSION_RULE"));
        }
        if (this.appinfo.type && this.appinfo.type.match(/clock/gi)) {
            return setImmediate(next);
        }

        const schemaFile = path.join(__dirname, "../files/schema/ApplicationDescription.schema");
        async.waterfall([
            fs.readFile.bind(this, schemaFile, "utf-8"),
            function getSchema(data, next) {
                try {
                    const schema = JSON.parse(data);
                    /* "required" keyword is redefined in draft 4.
                        But current jsonschema lib support only draft 3.
                        So this line changes "required" attribute according to the draft 3.
                    */
                    const reqKeys = schema.required;
                    if (reqKeys) {
                        for (const key in schema.properties) {
                            if (reqKeys.indexOf(key) !== -1) {
                                schema.properties[key].required = true;
                            }
                        }
                    }
                    next(null, schema);
                } catch(err) {
                    next(errHndl.changeErrMsg("INVALID_JSON_FORMAT", "AppDescription schema"));
                }
             },
            function checkValid(schema, next) {
                try {
                    next(null, new Validator().validate(this.appinfo, schema));
                } catch (err) {
                    log.error(err);
                    next(errHndl.changeErrMsg("INVALID_JSON_FORMAT"));
                }
            }.bind(this)
        ], function(err, result){
            if (err) {
                setImmediate(next, err);
            } else {
                if (result && result.errors.length > 0) {
                    const errFile = "appinfo.json";
                    let errMsg = "";
                    for (const idx in result.errors) {
                        let errMsgLine = result.errors[idx].property + " " + result.errors[idx].message;
                        if (errMsgLine.indexOf("instance.") > -1) {
                            errMsgLine = errMsgLine.substring("instance.".length);
                            errMsg = errMsg.concat("\n");
                            errMsg = errMsg.concat(errMsgLine);
                        }
                    }
                    errMsg = errHndl.changeErrMsg("INVALID_FILE", errFile, errMsg);
                    return setImmediate(next, errMsg);
                } else {
                    log.verbose("APPINFO is valid");
                }
                setImmediate(next);
            }
        });
    }

    function fillAssetsField(next) {
        log.verbose("fillAssetsField");
        if (this.appCount === 0) {
            return setImmediate(next);
        }
        // make appinfo.assets to have default  values so that they can be copied into the package
        this.appinfo.assets = this.appinfo.assets || [];
        for (const i in this.appinfo) {
            if (Object.prototype.hasOwnProperty.call(this.appinfo, i) && defaultAssetsFields[i]) {
                // no duplicated adding & value should not null string & file/dir should exist
                if ((this.appinfo.assets.indexOf(this.appinfo[i]) === -1) && this.appinfo[i]) {
                    this.appinfo.assets.push(this.appinfo[i]);
                }
            }
        }

        // refer to appinfo.json files in localization directory.
        const appInfoPath = this.originAppDir,
            checkDir = path.join(this.originAppDir, "resources"),
            foundFilePath = [],
            resourcesAssets = [];

        try {
            const stat = fs.lstatSync(checkDir);
            if (!stat.isDirectory()) {
                return setImmediate(next, null);
            }
        } catch(err) {
            if (err.code === "ENOENT") {
                return setImmediate(next, null);
            }
        }

        async.series([
             walkFolder.bind(null, checkDir, "appinfo.json", foundFilePath, 1),
             function(next) {
                async.forEach(foundFilePath, function(filePath, next) {
                    rewriteFileWoBOMAsUtf8(filePath, true, function(data) {
                        try {
                            const appInfo = JSON.parse(data),
                                dirPath = path.dirname(filePath);
                            for (const i in appInfo) {
                                if (Object.prototype.hasOwnProperty.call(appInfo, i) && defaultAssetsFields[i]) {
                                    if (appInfo[i]) {
                                        const itemPath = path.join(dirPath, appInfo[i]),
                                            relPath = path.relative(appInfoPath, itemPath);
                                        // no duplicated adding & value should not null string & file/dir should exist
                                        if ((resourcesAssets.indexOf(relPath) === -1)) {
                                            resourcesAssets.push(relPath);
                                        }
                                    }
                                }
                            }
                            setImmediate(next, null);
                        } catch(error) {
                            setImmediate(next, errHndl.changeErrMsg("INVALID_JSON_FORMAT", filePath));
                        }
                    });
                }, function(err) {
                    setImmediate(next, err);
                });
            },
            function(next) {
                this.appinfo.assets = this.appinfo.assets.concat(resourcesAssets);
                setImmediate(next, null);
            }.bind(this)
        ], function(err) {
            setImmediate(next, err);
        });
    }

    function createTmpDir(next) {
        log.verbose("createTmpDir");
        this.tempDir = temp.path({prefix: 'com.palm.ares.hermes.bdOpenwebOS'}) + '.d';
        log.verbose("temp dir = " + this.tempDir);
        mkdirp(this.tempDir, next);
    }

    function createAppDir(next) {
        log.verbose("createAppDir");
        if (this.appCount === 0) {
            return setImmediate(next);
        }

        this.applicationDir = path.join(this.tempDir, "data/usr/palm/applications", this.appinfo.id);
        log.verbose("application dir = " + this.applicationDir);
        mkdirp(this.applicationDir, next);
    }

    function copySrcToDst(src, dst, next) {
        log.verbose("called copySrcToDst");
        const fileList = [],
            self = this,
            requireMinify = !!((!!self.minify && !self.minifyDone));
        src = path.normalize(path.resolve(src));
        dst = path.normalize(path.resolve(dst));

        async.series([
            function(next) {
                const stat = fs.statSync(src);
                if (stat.isFile()) {
                    _pushList(fileList, 'file', path.dirname(src), path.basename(src), true, null);
                    setImmediate(next);
                } else {
                    _getFileList(src, src, fileList, next);
                }
            },
            _copySrcToDst.bind(null, fileList, dst, requireMinify)
        ], function(err) {
            next(err);
        });

        function _pushList(list, type, basePath, relPath, isSubPath, indRelPath) {
            if (!FILE_TYPE[type]) {
                return;
            }
            list.push({
                type: type,
                basePath: basePath,
                relPath: relPath,
                isSubPath: isSubPath,
                indRelPath: indRelPath
            });
        }

        function _getFileList(dirPath, basePath, files, next) {
            // TODO: the following code should be more concise.
            //  Handling symbolic links
            //    if the path sym-link indicates is a sub-path of source directory, treat a sym-link as it is.
            //    otherwise the files sym-link indicates should be copied
            async.waterfall([
                fs.readdir.bind(null, dirPath),
                function(fileNames, next) {
                    if (fileNames.length === 0) {
                        _pushList(files, 'dir', basePath, path.relative(basePath, dirPath), true, null);
                        return setImmediate(next);
                    }

                    async.forEachSeries(fileNames, function(fileName, next) {
                        const filePath = path.join(dirPath, fileName),
                            relPath = path.relative(basePath, filePath);

                        async.waterfall([
                            fs.lstat.bind(null, filePath),
                            function(lstat, next) {
                                if (lstat.isSymbolicLink()) {
                                    let indicateFullPath;
                                    try {
                                        indicateFullPath = fs.realpathSync(filePath);
                                    } catch (err) {
                                        if (err.code === 'ENOENT') {
                                            log.warn("The file for symbolic link ("+ filePath + ") is missing..." );
                                            return setImmediate(next);
                                        }
                                        return setImmediate(next, err);
                                    }

                                    const indicateRelPath = fs.readlinkSync(filePath);
                                    if (indicateFullPath.indexOf(basePath) !== -1) {
                                        _pushList(files, 'symlink', basePath, relPath, true, indicateRelPath);
                                    } else {
                                        const stat = fs.statSync(filePath);
                                        if (stat.isDirectory()) {
                                            return _getFileList(filePath, basePath, files, next);
                                        } else if (stat.isFile()) {
                                            _pushList(files, 'file', basePath, relPath, true, null);
                                        }
                                    }
                                    setImmediate(next);
                                } else if (lstat.isDirectory()) {
                                    return _getFileList(filePath, basePath, files, next);
                                } else if (lstat.isFile()){
                                    _pushList(files, 'file', basePath, relPath, true, null);
                                    setImmediate(next);
                                } else {
                                    setImmediate(next);
                                }
                            }
                        ], next); // async.waterfall
                    }, next); // async.forEach
                 }
            ], function(err) {
                return setImmediate(next, err);
            }); // async.waterfall
        }

        function _copySrcToDst(files, dstPath, minify, next) {
            try {
                async.forEachSeries(files, function(file, next) {
                    if (!FILE_TYPE[file.type]) {
                        log.verbose("copySrcToDst#_copySrcToDst#ignore 'unknown file type'("+file.type+")");
                        return;
                    }

                    if (!file.relPath) {
                        log.verbose("copySrcToDst#_copySrcToDst#ignore 'unknown path'");
                        return setImmediate(next);
                    }

                    if (file.type === FILE_TYPE.dir) {
                        mkdirp.sync(path.join(dstPath, file.relPath));
                        return setImmediate(next);
                    }

                    const dstDirPath = path.dirname(path.join(dstPath, file.relPath));
                    if (!fs.existsSync(dstDirPath)) {
                        mkdirp.sync(dstDirPath);
                    }

                    if (file.type === FILE_TYPE.symlink) {
                        if (file.isSubPath && file.indRelPath) {
                            const linkFile = path.join(dstPath, file.relPath);
                            if (fs.existsSync(linkFile)) {
                                if (fs.lstatSync(linkFile).isSymbolicLink()) {
                                    fs.unlinkSync(linkFile);
                                }
                            }
                            fs.symlinkSync(file.indRelPath, linkFile, null);
                        }
                    } else {
                        const sourceFile = path.join(file.basePath, file.relPath);
                        if (fs.existsSync(sourceFile)) {
                            if (minify && '.js' === path.extname(sourceFile) && file.relPath.indexOf('node_modules') === -1 ) {
                                log.verbose("copySrcToDst#_copySrcToDst(),require minification # sourceFile:", sourceFile);
                                try {
                                    const data = uglify.minify(fs.readFileSync(sourceFile,'utf8'));
                                    if (data.error) {
                                        throw data.error;
                                    }
                                    fs.writeFileSync(path.join(dstPath, file.relPath), data.code, 'utf8');
                                } catch (e) {
                                    log.verbose(util.format('Failed to uglify code %s: %s', sourceFile, e.stack));
                                    return setImmediate(next, new Error(util.format('failed to minify code %s', sourceFile)));
                                }
                            } else {
                                shelljs.cp('-Rf', sourceFile, path.join(dstPath, file.relPath, '..'));
                            }
                        } else {
                            log.verbose("copySrcToDst#_copySrcToDst#ignore '" + file.relPath + "'");
                        }
                    }
                    setImmediate(next);
                }, function(err) {
                    if (!err && minify) {
                        self.minifyDone = true;
                    }
                    setImmediate(next, err);
                });
            } catch(err) {
                setImmediate(next, err);
            }
        }
    }

    function checkELFHeader(next) {
        log.verbose("checkELFHeader");
        const self = this,
            ELF_HEADER_LEN = 64,
            buf = Buffer.alloc(ELF_HEADER_LEN),
            mainFile = path.resolve(path.join(this.appDir, this.appinfo.main)),
            fd = fs.openSync(mainFile, 'r'),
            stats = fs.fstatSync(fd),
            elfParser = new ElfParser(),
            _isELF = function(_buf) {
                if (_buf.slice(0, 4).toString() !== '\x7fELF') {
                    return false;
                } else {
                    return true;
                }
            };

        if (stats.size < ELF_HEADER_LEN) {
            log.verbose("checkELFHeader():", "file size is smaller than ELF Header size");
            return setImmediate(next);
        }

        fs.read(fd, buf, 0, ELF_HEADER_LEN, 0, function(err, bytesRead, _buf) {
                if (bytesRead < ELF_HEADER_LEN || err) {
                    log.verbose("checkELFHeader():", "err:", err, ", bytesRead:", bytesRead);
                    log.verbose("checkELFHeader():", "readBuf to parse ELF header is small or error occurred during reading file.");
                    return setImmediate(next);
                }

                if (!_isELF(_buf)) {
                    log.verbose("checkELFHeader():", mainFile + " is not ELF format");
                } else {
                    log.verbose("checkELFHeader():", mainFile + " is ELF format");
                    try {
                        const elfHeader = elfParser.parseHeader(_buf);
                        log.verbose("checkELFHeader():", "elfHeader:", elfHeader);

                        if (elfHeader.machine && elfHeader.machine.match(/86$/)) {
                            //  current emulator opkg is allowing only all, noarch and i586.
                            //   when it is used with --offline-root.
                            self.architecture = 'i586';
                        } else if (elfHeader.machine && elfHeader.machine.match(/amd64$/)) {
                            //  change amd64 to x86_64
                            self.architecture = 'x86_64';
                        } else if (elfHeader.machine && elfHeader.machine.match(/AArch64$/)) {
                            //  change AArch64 to aarch64
                            self.architecture = 'aarch64';
                        } else {
                            self.architecture = elfHeader.machine;
                        }
                    } catch(e) {
                        log.verbose("checkELFHeader():", "exception:", e);
                    }
                }
                log.verbose("checkELFHeader():", "machine:", self.architecture);
                fs.close(fd);
                setImmediate(next);
        });
    }

    function copyApp(next) {
        log.verbose("copyApp()");
        if (this.appCount === 0) {
            return setImmediate(next);
        }

        this.dataCopyCount++;
        log.verbose("copyApp(), copy " + this.appDir + " ==> " + this.applicationDir);
        copySrcToDst.call(this, this.appDir, this.applicationDir, next);
    }

    function copyAssets(next) {
        log.verbose("copyAssets");
        if (this.appCount === 0) {
            return setImmediate(next);
        }

        try {
            async.forEachSeries(this.appinfo.assets, _handleAssets.bind(this), next);
        } catch (err) {
            return setImmediate(next, err);
        }

        function _handleAssets(file, next) {
            log.verbose("copyAssets():", "_handleAssets()");
            if (path.resolve(this.originAppDir) === path.resolve(this.appDir)) {
                _checkAppinfo.call(this, file, next);
            } else {
                async.series([
                    _checkAppinfo.bind(this, file),
                    _copyAssets.bind(this, file)
                ], next);
            }
        }

        function _checkAppinfo(file, next) {
            log.verbose("copyAssets():", "_checkAppinfo()");
            let source;
            if (path.resolve(file) === path.normalize(file)) {
                return next(errHndl.changeErrMsg("NOT_RELATIVE_PATH_APPINFO", file));
            } else {
                source = path.join(this.originAppDir, file);
            }

            if (path.resolve(source).indexOf(this.originAppDir) !== 0) {
                return next(errHndl.changeErrMsg("NOT_RELATIVE_PATH_APPINFO", file));
            }

            if (!fs.existsSync(source) && !this.rom) {
                const msg = errHndl.changeErrMsg("NOT_EXIST_PATH", file);
                if (path.basename(source).indexOf('$') === 0) {
                    // ignore property with starting $ prefix (dynamic property handling in the platform)
                    return setImmediate(next);
                } else {
                    return setImmediate(next, msg);
                }
            }
            setImmediate(next);
        }

        function _copyAssets(file, next) {
            log.verbose("copyAssets():", "_copyAssets()");
            log.verbose("copyAssets # '" + file + "' will be located in app directory");
            const source = path.join(this.originAppDir, file),
                destination = this.appDir;

            async.series([
                function(next) {
                    if (!fs.existsSync(destination)) {
                        mkdirp(destination, next);
                    } else {
                        setImmediate(next);
                    }
                }
            ], function(err) {
                if (err) {
                    return setImmediate(next, err);
                }
                shelljs.cp('-Rf', source, destination);
                setImmediate(next);
            });
        }
    }

    function excludeIpkFileFromApp(next) {
        log.verbose("excludeIpkFileFromApp");
        // Exclude a pre-built .ipk file
        this.excludeFiles = this.excludeFiles.concat([
            // eslint-disable-next-line no-useless-escape
            "[.]*[\.]ipk",
            ".DS_Store"
        ]);
        setImmediate(next);
    }

    function _retrieve(list, regExp, dirPath, next) {
        async.waterfall([
            fs.readdir.bind(null, dirPath), function(fileNames, next) {
                async.forEach(fileNames, function(fileName, next) {
                    const filePath = path.join(dirPath, fileName);
                    async.waterfall([
                        fs.lstat.bind(null, filePath), function(stat, next) {
                            let result = false;
                            if (regExp.test(fileName)) {
                                result = true;
                                list.push(filePath);
                            }

                            if (!result && stat.isDirectory()) {
                                _retrieve(list, regExp, filePath, next);
                            } else {
                                setImmediate(next);
                            }
                        }
                    ], next);
                }, next);
            }
        ], function(err) {
            setImmediate(next, err);
        });
    }

    function excludeFromApp(next) {
        log.verbose("excludeFromApp");
        let excludes;
        if (this.appCount === 0) {
            excludes = this.excludeFiles;
        } else {
            excludes = this.excludeFiles.concat(this.appinfo.exclude || []);
        }

        const regExpQueries = excludes.map(function(exclude) {
            return exclude.replace(/^\./g,"^\\.").replace(/^\*/g,"").replace(/$/g,"$");
        }, this),
            strRegExp = regExpQueries.join("|"),
            regExp = new RegExp(strRegExp, "i"),
            excludeList = [];

        async.series([
            _retrieve.bind(this, excludeList, regExp, this.tempDir), function(next) {
                try {
                    excludeList.forEach(function(file) {
                        shelljs.rm('-rf', file);
                    });
                    setImmediate(next);
                } catch(err) {
                    setImmediate(next, err);
                }
            }
        ], function(err) {
            if (err) {
                return setImmediate(next, err);
            }
            setImmediate(next);
        });
    }

    function createPackageDir(next) {
        log.verbose("createPackageDir");
        if (!this.rom) {
            const pkgDirName = this.pkgId || this.appinfo.id;
            this.packageDir = path.join(this.tempDir, "data/usr/palm/packages", pkgDirName);
            mkdirp(this.packageDir, next);
        } else {
            setImmediate(next);
        }
    }

    function fillPackageDir(next) {
        log.verbose("fillPackageDir");
        if (!this.rom) {
            _checkPkgInfo(this.pkgId, this.pkgVersion, next);

            if (!this.pkgDir) {
                let data="";
                if (this.pkginfo) {
                    if (!Object.prototype.hasOwnProperty.call(this.pkginfo, 'version')) {
                        this.pkginfo.version = this.pkgVersion;
                    }
                    data = JSON.stringify(this.pkginfo, null, 2) + "\n";
                } else {
                // Generate packageinfo.json
                const pkginfo = {
                        "id": this.pkgId || this.appinfo.id,
                        "version": this.pkgVersion
                    };

                    if (this.appinfo) {
                        pkginfo.app = this.appinfo.id;
                    }
                    data = JSON.stringify(pkginfo, null, 2) + "\n";
                }
                log.verbose("Generating package.json: " + data);
                fs.writeFile(path.join(this.packageDir, "packageinfo.json"), data, next);
            } else {
                // copy packageinfo.json from package Directory
                shelljs.cp('-Rf', path.join(this.pkgDir, "packageinfo.json"), this.packageDir);
                setImmediate(next);
            }
        } else {
            setImmediate(next);
        }

        function _checkPkgInfo(id, version, next){
            if (!(/^[a-z0-9.+-]*$/.test(id))) {
                log.error(errHndl.changeErrMsg("INVALID_VALUE", "pkg id", id));
                return setImmediate(next, errHndl.changeErrMsg("INVALID_ID_RULE"));
            }

            if (!(/^([1-9]\d{0,8}|\d)\.([1-9]\d{0,8}|\d)\.([1-9]\d{0,8}|\d)$/.test(version))) {
                log.error(errHndl.changeErrMsg("INVALID_VALUE", "pkg version", version));
                return setImmediate(next, errHndl.changeErrMsg("INVALID_VERSION_RULE"));
            }
        }
    }


    function loadPackageProperties (inDirs, next) {
        log.verbose("loadPackageProperties");
        const self = this;
        self.packageProperties = {};

        async.forEach(inDirs, function(inDir, next) {
            const filename = path.join(inDir, "package.properties");

            function _checkFileMode(file) {
                file = file.replace(/\\/g, "/").trim();
                const idx = file.lastIndexOf("/");
                file = (idx !== -1) ? file.substr(idx + 1) : file;
                self.packageProperties[file] = this.fileMode;
            }

            if (fs.existsSync(filename)) {
                const data = fs.readFileSync(filename);
                try {
                    const lines = data.toString().split("\n");
                    let seperatorIndex;

                    for (const i in lines) {
                        if (lines[i].indexOf("filemode.") === 0) {
                            seperatorIndex = lines[i].indexOf("=");
                            const fileList = lines[i].substr(seperatorIndex + 1).trim(),
                                fileArray = fileList.split(",");
                            this.fileMode = lines[i].slice(9, seperatorIndex).trim();

                            fileArray.forEach(_checkFileMode);
                        }
                    }
                    setImmediate(next);
                } catch (error) {
                    setImmediate(next, error);
                }
            } else {
                setImmediate(next);
            }
        }, function(err) {
            // Exclude package.propeties from ipk file
            self.excludeFiles = self.excludeFiles.concat([
                "package.properties"
            ]);
            setImmediate(next, err);
        });
    }

    function outputPackage(destination, next) {
        log.verbose("outputPackage");

        if (this.rom) {
            copySrcToDst.call(this, path.join(this.tempDir, 'data'), destination, next);
        } else {
            const tempDir = this.tempDir,
                tempCtrlDir = path.join(tempDir, 'ctrl'),
                ctrlTgzFile = path.join(tempDir, 'control.tar.gz'),
                tempDataDir = path.join(tempDir, 'data'),
                dataTgzFile = path.join(tempDir, 'data.tar.gz');

                async.series([
                    decidePkgName.bind(this, this.pkgId, this.pkgVersion),
                    getFileSize.bind(this, tempDataDir),
                    makeTgz.bind(this, tempDataDir, dataTgzFile),
                    createDir.bind(this, tempCtrlDir),
                    createControlFile.bind(this, tempCtrlDir, false),
                    createSign.bind(this, tempCtrlDir, dataTgzFile),
                    makeTgz.bind(this, tempCtrlDir, ctrlTgzFile),
                    createDebianBinary.bind(this, tempDir),
                    setIpkFileName.bind(this),
                    removeExistingIpk.bind(this, destination),
                    makeIpk.bind(this, tempDir)
                ], function(err) {
                    if (err) {
                        setImmediate(next, err);
                        return;
                    }
                    setImmediate(next);
                });
        }
    }

    function decidePkgName(pkgName, pkgVersion, next) {
        log.verbose("decidePkgName");
        if (this.appCount !== 0) {
            this.pkg = {
                name : pkgName || this.appinfo.id,
                version : pkgVersion || this.appinfo.version
            };
        } else if (this.services.length > 0) {
            this.pkg = {
                name : pkgName || this.services[0].serviceInfo.id || this.services[0].serviceInfo.services[0].name,
                version : pkgVersion || "1.0.0"
            };
        } else {
            this.pkg = {
                name : pkgName || "unknown",
                version : pkgVersion || "1.0.0"
            };
        }
        setImmediate(next);
    }

    function getFileSize(srcDir, next) {
        log.verbose("getFileSize");
        const self = this;

        async.waterfall([
            _readSizeRecursive.bind(this, srcDir)
        ], function(err, size) {
            if (!err && size) {
                log.verbose("getFileSize#Installed-Size:", size);
                self.size = size;
            }
            setImmediate(next, err);
        });

        function _readSizeRecursive(item, next) {
            fs.lstat(item, function(err, stats) {
                let total = stats.size;

                if (!err && stats.isDirectory()) {
                    fs.readdir(item, function(error, list) {
                        if (error) {
                            return next(error);
                        }

                        async.forEach(list, function(diritem, callback) {
                                _readSizeRecursive(path.join(item, diritem), function(_err, size) {
                                    total += size;
                                    callback(_err);
                                });
                            }, function(e) {
                                next(e, total);
                            }
                        );
                    });
                } else {
                    next(err, total);
                }
            });
        }
    }

    function createDir(dstPath, next) {
        log.verbose("createDir = " + dstPath);
        mkdirp(dstPath, next);
    }

    function createControlFile(dstDir, encInfo, next) {
        const dstFilePath = path.join(dstDir, 'control');
        log.verbose("createControlFile : " + dstFilePath);

        const lines = [
            "Package: " + this.pkg.name,
            "Version: " + this.pkg.version,
            "Section: misc",
            "Priority: optional",
            "Architecture: " + (this.architecture || "all"),
            "Installed-Size: " + (this.size || 1234),          // TODO: TBC
            "Maintainer: N/A <nobody@example.com>",          // TODO: TBC
            "Description: This is a webOS application.",
            "webOS-Package-Format-Version: 2",               // TODO: TBC
            "webOS-Packager-Version: x.y.x"                  // TODO: TBC
        ];

        if (encInfo) {
            lines.push("Encrypt-Algorithm: AES-256-CBC");
        }
        lines.push(''); // for the trailing \n
        fs.writeFile(dstFilePath, lines.join("\n"), next);
    }

    function createSign(dstDir, dataTgzPath, next) {
        log.verbose("createSign");

        if ((!this.sign) || (!this.certificate)) {
            log.verbose("App signing skipped");
            return setImmediate(next);
        }

        const sigFilePath = path.join(dstDir, 'data.tar.gz.sha256.txt'),
            keyPath = path.resolve(this.sign),
            crtPath = path.resolve(this.certificate);
        log.verbose("dataTgzPath : " + dataTgzPath + ", sigfile : " + sigFilePath);
        log.verbose("keyPath : " + keyPath + ", crtPath : " + crtPath);

        try {
            // Create certificate to tmp/ctrl directory
            shelljs.cp('-f', crtPath, dstDir);

            // Create signature and write data.tar.gz.sha256.txt
            const privateKey = fs.readFileSync(keyPath, 'utf-8'),
                dataFile = fs.readFileSync(dataTgzPath), // data.tar.gz
                signer = crypto.createSign('sha256');

            signer.update(dataFile);
            signer.end();

            const signature = signer.sign(privateKey),
                buff = Buffer.from(signature),
                base64data = buff.toString('base64');

            fs.writeFile(sigFilePath, base64data, next);
        } catch (err) {
            setImmediate(next, err);
        }
    }

    function createDebianBinary(dstDir, next) {
        const dstFilePath = path.join(dstDir, "debian-binary");
        log.verbose("createDebianBinary : " + dstFilePath);
        fs.writeFile(dstFilePath, "2.0\n", next);
    }

    function makeTgz(srcDir, dstDir, next) {
        log.verbose("makeTgz " + dstDir + " from " + srcDir);
        const pkgServiceNames = this.pkgServiceNames;
        // @see https://github.com/isaacs/node-tar/issues/7
        // it is a workaround for packaged ipk on windows can set +x into directory
        const fixupDirs = function(entry) {
            // Make sure readable directories have execute permission
            if (entry.props.type === "Directory") {
                let maskingBits = 201; // 0311
                // special case for service directory should have writable permission.
                if (pkgServiceNames.indexOf(entry.props.basename) !== -1) {
                    maskingBits = 219; // 0333
                }
                entry.props.mode |= (entry.props.mode >>> 2) & maskingBits;
            } else if (entry.props.type === "File") {
                // Add other user's readable permission to all files
                entry.props.mode |= 4; // 04
            }
            return true;
        };

        // TODO: when this PR (https://github.com/npm/node-tar/pull/73) is merged, need to update node-tar
        fstream
            .Reader( {path: srcDir, type: 'Directory', filter: fixupDirs } )
            .pipe(tarFilterPack({ noProprietary: true, fromBase: true, permission : this.packageProperties }))
            // .pipe(tarFilterPack({ noProprietary: true, pathFilter: filter, permission : this.packageProperties }))
            .pipe(zlib.createGzip())
            .pipe(fstream.Writer(dstDir))
            .on("close", next)
            .on('error', next);
    }

    function setIpkFileName(next) {
        let filename = this.pkg.name;
        if (this.pkg.version) {
            // This is asked to replace 'x86' from 'i586' as a file suffix (From NDK)
            const archSuffix = ('i586' === this.architecture)? 'x86' : (this.architecture || 'all');
            filename = filename.concat("_" + this.pkg.version + "_" + archSuffix + ".ipk");
        } else {
            filename = filename.concat(".ipk");
        }
        this.ipkFileName = filename;
        setImmediate(next);
    }

    function removeExistingIpk(destination, next) {
        log.verbose("removeExistingIpk");
        if (this.appCount === 0) {
            return setImmediate(next);
        }

        const filename = path.join(destination, this.ipkFileName);
        fs.exists(filename, function (exists) {
            if (exists) {
                fs.unlink(filename, next);
            } else {
                setImmediate(next);         // Nothing to do
            }
        });
    }

    function padSpace(input,length) {
        // max field length in ar is 16
        const ret = String(input + '                                     ' );
        return ret.slice(0,length);
    }

    function arFileHeader(name, size ) {
        const epoch = Math.floor(Date.now() / 1000) ;
        return padSpace(name, 16) +
                padSpace(epoch, 12) +
                "0     " + // UID, 6 bytes
                "0     " + // GID, 6 bytes
                "100644  " + // file mode, 8 bytes
                padSpace(size, 10) +
                "\x60\x0A";   // don't ask
    }

    function makeIpk(srcDir, next) {
        this.IpkDir = srcDir;
        this.ipk = path.join(srcDir, this.ipkFileName);
        log.verbose("makeIpk in dir " + this.IpkDir + " file " + this.ipkFileName );

        if (this.nativecmd) {           // TODO: TBR
            shelljs.cd(this.IpkDir);
            shelljs.exec("ar -q " + this.ipk + " debian-binary control.tar.gz data.tar.gz", {silent: this.silent});

            setImmediate(next);
            return;
        }

        // global header, see http://en.wikipedia.org/wiki/Ar_%28Unix%29
        const header = "!<arch>\n",
            debBinary = arFileHeader("debian-binary",4) + "2.0\n",
            that = this,
            arStream = CombinedStream.create(),
            pkgFiles = [ 'control.tar.gz', 'data.tar.gz' ],
            ipkStream  = fstream.Writer(this.ipk);

        arStream.append(header + debBinary);
        pkgFiles.forEach(function (f) {
            const fpath = path.join(that.IpkDir,f),
                s = fstream.Reader({ path: fpath, type: 'File'}),
                stat = fs.statSync(fpath); // TODO: move to asynchronous processing

            arStream.append(arFileHeader(f, stat.size));
            arStream.append(s);
            if ((stat.size % 2) !== 0) {
                log.verbose('Adding a filler for file ' + f);
                arStream.append('\n');
            }
        }, this);

        arStream.pipe(ipkStream);
        ipkStream.on('close', function() {
            setImmediate(next);
        });
        ipkStream.on('error', next);
    }

    function cleanupTmpDir(next) {
        log.verbose("cleanupTmpDir");
        if (this.noclean) {
            console.log("Skipping removal of  " + this.tempDir);
            setImmediate(next);
        } else {
            rimraf(this.tempDir, function(err) {
                log.verbose("cleanup(): removed " + this.tempDir);
                setImmediate(next, err);
            }.bind(this));
        }
    }

    function checkDirectory(options, directory, callback) {
        log.verbose("checkDirectory: " + directory);
        if (fs.existsSync(directory)) { // TODO: move to asynchronous processing
            const stat = fs.statSync(directory);
            if (!stat.isDirectory()) {
                callback("ERROR: '" + directory + "' is not a directory");
                return;
            }
            directory = fs.realpathSync(directory);
        } else {
            callback("ERROR: directory '" + directory + "' does not exist");
            return;
        }

        if (options.force) {
            return callback();
        }

        if (fs.existsSync(path.join(directory, "appinfo.json"))) {// TODO: move to asynchronous processing
            this.appCount++;
            log.verbose("FOUND appinfo.json, appCount " + this.appCount);

            if (this.appCount > 1) {
                callback("ERROR: only one application is supported");
            } else {
                this.appDir = directory;
                this.originAppDir = directory;
                if (fs.existsSync(path.join(directory, "package.js"))) {
                    this.pkgJSExist = true;
                }
                callback();
            }
        } else if (fs.existsSync(path.join(directory, "packageinfo.json"))) {
            this.pkgDir = directory;
            callback();
        } else if (fs.existsSync(path.join(directory, "services.json"))) {
            this.svcDir = this.svcDir || [];
            this.svcDir = this.svcDir.concat(directory);
            callback();
        } else if (fs.existsSync(path.join(directory, "account-templates.json"))) {
            callback("ERROR: account directory support is not yet implemented");
        } else {
            // find service directory recursively
            const foundSvcDirs = [];
            this.svcDir = this.svcDir || [];
            this.svcDir = this.svcDir.concat(directory);

            findServiceDir.call(this, foundSvcDirs, function() {
                if (foundSvcDirs.length > 0) {
                    callback();
                } else {
                    callback("ERROR: '" + directory + "' has no meta files such as appinfo.json");
                }
            });
        }
    }

    //* find service directories checking if directory has services.json file
    function findServiceDir(services, next) {
        log.verbose("findServiceDir");
        const checkDirs = [].concat(this.svcDir || this.originAppDir || []),
            foundFilePath = [];
        if (checkDirs.length === 0) {
            return setImmediate(next);
        }

        async.forEach(checkDirs, function(checkDir, next) {
            walkFolder(checkDir, "services.json", foundFilePath, 3, function(err) {
                if (err) {
                    return setImmediate(next, err);
                }

                foundFilePath.forEach(function(filePath) {
                    const svc = new Service();
                    svc.srcDir = path.dirname(filePath);
                    svc.dirName = path.basename(svc.srcDir);
                    services.push(svc);
                });
                foundFilePath.pop();
                setImmediate(next, err);
            });
        }, function(err) {
            setImmediate(next, err);
        });
    }

    function walkFolder(dirPath, findFileName, foundFilePath, depth, next) {
        if (depth <= 0) {
            return next();
        }
        async.waterfall([
            fs.readdir.bind(null, dirPath),
            function(fileNames, next) {
                async.forEach(fileNames, function(fileName, next) {
                    const filePath = path.join(dirPath, fileName);
                    async.waterfall([
                        fs.lstat.bind(null, filePath),
                        function(stat, next) {
                            if (stat.isFile()) {
                                if (fileName === findFileName) {
                                    foundFilePath.push(filePath);
                                }
                                next();
                            } else if (stat.isDirectory()) {
                                walkFolder(filePath, findFileName, foundFilePath, (depth-1), next);
                            } else {
                                next();
                            }
                        }
                    ], next); // async.waterfall
                }, next); // async.forEach
            }
        ], function(err) {
            next(err);
        }); // async.waterfall
    }

    //* read services.json recursivly
    function loadServiceInfo(next) {
        log.verbose("loadServiceInfo");
        for (const idx in this.services) {
            const filename = path.join(this.services[idx].srcDir, "services.json");
            try {
                const data = fs.readFileSync(filename),
                    info = JSON.parse(data);
                if (!(Object.prototype.hasOwnProperty.call(info, 'id') &&
                    Object.prototype.hasOwnProperty.call(info, 'services'))) {
                    continue;
                }
                this.services[idx].serviceInfo = info;
                this.services[idx].valid = true;
            } catch (err) {
                return setImmediate(next, err);
            }
        }
        log.verbose("num of serviceInfo: " + this.services.length);
        setImmediate(next);
    }

    //* check services.json recursivly
    function checkServiceInfo(next) {
        log.verbose("checkServiceInfo");
        const pkgId = this.pkgId || this.appinfo.id,
            svcIds = [];
        let errMsg = "service ids ",
            errFlag = false;

        this.services.forEach(function(service) {
            if (service.valid === false) {
                return;
            }

            svcIds.push(getPkgServiceNames(service.serviceInfo)[0]);
        });

        svcIds.forEach(function(svcId) {
            if (svcId.indexOf(pkgId + ".") !== 0  ) {
                errFlag = true;
            }
            errMsg += "\n" + svcId;
        });

        if (errFlag) {
            errMsg += "\n" + "must start with package id \"" + pkgId + "\"";
            return setImmediate(next, new Error(errMsg));
        }
        setImmediate(next);
    }

    //* create dir with each service's name under (tmp) + data/usr/palm/services/
    function createServiceDir(next) {
        log.verbose("createServiceDir");
        this.services.forEach(function(service) {
            if (service.valid === false) {
                return;
            }

            getPkgServiceNames(service.serviceInfo).forEach(function(serviceName) {
                const serviceDir = path.join(this.tempDir, "data/usr/palm/services", serviceName);
                service.dstDirs.push(serviceDir);
                try {
                    mkdirp.sync(serviceDir);
                } catch (err) {
                    return setImmediate(next, err);
                }
            }.bind(this));
        }.bind(this));
        setImmediate(next);
    }

    //* copy service files into each serviceInfos[x].id directory.
    function copyService(next) {
        log.verbose("copyService");
        const self = this,
            validServices = this.services.filter(function(service) {
                return service.valid;
            });
        try {
            async.forEachSeries(validServices, function(service, next) {
                async.forEach(service.dstDirs, function(dstDir, next) {
                    self.dataCopyCount++;
                    // self.minifyDone = !self.minify; //FIXME: to minify js_service, uncomment this.
                    copySrcToDst.call(self, service.srcDir, dstDir, next);
                }, next);
            }, next);
        } catch (err) {
            setImmediate(next, err);
        }
    }

    //* add service info into packageinfo.json.
    function addServiceInPkgInfo(next) {
        log.verbose("addServiceInPkgInfo");
        if (!this.rom) {
            const filename = path.join(this.packageDir, "packageinfo.json");
            let pkginfo, validServiceCount;
            try {
                const data = fs.readFileSync(filename);
                validServiceCount = 0;
                log.verbose("PACKAGEINFO >>" + data + "<<");
                pkginfo = JSON.parse(data);
            } catch (err) {
                console.error(err);
                setImmediate(next, err);
            }
            this.services.filter(function(s) {
                return s.valid;
            }).forEach(function(service) {
                getPkgServiceNames(service.serviceInfo).forEach(function(serviceName) {
                    this.pkgServiceNames.push(serviceName);
                    validServiceCount++;
                }.bind(this));
            }.bind(this));

            if (validServiceCount > 0) {
                pkginfo.services = this.pkgServiceNames;
                const data = JSON.stringify(pkginfo, null, 2) + "\n";
                log.verbose("Modified package.json: " + data);
                fs.writeFile(path.join(this.packageDir, "packageinfo.json"), data, next);
            } else {
                setImmediate(next);
            }
        } else {
            setImmediate(next);
        }
    }

    //* remove service dir from tmp source dir before packaging
    function removeServiceFromAppDir(next) {
        log.verbose("removeServiceFromAppDir");
        if (this.appCount === 0) {
            return setImmediate(next);
        }

        let checkDir = this.applicationDir,
            needRmCheckDir = false;
        const fileList = fs.readdirSync(checkDir);

        function _checkDir(dir) {
            if (this.dirName === dir) {
                try {
                    const rmDir = path.join(this.applicationDir, this.dirName);
                    shelljs.rm('-rf', rmDir);
                } catch (err) {
                    console.log("ERROR:" + err);
                }
            }
        }

        if (fileList.indexOf('services') !== -1) {
            checkDir = path.join(this.applicationDir, 'services');
            const stats = fs.statSync(checkDir);
            if (stats.isDirectory()) {
                needRmCheckDir = true;
            }
        }
        if (needRmCheckDir === true) {
            try {
                shelljs.rm('-rf', checkDir);
            } catch (err) {
                console.log("ERROR:" + err);
            }
        } else {
            for (const idx in this.services) {
                this.dirName = this.services[idx].dirName;
                fileList.forEach(_checkDir, this);
            }
        }
        setImmediate(next);
    }

    function copyData(inDirs, forceCopy, next) {
        log.verbose("copyData ** Only run when force packaging");
        if (forceCopy && this.dataCopyCount === 0) {
            const dst = path.join(this.tempDir, "data");
            async.forEachSeries(inDirs, function(src, next) {
                copySrcToDst.call(this, src, dst, next);
            }, function(err) {
                setImmediate(next, err);
            });
        } else {
            return setImmediate(next);
        }
    }

    function getPkgServiceNames(serviceInfo) {
        log.verbose("getPkgServiceNames");
        let serviceNames = [];
        if (servicePkgMethod === "id") {
            serviceNames = [serviceInfo.id];
        } else if (serviceInfo.services) {
                const serviceProps = (serviceInfo.services instanceof Array) ?
                                        serviceInfo.services : [serviceInfo.services];
                serviceNames = serviceProps.map(function(serviceProp) {
                    return serviceProp.name;
                });
        }
        return serviceNames;
    }

    function setUmask(mask, next) {
        this.oldmask = process.umask(mask);
        setImmediate(next);
    }

    function recoverUmask(next) {
        if (this.oldmask) {
            process.umask(this.oldmask);
        }
        setImmediate(next);
    }

    function rewriteFileWoBOMAsUtf8(filePath, rewriteFlag, next) {
        let data = fs.readFileSync(filePath);
        const encodingFormat = chardet.detect(Buffer.from(data));

        if (['UTF-8', 'ISO-8895-1'].indexOf(encodingFormat) === -1) {
            log.verbose("Current Encoding Type>> " + encodingFormat + "<<");
            data = encoding.convert(data, "UTF-8", encodingFormat);
        }
        data = stripbom(data);

        if (rewriteFlag) {
            fs.writeFileSync(filePath,
                data, { encoding: "utf8" }
            );
        }

        if (next !== 'undefined' && typeof next === 'function') {
            setImmediate(next, null, data);
        }
        return data;
    }

    function encryptPackage(next) {
        if (this.rom || !this.encrypt) { // Do not encrypt when -rom option is given
            setImmediate(next);
            return;
        } else {
            log.verbose("encryptPackage");
            this.encryptDir = path.join(this.tempDir, "encrypt");
            const encryptDir = this.encryptDir,
                encryptCtrlDir = path.join(encryptDir, 'ctrl'),
                ctrlTgzFile = path.join(encryptDir, 'control.tar.gz'),
                encryptDataDir = path.join(encryptDir, 'data'),
                dataTgzFile = path.join(encryptDir, 'data.tar.gz');

            async.series([
                createDir.bind(this, encryptDir),
                createDir.bind(this, encryptCtrlDir),
                createDir.bind(this, encryptDataDir),
                createkeyIVfile.bind(this, encryptCtrlDir),
                encryptIpk.bind(this, encryptDataDir),
                makeTgz.bind(this, encryptDataDir, dataTgzFile),
                createControlFile.bind(this, encryptCtrlDir, true),
                makeTgz.bind(this, encryptCtrlDir, ctrlTgzFile),
                createDebianBinary.bind(this, encryptDir),
                makeIpk.bind(this, encryptDir)
            ], function(err) {
                if (err) {
                    setImmediate(next, err);
                    return;
                }
                log.verbose("Success to encrypt pacakge");
                setImmediate(next);
            });
        }
    }

    function createkeyIVfile(dstPath, next) {
        log.verbose("generate symmmtic key & createkeyIVfile");
        // generate random key& IV
        this.key = Buffer.from(crypto.randomBytes(32), 'base64');
        this.iv = Buffer.from(crypto.randomBytes(16), 'base64');

        try {
            // Read public key
            const publickeyPath = path.join(__dirname, '../', 'files', 'conf', 'pubkey.pem'),
                publickey = fs.readFileSync(publickeyPath, 'utf8');

            // Encrypt key, iv by publickey
            const encryptedKey= crypto.publicEncrypt({
                key : publickey,
                padding: 4 /* crypto.constants.RSA_PKCS1_OAEP_PADDING */
            }, Buffer.from(this.key.toString('base64')));

            const encryptedIV= crypto.publicEncrypt({
                key : publickey,
                padding: 4 /* crypto.constants.RSA_PKCS1_OAEP_PADDING */
            }, Buffer.from(this.iv.toString('base64')));

            const keyFilePath = path.join(dstPath, "key");
            fs.writeFileSync(keyFilePath, encryptedKey, 'binary');

            // write iv file on encrypt/control
            const ivFilePath = path.join(dstPath , "iv");
            fs.writeFileSync(ivFilePath, encryptedIV, 'binary');

        } catch (err) {
            setImmediate(next, err);
        }
        setImmediate(next);
    }

    function copyOutputToDst(destination, next) {
        // copy data directory to destination
        if (this.rom) {
            console.log("Create output directory to " + destination);
            copySrcToDst.call(this, path.join(this.tempDir, 'data'), destination, next);
        } else if (this.encrypt) {
            // copy encrypted ipk to destination
            console.log("Create encrypted " + this.ipkFileName + " to " + destination);
            copySrcToDst.call(this, path.join(this.encryptDir, this.ipkFileName), destination, next);
        } else {
            // copy plain ipk to destination
            let outmsg = "Create ";
            if (this.sign && this.certificate) {
                outmsg = outmsg.concat("signed ");
            }
            console.log(outmsg + this.ipkFileName + " to " + destination);
            copySrcToDst.call(this, path.join(this.tempDir, this.ipkFileName), destination, next);
        }
    }

    function encryptIpk(dstPath, next) {
        log.verbose("encrypt plain ipk to /encrypt/data");
        const plainIpkPath = path.join(this.tempDir, this.ipkFileName),
            encrypedIpkPath = path.join(dstPath, this.ipkFileName);

        try {
            const input = fs.createReadStream(plainIpkPath),
                output = fs.createWriteStream(encrypedIpkPath),
                cipher = crypto.createCipheriv('aes-256-cbc', this.key, this.iv);

            output.on('close', function() {
                log.verbose('encrypted Ipk to ' + encrypedIpkPath);
                setImmediate(next);
            }).
            on('error', function(err) {
                setImmediate(next, err);
            });

            input.pipe(cipher).pipe(output);
        } catch (err) {
            setImmediate(next, err);
        }
    }
}());
