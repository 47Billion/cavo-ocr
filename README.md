# cavo-ocr
Api server to do ocr for input files

#Steps to run

1. Copy Dockerfile and start.sh to some directory say /Users/devendra/
2. Build the docker - docker build -t cavo-ocr .
3. Run docker image - docker run -d --restart=always --name cavo-ocr -v /Users/devendra:/var/log/ocr -p <HOSTPORT>:<OCR_SERVER_PORT> cavo-ocr golang b0a6c855dca8548243707ea4552a7015ca392fad <WORKER_COUNT> <MAX_QUEUE_LENGTH> <OCR_SERVER_PORT>

* example - docker run -d --restart=always --name cavo-ocr -v /Users/devendra:/var/log/ocr -p 61004:61004 cavo-ocr golang b0a6c855dca8548243707ea4552a7015ca392fad 2 3 61004



#Submit requests

1. Convert a remote file - 
``` curl
curl -XPOST -H 'content-type:application/json' \
-d '{"cb":"https://dev-api.gotuktuk.in/rest/o/v1/cb","source": "http://solutions.weblite.ca/pdfocrx/scansmpl.pdf", "destination":"/var/log/ocr/converted1"}' \
'http://<dockerhost>:61004/api/nb/convert'
```
Response - 
``` json
{"id":"b1ppvcb9ukk00knrdpag","status":"WAIT"}
```

2. Convert a local file -
``` curl
curl -XPOST -H 'content-type:application/json' \
-d '{"cb":"https://dev-api.gotuktuk.in/rest/o/v1/cb","source": "http://solutions.weblite.ca/pdfocrx/scansmpl.pdf", "destination":"/var/log/ocr/converted1"}' \
'http://192.168.99.100:61004/api/nb/convert'
```
Response -
``` json
{"id":"b1pq03b9ukk00knrdpbg","status":"PROCESS"}
```

3. Check job status -
``` curl
curl -XGET http://192.168.99.100:61004/api/status\?\id=b1pq2vb9ukk00knrdpd0
```
Response -
``` json
{"id":"b1pq03b9ukk00knrdpbg","status":"PROCESS"}
```
Note - 
OCR_SERVER will invoke callback url specified with additional query params - status and id
https://dev-api.gotuktuk.in/rest/o/v1/cb?status=FINISH&id=b1pq03b9ukk00knrdpbg

Status could be - FINISH or ERROR
#Job Status codes
STATUS_QUEUED     = "WAIT"
STATUS_IN_PROCESS = "PROCESS"
STATUS_COMPLETE   = "FINISH"
STATUS_ERRORED    = "ERROR"
