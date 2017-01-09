# cavo-ocr
Api server to do ocr for input files

#Steps to run

1. Copy Dockerfile and start.sh to some directory say /Users/devendra/
2. Build the docker - docker build -t cavo-ocr .
3. Run docker image - docker run -d --restart=always --name cavo-ocr -v /Users/yuvraj/Projects/docker/cavo-ocr/golang:/var/log/ocr -p 61004:61004 cavo-ocr golang b0a6c855dca8548243707ea4552a7015ca392fad 2 3 61004
