package logger

import (
	"os"
	"runtime"
	"strings"

	log "github.com/Sirupsen/logrus"
	"github.com/rifflock/lfshook"
)

var Logger *log.Logger

func Info(args ...interface{}) {
	file, line := caller()
	Logger.WithFields(log.Fields{"file": file, "line": line}).Info(args)
}

func Error(args ...interface{}) {
	file, line := caller()
	Logger.WithFields(log.Fields{"file": file, "line": line}).Info(args)
}

func Debug(args ...interface{}) {
	file, line := caller()
	Logger.WithFields(log.Fields{"file": file, "line": line}).Debug(args)
}

func init() {
	// Log as JSON instead of the default ASCII formatter.
	log.SetFormatter(&log.JSONFormatter{})
	//	log.SetFormatter(&log.TextFormatter{})
	// Output to stderr instead of stdout, could also be a file.
	log.SetOutput(os.Stderr)
	//	log.SetLevel(log.DebugLevel)
	// Only log the warning severity or above.
	log.SetLevel(log.WarnLevel)

	Logger = log.New()
	Logger.Level = log.DebugLevel

	//TODO- Log rotation is pending use lfshook for the same.
	Logger.Hooks.Add(lfshook.NewHook(lfshook.PathMap{
		log.InfoLevel:  "/var/log/ocr/ocr.log",
		log.ErrorLevel: "/var/log/ocr/ocr-error.log",
	}))

}

//Gives back the line number and file name
func caller() (file string, line int) {
	var ok bool
	_, file, line, ok = runtime.Caller(2)
	if !ok {
		file = "???"
		line = 1
	} else {
		slash := strings.LastIndex(file, "/")
		if slash >= 0 {
			file = file[slash+1:]
		}
	}
	return
}
