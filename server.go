package main

import (
	"container/list"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path"
	"strconv"
	"strings"
	"time"

	log "./logger"
	"github.com/karlseguin/ccache"
	"github.com/rs/xid"
	"gopkg.in/gin-gonic/gin.v1"
	"gopkg.in/go-playground/validator.v9"
)

const (
	STATUS_QUEUED     = "WAIT"
	STATUS_IN_PROCESS = "PROCESS"
	STATUS_COMPLETE   = "FINISH"
	STATUS_ERRORED    = "ERROR"
)

//Defualt worker count
var NO_OF_WORKERS = 2

//At a time max MAX_QUEUE_LENGTH+NO_OF_WORKERS requests can be under process(3 in process+3 in queue)
var MAX_QUEUE_LENGTH = 3

//Jobs queue
var jobs chan *Job

//Results queu
var results chan *Job

//Job status store
var cache = ccache.New(ccache.Configure().MaxSize(1000).ItemsToPrune(100))
var validation = validator.New()

// Default Request Handler
func convertHandler(ctx *gin.Context) {
	//Generate a unique id for this job here
	jobId := xid.New().String()

	log.Info("=>convertHandler", jobId)
	var job Job

	if err := ctx.BindJSON(&job); nil != err {
		log.Info("=>convertHandler Invalid json", err)
		ctx.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": "job queue limit exceeded"})
		return
	}

	if validationErr := validation.Struct(job); nil != validationErr {
		log.Info("=>convertHandler invalid input", validationErr)
		ctx.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": validationErr.Error()})
		return
	}

	if len(jobs) == MAX_QUEUE_LENGTH {
		log.Info("=>Channel length", len(jobs))
		ctx.JSON(http.StatusTooManyRequests, gin.H{"status": "error", "message": "job queue limit exceeded"})
		return
	}

	job.Id = jobId
	job.Status = STATUS_QUEUED
	job.FilesToDelete = list.New()

	if err := checkForValidSourceAndDestination(&job); nil != err {
		log.Info("=>convertHandler invalid input source or destination", err)
		ctx.JSON(http.StatusBadRequest, gin.H{"status": "error", "message": err.Error()})
		return
	}

	cache.Set(job.Id, &job, time.Hour*2)

	jobs <- &job
	log.Info("=>Channel length", len(jobs))
	ctx.JSON(http.StatusAccepted, gin.H{"status": job.Status, "id": job.Id})
}

//Check for status of job
func jobStatusHandler(ctx *gin.Context) {
	jobId := ctx.Query("id")

	log.Info("=>jobStatusHandler", jobId)
	if cacheItem := cache.Get(jobId); cacheItem != nil {
		job := cache.Get(jobId).Value().(*Job)
		ctx.JSON(http.StatusOK, gin.H{"status": job.Status, "id": job.Id})
		return
	}
	ctx.JSON(http.StatusForbidden, gin.H{"message": "invlaid/job not found"})

}

func main() {
	log.Info("starting server...")
	if len(os.Args) != 4 {
		panic("USAGE [server WORKER_COUNT QUEUE_LENGTH PORT]")
		return
	}
	if workerCount, err := strconv.Atoi(os.Args[1]); err != nil || workerCount > 9 {
		panic("Invalid worker count specified must be an integer less than 9")
		return
	} else {
		NO_OF_WORKERS = workerCount
	}

	if queueLength, err := strconv.Atoi(os.Args[2]); err != nil {
		panic("Invalid queue length specified must be an integer")
		return
	} else {
		MAX_QUEUE_LENGTH = queueLength
	}

	if port, err := strconv.Atoi(os.Args[3]); err != nil {
		log.Info("Invalid port", port)
		panic("Invalid port specified must be an integer")
		return
	}

	router := gin.Default()
	router.GET("/api/status", jobStatusHandler)
	router.POST("/api/nb/convert", convertHandler)

	// In order to use our pool of workers we need to send
	// them work and collect their results. We make 2
	// channels for this.
	jobs = make(chan *Job, MAX_QUEUE_LENGTH)
	results := make(chan *Job, 1000)

	// This starts up 3 workers, initially blocked
	// because there are no jobs yet.
	for w := 1; w <= NO_OF_WORKERS; w++ {
		go worker(w, jobs, results)
	}

	go resultProcessor(results)
	log.Error(http.ListenAndServe(":"+os.Args[3], router))
}

//Worker to process from job queue
func worker(id int, jobs <-chan *Job, results chan<- *Job) {
	for j := range jobs {
		j.Status = STATUS_IN_PROCESS
		fmt.Println("worker", id, "started  job", j)
		if err := processJob(j); err != nil {
			j.Status = STATUS_ERRORED
		} else {
			j.Status = STATUS_COMPLETE
		}

		//time.Sleep(time.Second * 10)
		//j.Status = STATUS_COMPLETE
		log.Info("worker", id, "finished job", j)
		//Invoke callback if specified
		invokeCallback(j)
		results <- j
	}
}

//Process the results from the workers one by one
func resultProcessor(results <-chan *Job) {
	// Finally we collect all the results of the work.
	for result := range results {
		//		log.Info("got result", result)
		filesToDelete := result.FilesToDelete
		// Iterate through list and print its contents.
		for e := filesToDelete.Front(); e != nil; e = e.Next() {
			fileName := e.Value.(string)
			fmt.Println("=>resultProcessor Deleting file", fileName)
			if _, err := os.Stat(fileName); err == nil {
				if err = os.Remove(fileName); err != nil {
					fmt.Println("=>resultProcessor Failed to delete file", fileName)
				} else {
					fmt.Println("=>resultProcessor File deleted", fileName)
				}
			}
		}
	}
}

func processJob(job *Job) error {
	protocol := determineProtocol(job.Source)
	switch protocol {
	case "https":
	case "http":
		//Download file and process
		if fileName, err := downloadFromUrl(job.Source); nil != err {
			return err
		} else {
			//Add source in list of files to be deleted after job completion
			job.FilesToDelete.PushBack(fileName)
			job.Source = fileName
		}
		break
	case "file":
		job.Source = strings.Replace(job.Source, "file://", "", 1)
	default:
		//Do nothing
	}

	//The source has been downloaded on top (in case a url was specified).
	//Process file based on extension
	extension := fileExtension(job.Source)
	if extension == ".pdf" {
		//Convert to tiff using imagemagick
		if tiffName, conversionErr := convertToTiff(job); conversionErr != nil {
			return conversionErr
		} else {
			//Add source in list of files to be deleted after job completion
			job.FilesToDelete.PushBack(tiffName)
			job.Source = tiffName
		}

	}

	//Here we are having a file which can be processed by OCR tool
	err := doOcr(job)
	return err
}

func determineProtocol(srcFile string) string {
	if strings.Index(srcFile, "https://") == 0 {
		return "https"
	}
	if strings.Index(srcFile, "http://") == 0 {
		return "http"
	}
	if strings.Index(srcFile, "file://") == 0 {
		return "file"
	}

	return ""
}

//Download some file
func downloadFromUrl(url string) (string, error) {
	extension := fileExtension(url)
	fileName := xid.New().String() + extension
	fmt.Println("Downloading", url, "to", fileName)

	// TODO: check file existence first with io.IsExist
	output, err := os.Create(fileName)
	if err != nil {
		fmt.Println("Error while creating", fileName, "-", err)
		return "", errors.New("Could not create file - " + fileName)
	}
	defer output.Close()

	response, err := http.Get(url)
	if err != nil {
		fmt.Println("Error while downloading", url, "-", err)
		return "", errors.New("File download failed")
	}
	defer response.Body.Close()

	n, err := io.Copy(output, response.Body)
	if err != nil {
		fmt.Println("Error while downloading", url, "-", err)
		return "", errors.New("Could not write file to disk")
	}

	log.Info("File download complete - "+fileName, n)
	return fileName, nil
}

func fileExtension(url string) string {
	return path.Ext(url)
}

func convertToTiff(job *Job) (string, error) {
	log.Info("=>convertToTiff", job)
	tiffFileName := xid.New().String() + ".tiff"

	cmdName := "convert"
	cmdArgs := []string{"-density", "300", job.Source, "-depth", "8", tiffFileName}

	err := execCommand(cmdName, cmdArgs)
	return tiffFileName, err
}

func doOcr(job *Job) error {
	log.Info("=>doOcr", job)
	cmdName := "tesseract"
	cmdArgs := []string{job.Source, job.Destination, "pdf"}

	return execCommand(cmdName, cmdArgs)
}

func invokeCallback(j *Job) {

	if len(j.Callback) != 0 {
		if cbUrl, err := url.Parse(j.Callback); err == nil {
			m, _ := url.ParseQuery(cbUrl.RawQuery)
			m.Set("id", j.Id)
			m.Set("status", j.Status)
			//callbackUrl := j.Callback + "?id=" + j.Id + "&status=" + j.Status
			cbUrl.RawQuery = m.Encode()
			callbackUrl := cbUrl.String()
			log.Info("=>invokeCallback", callbackUrl)
			http.Get(callbackUrl)
			return
		} else {
			log.Error("=>invokeCallback Invalid callback url", j.Callback, err)
		}
	}

	log.Info("=>invokeCallback Callback not specified skipping...", j.Id)
}

func execCommand(cmdName string, cmdArgs []string) error {
	var (
		cmdOut []byte
		err    error
	)
	//	cmdName := "git"
	//	cmdArgs := []string{"rev-parse", "--verify", "HEAD"}
	log.Info("execCommand", cmdName, cmdArgs)
	if cmdOut, err = exec.Command(cmdName, cmdArgs...).Output(); err != nil {
		log.Info("There was an error running command: ", err)
		return err
	}
	output := string(cmdOut)
	log.Info("Command output", output)
	return nil
}

func checkForValidSourceAndDestination(job *Job) error {
	log.Info("=>checkForValidSourceAndDestination", job.Source, job.Destination)
	if protocol := determineProtocol(job.Source); protocol == "file" || protocol == "" {
		if _, err := os.Stat(job.Source); err != nil {
			return errors.New("Could not read source file")
		}
	}
	if _, err := os.Stat(path.Dir(job.Destination)); err != nil {
		return errors.New("Could not read destination directory")
	}
	return nil
}

//Job data holder
type Job struct {
	Id            string     `json:"id"`
	Source        string     `json:"source" validate:"required"`
	Destination   string     `json:"destination" validate:"required"`
	Callback      string     `json:"cb"`
	Status        string     `json:"status"` //Can be WAIT/PROGRESS/FINISH/ERROR
	FilesToDelete *list.List `json:"-"`
}
