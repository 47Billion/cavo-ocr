# cavo-ocr
Api server to do ocr for input files


## Use the below command to submit a request to the server

```sh
curl -XPOST -d '{"callback":"https://dev-api.gotuktuk.in/rest/o/v1/cb","srcFile": "Testing_Cavo.pdf", "destFile":"dev2"}' -H 'content-type:application/json' localhost:8090/rest/files
```
