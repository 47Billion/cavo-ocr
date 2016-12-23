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

// middleware to use for all requests
router.use(function (req, res, next) {
    // do logging
    log.info('Something is happening.');
    next();
});

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

        //Check if file needs to be downloaded?
        if ((input.srcFile.indexOf('https://') === 0) || (input.srcFile.indexOf('http://') === 0)) {
            var re = /(?:\.([^.]+))?$/;
            var ext = re.exec(input.srcFile)[1];
            var fileName = uuid.v4() + "." + ext;
            var file = fs.createWriteStream(fileName);

            request(input.srcFile)
                .on('end', function () {
                    log.info('=>file downloaded', input.srcFile);
                    input._srcFile = input.srcFile;
                    input.srcFile = fileName;
                    determineFileExtAndProceed(input);
                })
                .on('error', function (err) {
                    log.info('=>Failed to download file', input, err);
                    //Invoke callback if any
                    notifyOnCallbackUrl(input.callback, 'failure');
                })
                .pipe(fs.createWriteStream(fileName))


        } else if (input.srcFile.indexOf('file://') === 0) {
            input.srcFile = input.srcFile.replace('file://', '');
            determineFileExtAndProceed(input);
        } else {
            log.info('=>File protocol not identified considering a local file...', input.srcFile);
            determineFileExtAndProceed(input);
        }

        res.json({message: 'Request accepted!'});
    });


// REGISTER OUR ROUTES -------------------------------
app.use('/rest', router);

// START THE SERVER
// =============================================================================
app.listen(port);
log.info('Server started on port ' + port);

function determineFileExtAndProceed(input) {
    //Convert the file to tif in case the input is a pdf
    var re = /(?:\.([^.]+))?$/;
    var ext = re.exec(input.srcFile)[1];

    if (ext === "pdf") { //Convert to .tiff using imagemagick

        var tiffFileName = uuid.v4() + '.tiff'

        convertToTiff(input, tiffFileName, function (err, tifFilePath) {
            if (err) {
                log.info('=>Failed to convert pdf to tiff');
                //Invoke callback if any
                notifyOnCallbackUrl(input.callback, 'failure');
                return;
            }
            input._srcFile = input.srcFile;
            input.srcFile = tifFilePath;
            processFile(input);
        })
    } else {
        processFile(input);
    }
}

//Use tesseract to convert the input file into searchable pdf
function processFile(input) {
    var options = {
        l: 'eng',
        // psm: 6,
        config: 'pdf',
        outputFile: input.destFile || 'out',
        binary: '/usr/local/bin/tesseract'
    };
    tesseract.process(input.srcFile, options, function (err, text) {
        if (err) {
            //Invoke callback if any
            notifyOnCallbackUrl(input.callback, 'failure');
            return log.error(err);
        } else {
            log.info('==>tessearct command completed', text);
            log.info('=>deleting', input.srcFile)
            fs.unlink(input.srcFile)
            if (input._srcFile) {
                log.info('=>deleting', input._srcFile)
                if (fs.existsSync(input._srcFile)) {
                    fs.unlink(input._srcFile)
                }
            }
            //Invoke callback if any
            notifyOnCallbackUrl(input.callback, 'success');
        }
    });
}

function convertToTiff(input, tiffFileName, cb) {
    var cmd = 'convert -density 300 ' + input.srcFile + ' -depth 8 ' + tiffFileName;

    //Execute imagemagick convert command in order to convert the pdf into tiff file
    exec(cmd, function (err, stdout, stderr) {
        if (err) {
            log.info('=>Failed to convert file to tiff', err);
            //Invoke callback if any
            notifyOnCallbackUrl(input.callback, 'failure');
            return (err)
        }
        log.info('convertToTiff success');
        log.info('=>deleting', input.srcFile)
        fs.unlink(input.srcFile)
        input.srcFile = tiffFileName;
        cb(null, tiffFileName)
    });
}

//Call the callback url with status of the request
//One can pass the identifier for the request in path param in order to identify their request once callback
//is invoked
function notifyOnCallbackUrl(url, status, cb) {
    if (!url) return;
    url += '?status=' + status
    request(url, function (error, response, body) {
        if (error) {
            //log.info(body) // Show the HTML for the Google homepage.
            cb && cb(error)
        }
        cb && cb();
    })
}


