/**
 * @author devendra.rathore@47billion.com
 */
'use strict';

var config = require('config'),
    winston = require('winston'),
    moment = require('moment'),
    os = require("os"),
    path = require('path'),
    PROJECT_ROOT = path.join(__dirname, '..')

winston.emitErrs = true;

var logger;

module.exports = function (_module) {

    var node = os.hostname() + '-' + process.pid + ' ';
    // Return the last folder name in the path and the calling module's filename.
    var getLabel = function (_module) {
        return 'tuktuk';
        var parts = _module.filename.split('/');
        return parts[parts.length - 2] + '/' + parts.pop();
    };

    //if (logger) {
    //    //logger.info('=>logger - reusing instance');
    //    return logger;
    //}

    var transports = [];
    if (['production', 'staging', 'qa', 'training', 'development'].indexOf(process.env.NODE_ENV) === -1) {
        transports.push(new winston.transports.Console({
            level: config.logger.level,
            handleExceptions: config.logger.handleExceptions,
            json: false,
            colorize: true,
            timestamp: function () {
                return node + moment().format('YYYYMMDD HH:mm:ss:SSS');
            }
        }));
    } else {
        transports.push(new winston.transports.File({
            level: config.logger.level,
            filename: config.logger.filename,
            handleExceptions: config.logger.handleExceptions,
            json: false,
            maxsize: 5000000, // 5MB
            //maxsize: 50000, // 50KB
            maxFiles: 4,
            colorize: false,
            timestamp: function () {
                return node + moment().format('YYYYMMDD HH:mm:ss:SSS');
            }
        }));
    }

    logger = new winston.Logger({
        transports: transports, exitOnError: false,
        exceptionHandlers: [
            new winston.transports.File({filename: config.logger.errorLogFile})
        ]
    });
// this allows winston to handle output from express' morgan middleware
    logger.stream = {
        write: function (message) {
            logger.info(message)
        }
    }

// A custom logger interface that wraps winston, making it easy to instrument
// code and still possible to replace winston in the future.
    var loggerModule = {};
    loggerModule.debug = module.exports.log = function () {
        logger.debug.apply(logger, formatLogArguments(arguments))
    }

    loggerModule.info = function () {
        logger.info.apply(logger, formatLogArguments(arguments))
    }

    loggerModule.warn = function () {
        logger.warn.apply(logger, formatLogArguments(arguments))
    }

    loggerModule.error = function () {
        logger.error.apply(logger, formatLogArguments(arguments))
    }

    loggerModule.stream = logger.stream

    return loggerModule;
}

/**
 * Attempts to add file and line number info to the given log arguments.
 */
function formatLogArguments(args) {
    args = Array.prototype.slice.call(args)

    var stackInfo = getStackInfo(1)

    if (stackInfo) {
        // get file path relative to project root
        var calleeStr = '(' + stackInfo.relativePath + ':' + stackInfo.line + ')'

        if (typeof (args[0]) === 'string') {
            args[0] = calleeStr + ' ' + args[0]
        } else {
            args.unshift(calleeStr)
        }
    }

    return args
}

/**
 * Parses and returns info about the call stack at the given index.
 */
function getStackInfo(stackIndex) {
    // get call stack, and analyze it
    // get all file, method, and line numbers
    var stacklist = (new Error()).stack.split('\n').slice(3)

    // stack trace format:
    // http://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
    // do not remove the regex expresses to outside of this method (due to a BUG in node.js)
    var stackReg = /at\s+(.*)\s+\((.*):(\d*):(\d*)\)/gi
    var stackReg2 = /at\s+()(.*):(\d*):(\d*)/gi

    var s = stacklist[stackIndex] || stacklist[0]
    var sp = stackReg.exec(s) || stackReg2.exec(s)

    if (sp && sp.length === 5) {
        return {
            method: sp[1],
            relativePath: path.relative(PROJECT_ROOT, sp[2]),
            line: sp[3],
            pos: sp[4],
            file: path.basename(sp[2]),
            stack: stacklist.join('\n')
        }
    }
}