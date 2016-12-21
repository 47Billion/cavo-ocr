# cavo-ocr
Api server to do ocr for input files


## Use the below command to submit a request to the server

```sh
curl -XPOST -d '{"callback":"https://dev-api.gotuktuk.in/rest/o/v1/cb","srcFile": "Testing_Cavo.pdf", "destFile":"dev2"}' -H 'content-type:application/json' localhost:8090/rest/files

curl -XPOST -d '{"callback":"https://dev-api.gotuktuk.in/rest/o/v1/cb","srcFile": "http://solutions.weblite.ca/pdfocrx/scansmpl.pdf", "destFile":"dev7"}' -H 'content-type:application/json' localhost:8090/rest/files
```

## Build docker
docker build -t cavo-ocr .

docker run -d --name cavo-ocr -p 8095:80 -p 8090:8090 cavo-ocr production b0a6c855dca8548243707ea4552a7015ca392fad

docker exec -it cavo-ocr bash