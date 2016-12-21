require('rootpath')();
var log = require('app/utils/logger')(module);
log.info('=>starting server');
require('./app')