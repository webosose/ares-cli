const {promisify} = require('util'),
    aresShell = require('./lib/shell');

const Shell = {
    remoteRun: promisify(aresShell.remoteRun),
    shell: promisify(aresShell.shell)
};

module.exports = {
    Shell
};
