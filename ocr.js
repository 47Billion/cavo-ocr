require('rootpath')();
var log = require('app/utils/logger')(module);
log.info('=>starting server');

// uncaught exception
process.on('uncaughtException', function (err) {
    log.error('uncaughtException:', err.message);
    log.error(err.stack);
});

require('./app')