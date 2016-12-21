# cavo-ocr
Api server to do ocr for input files

#Instructions for getting up an instance

* Copy the Dockerfile and start.sh file to some directory and use the below steps once u get into that directory

## Build docker
docker build -t cavo-ocr .

## Run docker
docker run -d --name cavo-ocr -p 80:80 -p 8090:8090 cavo-ocr production b0a6c855dca8548243707ea4552a7015ca392fad

## Get inside docker machine
docker exec -it cavo-ocr bash

## Use the below command to submit a request to the server

```sh
#For pdf at some location
curl -XPOST -d '{"callback":"https://dev-api.gotuktuk.in/rest/o/v1/cb","srcFile": "Testing_Cavo.pdf", "destFile":"dev2"}' -H 'content-type:application/json' <hostname>/rest/files

#For image at some url
curl -XPOST -d '{"callback":"https://dev-api.gotuktuk.in/rest/o/v1/cb","srcFile": "http://solutions.weblite.ca/pdfocrx/scansmpl.pdf", "destFile":"dev7"}' -H 'content-type:application/json' <hostname>/rest/files

#For pdf hosted at some url
curl -XPOST -d '{"callback":"https://dev-api.gotuktuk.in/rest/o/v1/cb","srcFile": "http://solutions.weblite.ca/pdfocrx/scansmpl.pdf", "destFile":"dev7"}' -H 'content-type:application/json' <hostname>/rest/files
```
