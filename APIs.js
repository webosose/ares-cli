const {promisify} = require('util'),
    aresInspecter = require('./lib/inspect');

const Inspecter = {
    inspect: promisify(aresInspecter.inspect),
    stop: promisify(aresInspecter.stop)
};

module.exports = {
    Inspecter
};
