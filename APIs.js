const {promisify} = require('util'),
    aresPuller = require('./lib/pull');

const Puller = {
    pull: promisify(aresPuller.pull)
};

module.exports = {
    Puller
};
