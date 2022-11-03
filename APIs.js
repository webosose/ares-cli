const {promisify} = require('util'),
    aresPusher = require('./lib/pusher');

const Pusher = new aresPusher();

module.exports = {
    Pusher
};
