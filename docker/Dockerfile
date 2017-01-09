#using debian:jessie for it's smaller size over ubuntu
FROM ubuntu:14.04

# Replace shell with bash so we can source files
RUN rm /bin/sh && ln -s /bin/bash /bin/sh

# Run updates and install deps
RUN apt-get update

RUN apt-get install -y -q --no-install-recommends \
    apt-transport-https \
    build-essential \
    ca-certificates \
    curl \
    g++ \
    gcc \
    git \
    libcurl3 \
    libcurl3-dev \
    php5-curl \
    libcairo2-dev \
    libcurl4-openssl-dev \
    libgif-dev \
    libicu-dev \
    libssl-dev \
    libudev-dev \
    make \
    libpq-dev \
    rsync \
    rsyslog \
    software-properties-common \
    sudo \
    wget \
    vim

RUN apt-get install -y  python-software-properties

RUN apt-get update

RUN apt-get -y upgrade

#Install tesseract and imagemagick
RUN apt-get install -y imagemagick
RUN apt-get install -y autoconf automake libtool
RUN apt-get install -y pkg-config
RUN apt-get install -y libpng12-dev
RUN apt-get install -y libjpeg8-dev
RUN apt-get install -y libtiff5-dev
RUN apt-get install -y zlib1g-dev
RUN apt-get install -y libicu-dev
RUN apt-get install -y libcairo2-dev

RUN echo "deb http://us.archive.ubuntu.com/ubuntu vivid main universe" | tee -a /etc/apt/sources.list
RUN apt-get update

RUN apt-get install -y libleptonica-dev

#Get specific commit from tesseract for date 21-12-2016
RUN git clone https://github.com/tesseract-ocr/tesseract.git && cd tesseract && git checkout df8dcf18347e6cdc1110b67e58cbd6ca1150f7d2 . && ./autogen.sh && ./configure && make && make install && ldconfig && cd ..

ENV TESSDATA_PREFIX /usr/local/share/tessdata

#download data files for tesseract
RUN wget https://github.com/tesseract-ocr/tessdata/raw/master/eng.traineddata -P /usr/local/share/tessdata/
RUN wget https://github.com/tesseract-ocr/tessdata/raw/master/osd.traineddata -P /usr/local/share/tessdata/

RUN apt-get -y autoclean
RUN rm -rf /var/lib/apt/lists/*

ENV GOVERSION 1.7.1
ENV GOROOT /opt/go

ENV GOPATH /var/www/api:/var/www/deps

RUN cd /opt && wget https://storage.googleapis.com/golang/go${GOVERSION}.linux-amd64.tar.gz && \
    tar zxf go${GOVERSION}.linux-amd64.tar.gz && rm go${GOVERSION}.linux-amd64.tar.gz && \
    ln -s /opt/go/bin/go /usr/bin/


# Create Directory
RUN mkdir -p /var/www/api
# Set the Log Directory
RUN mkdir -p /var/log/ocr

WORKDIR /var/www

# add start.sh script
ADD start.sh /var/www
RUN chmod +x /var/www/start.sh

RUN apt-get -y autoclean && apt-get clean --quiet && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

ENTRYPOINT ["/bin/bash", "/var/www/start.sh"]