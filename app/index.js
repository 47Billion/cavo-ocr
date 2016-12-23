// BASE SETUP
// =============================================================================

// call the packages we need
var log = require('app/utils/logger')(module);
var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var morgan = require('morgan');
var tesseract = require('node-tesseract');
var fs = require('fs');
var http = require('http');
var uuid = require('uuid');
var request = require('request');

var exec = require('child_process').exec;
var config = require('config');

// configure app
app.use(morgan('dev')); // log requests to the console

// configure body parser
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

var port = config.app.port || 8090; // set our port

//Convert Command
//convert -density 300 338bae49-0f25-4fcc-8766-9c4626f21eff.pdf -depth 8 -background white -flatten +matte foo.tiff
//tesseract command
// tesseract foo.tiff dev3 pdf


//Sample curl
//curl -XPOST -d '{"callback":"https://google.com","srcFile": "http://www.sentryfile.com/forum/attachments//ImageOnly.pdf", "destFile":"out-pdf"}' -H 'content-type:application/json' localhost:8090/rest/files


// create our router
var router = express.Router();


// test route to make sure everything is working (accessed at GET http://localhost:8080/api)
router.get('/', function (req, res) {
    res.json({message: 'hooray! welcome to tessearct api!'});
});

// on routes that end in /files
// ----------------------------------------------------
router.route('/files')
    // create a bear (accessed at POST http://localhost:8080/bears)
    .post(function (req, res) {
        var input = req.body || {};
        log.info('=>input', input);

        _doOcr(input);

        res.json({message: 'Request accepted!'});
    });

app.use('/rest', router);

app.listen(port);

log.info('Server started on port ' + port);


var STATUS_FAILED = 'failed',
    STATUS_OK = 'ok';

function _doOcr(input) {
    var protocol = _determineProtocol(input.srcFile)
    var re = /(?:\.([^.]+))?$/;
    var ext = re.exec(input.srcFile)[1];

    switch (protocol) {
        case 'https':
        case 'http':
            _downloadAndOCR(input, ext);
            break;
        case 'file':
            input.srcFile = input.srcFile.replace('file://', '');
        default:
            _ocrLocalFile(input, ext);
    }
}

function _determineProtocol(srcFile) {
    if (srcFile.indexOf('https://') === 0) {
        return 'https';
    }

    if (srcFile.indexOf('http://') === 0) {
        return 'http';
    }
    if (srcFile.indexOf('file://') === 0) {
        return 'file'
    }

    return '';
}

function _downloadAndOCR(input, ext) {
    var fileName = uuid.v4() + "." + ext;
    _downloadFile(input.srcFile, fileName, function onDownloadComplete(err) {

        if (err) {
            log.error('=>onDownloadComplete', input, err);
            return notifyOnCallbackUrl(input.callback, STATUS_FAILED);
        }

        input.srcFile = fileName;

        _determineFileExtAndProceed(input, ext, function onOcrComplete(err, srcFile, intermediateTiffFile) {
            notifyOnCallbackUrl(input.callback, err ? STATUS_FAILED : STATUS_OK, function onNotifyCBUrl(err) {

                if (err) {
                    log.error('=>onNotifyCBUrl', input, err);
                }
                log.info('=>_downloadAndOCR DONE', input.destFile);

                //Delete intermediate files
                if (srcFile && fs.existsSync(srcFile)) {
                    fs.unlink(srcFile)
                }

                if (intermediateTiffFile && fs.existsSync(intermediateTiffFile)) {
                    fs.unlink(intermediateTiffFile)
                }
            });
        });
    });
}

function _ocrLocalFile(input, ext) {
    _determineFileExtAndProceed(input, ext, function onOcrComplete(err, srcFile, intermediateTiffFile) {
        notifyOnCallbackUrl(input.callback, err ? STATUS_FAILED : STATUS_OK, function onNotifyCBUrl(err) {
            //Delete intermediate files
            if (err) {
                log.error('=>onNotifyCBUrl', input, err);
            }

            log.info('=>_ocrLocalFile DONE', input.destFile);
            if (intermediateTiffFile && fs.existsSync(intermediateTiffFile)) {
                fs.unlink(intermediateTiffFile)
            }
        });
    });
}

function notifyOnCallbackUrl(url, status, cb) {

    if (!url) return cb ? cb() : null;

    url += '?status=' + status
    request(url, function (error, response, body) {
        if (error) {
            cb && cb(error)
        }
        cb && cb();
    })
}

function _downloadFile(srcFile, fileName, cb) {
    request(srcFile)
        .on('end', function () {
            log.info('=>file downloaded', srcFile);
            cb();
        })
        .on('error', function (err) {
            log.error('=>Failed to download file', input, err);
            cb(err);
        })
        .pipe(fs.createWriteStream(fileName));
}

function _determineFileExtAndProceed(input, ext, cb) {
    if (ext !== "pdf") {
        return processFile(input, function (err) {
            cb(err, input.srcFile, null);
        });
    }
    //Convert to .tiff using imagemagick
    var tiffFileName = uuid.v4() + '.tiff'
    convertToTiff(input, tiffFileName, function (err) {
        if (err) {
            log.info('=>Failed to convert pdf to tiff');
            return cb(err, input.srcFile, tiffFileName);
        }
        input._srcFile = input.srcFile;
        input.srcFile = tiffFileName;
        processFile(input, function (err) {
            cb(err, input._srcFile, tiffFileName);
        });
    })
}


function convertToTiff(input, tiffFileName, cb) {
    var cmd = 'convert -density 300 ' + input.srcFile + ' -depth 8 ' + tiffFileName;

    //Execute imagemagick convert command in order to convert the pdf into tiff file
    exec(cmd, function (err, stdout, stderr) {
        if (err) {
            log.error('=>Failed to convert file to tiff', err);
            return cb(err)
        }
        log.info('convertToTiff success', tiffFileName);
        cb(null, tiffFileName)
    });
}


//Use tesseract to convert the input file into searchable pdf
function processFile(input, cb) {
    var options = {
        l: 'eng',
        config: 'pdf',
        outputFile: input.destFile || 'out',
        binary: '/usr/local/bin/tesseract'
    };

    tesseract.process(input.srcFile, options, cb);
}
