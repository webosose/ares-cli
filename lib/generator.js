#!/usr/bin/env node

/*
 * Copyright (c) 2020 LG Electronics Inc.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

const path = require('path'),
    promise = require('bluebird'),
    log = require('npmlog'),
    Table = require('easy-table'),
    errHndl = require('./base/error-handler'),
    fs = promise.promisifyAll(require('fs-extra')),
    readJsonSync = require('./util/json').readJsonSync,
    copyToDirAsync = require('./util/copy').copyToDirAsync,
    merge = require('./util/merge');

function Generator(tmplFile) {
    let templates;

    function _setTemplates(_tmplFile) {
        if (tmplFile) {
            const cliPath = path.join(__dirname, '..');
            let contents = fs.readFileSync(_tmplFile);
            contents = contents.toString().replace(/\$cli-root/gi, cliPath).replace(/\\/g,'/');
            templates = JSON.parse(contents);
        } else {
            templates = null;
        }
    }
    _setTemplates(tmplFile);
    this.setTmplates = _setTemplates;
    this.getTemplates = function() {
        return templates;
    };
}

Generator.prototype.showTemplates = function(listType) {
    const templates = this.getTemplates(),
        table = new Table(),
        _displayType = {
            "webapp": "Web App",
            "nativeapp": "Native App",
            "webappinfo": "Web App Info",
            "nativeappinfo": "Native App Info",
            "jsservice": "JS Service",
            "nativeservice": "Native Service",
            "jsserviceinfo": "JS Service Info",
            "nativeserviceinfo": "Native Service Info",
            "icon": "Icon",
            "library": "Library",
            "packageinfo": "Package Info",
            "qmlapp": "QML App",
            "qmlappinfo": "QML App Info"
        };

    for (const name in templates) {
        if (templates[name].hide === true || !templates[name].type) {
            continue;
        }
        const isDefault = (templates[name].default) ? "(default) " : "",
            branch = templates[name].branch || '-',
            type = _displayType[templates[name].type] || templates[name].type;

        if (listType && ["true", "false", true, false].indexOf(listType) === -1) {
            if (templates[name].type &&
                (templates[name].type.match(new RegExp(listType+"$","gi")) === null)) {
                continue;
            }
        }
        table.cell('ID', name);
        table.cell('Project Type', type);
        table.cell('Version', branch);
        table.cell('Description', isDefault + templates[name].description);
        table.newRow();
    }
    console.log(table.print());
    return;
};

Generator.prototype.existOutDir = function(outDir) {
    log.verbose("Generator.existOutDir()", outDir);
    try {
        const files = fs.readdirSync(outDir);
        if (files.length > 0)
            return true;
    } catch (err) {
        if (err && err.code === 'ENOTDIR') {
            throw errHndl.getErrMsg("NOT_DIRTYPE_PATH", outDir);
        }
        if (err && err.code === 'ENOENT') {
            log.verbose("Generator.generate()", "The directory does not exist.");
            return false;
        }
        throw err;
    }
};

Generator.prototype.generate = function(options) {
    const tmplName = options.tmplName,
        pkginfo = options.pkginfo,
        svcinfo = options.svcinfo,
        svcName = options.svcName,
        out = options.out,
        templates = this.getTemplates(),
        dest = path.resolve(out),
        template = templates[tmplName];
    let appinfo = options.appinfo;

    if (!template) {
        return promise.reject(errHndl.getErrMsg("INVALID_TEMPLATE"));
    }

    if (template.metadata && template.metadata.data && typeof template.metadata.data === 'object') {
        appinfo = merge(appinfo, template.metadata.data);
    }

    if (svcName) {
        svcinfo.id = svcName;
        svcinfo.services = [{
            "name": svcName
        }];
    } else if (!svcName && !!svcinfo.id) {
        svcinfo.services = [{
            "name": svcinfo.id
        }];
    }

    return promise.resolve()
        .then(function() {
            log.verbose("Generator.generate()", "template name:" + tmplName);
            console.log("Generating " + tmplName + " in " + dest);

            let srcs;
            if (tmplName.match(/(^hosted)/)) {
                srcs = [].concat(template.path);
                return promise.all(srcs.map(function(src) {
                    return copyToDirAsync(src, dest);
                })).then(function() {
                    let metaTmpl;
                    let url;
                    if (template.metadata && template.metadata.id) {
                        metaTmpl = templates[template.metadata.id];
                    }
                    if (metaTmpl) {
                        if (appinfo.url) {
                            url = appinfo.url;
                            delete appinfo.url;
                            const urlTmpl = {"path":path.join(srcs[0],'index.html')};
                            _writeURLdata(urlTmpl, url);
                        }
                        return _writeMetadata(metaTmpl, appinfo, svcinfo, pkginfo);
                    } else {
                        return;
                    }
                });
            } else if (tmplName.match(/(^qmlapp$)/)) {
                srcs = [].concat(template.path);
                return promise.all(srcs.map(function(src) {
                    return copyToDirAsync(src, dest);
                })).then(function() {
                    let metaTmpl;
                    if (template.metadata && template.metadata.id) {
                        metaTmpl = templates[template.metadata.id];
                    }
                    if (metaTmpl) {
                        if (appinfo.id) {
                            const qmlTmpl = {"path":path.join(srcs[0],'main.qml')};
                            _writeAppIDdata(qmlTmpl, appinfo.id);
                        }
                        return _writeMetadata(metaTmpl, appinfo, svcinfo, pkginfo);
                    } else {
                        return;
                    }
                });
            } else if (template.type.match(/info$/)) {
                return _writeMetadata(template, appinfo, svcinfo, pkginfo);
            } else {
                srcs = [].concat(template.path);
                return promise.all(srcs.map(function(src) {
                    log.verbose("Generator.generate()", "template src:" + src);
                    return copyToDirAsync(src, dest);
                })).then(function() {
                    let metaTmpl;
                    if (template.metadata && template.metadata.id) {
                        metaTmpl = templates[template.metadata.id];
                    }
                    if (metaTmpl) {
                        return _writeMetadata(metaTmpl, appinfo, svcinfo, pkginfo);
                    } else {
                        return;
                    }
                });
            }
        })
        .then(function() {
            const deps = templates[tmplName].deps || [];
            return promise.all(deps.map(function(dep) {
                if (!templates[dep]) {
                    log.warn("Generator.generate()", "Invalid template id " + dep);
                    return;
                } else if (!templates[dep].path) {
                    log.warn("Generator.generate()", "Invalid template path " + dep);
                    return;
                }
                return copyToDirAsync(templates[dep].path, dest);
            }));
        })
        .then(function() {
            log.verbose("Generator.generate() done.");
            return {
                msg: "Success"
            };
        })
        .catch(function(err) {
            log.verbose("Generator.generate()#err:", err);
            throw err;
        });

    function _writeAppIDdata(qmlTmpl, appId) {
        const filePaths = [].concat(qmlTmpl.path);
        return promise.all(filePaths.map(function(file) {
            return fs.lstatAsync(file)
                .then(function(stats) {
                    if (!stats.isFile()) {
                        throw errHndl.getErrMsg("INVALID_PATH", "meta template", file);
                    }
                    // eslint-disable-next-line no-useless-escape
                    const exp = /appId\s*:\s*[\'\"][\w.]*[\'\"]/g;
                    const destFile = path.join(dest, path.basename(file));
                    let qmlFile = fs.readFileSync(file, 'utf8');
                    qmlFile = qmlFile.replace(exp, "appId: \"" + appId + "\"");

                    fs.writeFileSync(destFile, qmlFile, {encoding: 'utf8'});
                });
        }))
        .then( function() {
            log.verbose("Geneator.generate()._writeAppIDdata done.");
            return;
        })
        .catch( function(err) {
            log.verbose("Geneator.generate()._writeAppIDdata#err:", err);
            throw err;
        });
    }

    function _writeURLdata(urlTmpl, url) {
        const filePaths = [].concat(urlTmpl.path);
        return promise.all(filePaths.map(function(file) {
            return fs.lstatAsync(file)
                .then(function(stats) {
                    if (!stats.isFile()) {
                        throw errHndl.getErrMsg("INVALID_PATH", "meta template", file);
                    }
                    let html = fs.readFileSync(file, 'utf8');
                    // eslint-disable-next-line no-useless-escape
                    const exp = new RegExp("(?:[\'\"])([\:/.A-z?<_&\s=>0-9;-]+\')");
                    // eslint-disable-next-line no-useless-escape
                    html=html.replace(exp, "\'"+url+"\'");
                    const destFile = path.join(dest, path.basename(file));

                    fs.writeFileSync(destFile, html, {encoding: 'utf8'});
                });
        }))
        .then( function() {
            log.verbose("Geneator.generate()._writeURLdata() done.");
            return;
        })
        .catch( function(err) {
            log.verbose("Geneator.generate()._writeURLdata()#err:", err);
            throw err;
        });
    }

    function _writeMetadata(metaTmpl, _appinfo, _svcinfo, _pkginfo) {
        log.verbose("Generator.generate()._writeMetadata()");
        const metaPaths = [].concat(metaTmpl.path),
            appInfo = _appinfo || {},
            svcInfo = _svcinfo || {},
            pkgInfo = _pkginfo || {};

        return promise.all(metaPaths.map(function(file) {
            return fs.lstatAsync(file)
                .then(function(stats) {
                    if (!stats.isFile()) {
                        throw errHndl.getErrMsg("INVALID_PATH", "meta template", file);
                    }
                    const fileName = path.basename(file);
                    let info = readJsonSync(file);

                    if (fileName === 'appinfo.json') {
                        info = merge(info, appInfo);
                    } else if (fileName === "services.json") {
                        info = merge(info, svcInfo);
                    } else if (fileName === "package.json" &&
                            (metaTmpl.type === "jsserviceinfo" || metaTmpl.type === "nativeserviceinfo")) {
                        info.name = svcInfo.id || info.name;
                    } else if (fileName === "packageinfo.json") {
                        info = merge(info, pkgInfo);
                    }
                    return info;
                })
                .then(function(info) {
                    const destFile = path.join(dest, path.basename(file));
                    return fs.mkdirsAsync(dest)
                        .then(function() {
                            return fs.writeFileSync(destFile, JSON.stringify(info, null, 2), {
                                encoding: 'utf8'
                            });
                        });
                });
        }))
        .then( function() {
            log.verbose("Geneator.generate()._writeMetadata() done.");
            return;
        })
        .catch( function(err) {
            log.verbose("Geneator.generate()._writeMetadata()#err:", err);
            throw err;
        });
    }
};

module.exports = Generator;
