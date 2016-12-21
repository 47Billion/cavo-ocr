# cavo-ocr
Api server to do ocr for input files


## Use the below command to submit a request to the server

```sh
curl -XPOST -d '{"callback":"https://dev-api.gotuktuk.in/rest/o/v1/cb","srcFile": "Testing_Cavo.pdf", "destFile":"dev2"}' -H 'content-type:application/json' localhost:8090/rest/files
```

## Build docker
docker build -t cavo-ocr .

docker run -d -p 8095:80 -p 8090:8090 cavo-ocr production 5ecd7ac6a524e5edf78c90d9c5b9a3abc2f91a40