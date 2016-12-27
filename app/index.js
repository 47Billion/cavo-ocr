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
router.route('/files/sync')
    // create a bear (accessed at POST http://localhost:8080/bears)
    .post(function (req, res) {
        var input = req.body || {};
        log.info('=>input', input);

        _doOcr(input, function (err) {
            if (err) {
                log.error('=>onCompleteOcr', err);
                return res.status(500).json({message: 'Request failed!'});
            }
            res.json({message: 'Request completed!'});
        });


    });

router.route('/files')
    // create a bear (accessed at POST http://localhost:8080/bears)
    .post(function (req, res) {
        var input = req.body || {};
        log.info('=>input', input);

        _doOcr(input, function (err) {
            log.error('=>onCompleteOcr', err);
            if (err) {

                return;
                //return res.status(500).json({message: 'Request failed!'});
            }
        });

        res.json({message: 'Request accepted!'});
    });

app.use('/rest', router);

app.listen(port);

log.info('Server started on port ' + port);

function _doOcr(input, cb) {
    var protocol = _determineProtocol(input.srcFile)
    var re = /(?:\.([^.]+))?$/;
    var ext = re.exec(input.srcFile)[1];

    switch (protocol) {
        case 'https':
        case 'http':
            _downloadAndOCR(input, ext, cb);
            break;
        case 'file':
            input.srcFile = input.srcFile.replace('file://', '');
        default:
            _ocrLocalFile(input, ext, cb);
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

function _downloadAndOCR(input, ext, cb) {
    var fileName = uuid.v4() + "." + ext;
    _downloadFile(input.srcFile, fileName, function onDownloadComplete(err) {

        if (err) {
            log.error('=>onDownloadComplete', input, err);
            return cb(err);
        }

        input.srcFile = fileName;

        _determineFileExtAndProceed(input, ext, function onOcrComplete(err, srcFile, intermediateTiffFile) {
            if (err) {
                log.error('=>onOcrComplete', input, err);
            }

            //Delete intermediate files
            if (srcFile && fs.existsSync(srcFile)) {
                fs.unlink(srcFile)
            }

            if (intermediateTiffFile && fs.existsSync(intermediateTiffFile)) {
                fs.unlink(intermediateTiffFile)
            }
            cb(err);
        });
    });
}

function _ocrLocalFile(input, ext, cb) {
    _determineFileExtAndProceed(input, ext, function onOcrComplete(err, srcFile, intermediateTiffFile) {

        if (err) {
            log.error('=>onOcrComplete', input, err);
        }
        //Delete intermediate files
        log.info('=>_ocrLocalFile DONE', input.destFile);
        if (intermediateTiffFile && fs.existsSync(intermediateTiffFile)) {
            fs.unlink(intermediateTiffFile)
        }
        cb(err);
    });
}

function _downloadFile(srcFile, fileName, cb) {
    request(srcFile)
        .on('end', function () {
            log.info('=>file downloaded', srcFile);

            cb();
        })
        .on('error', function (err) {
            log.error('=>Failed to download file', srcFile, fileName, err);
            cb(err);
        })
        .pipe(fs.createWriteStream(fileName));
}

function _determineFileExtAndProceed(input, ext, cb) {
    if (ext !== "pdf") {
        return processFile(input, function onProcessComplete(err) {
            if (err) {
                log.debug('=>onProcessComplete', input, err);
                return cb(err, input._srcFile, tiffFileName);
            }
            log.debug('=>onProcessComplete', input);
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
        processFile(input, function onProcessComplete(err) {
            if (err) {
                log.debug('=>onProcessComplete', input, err);
                return cb(err, input._srcFile, tiffFileName);
            }
            log.debug('=>onProcessComplete', input);
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
    log.debug('=>processFile', input);
    var options = {
        l: 'eng',
        config: 'pdf',
        outputFile: input.destFile || 'out',
        binary: 'tesseract'
    };

    tesseract.process(input.srcFile, options, cb);
}
