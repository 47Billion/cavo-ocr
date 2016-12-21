#using debian:jessie for it's smaller size over ubuntu
FROM ubuntu:14.04

# Replace shell with bash so we can source files
RUN rm /bin/sh && ln -s /bin/bash /bin/sh

# Set environment variables
ENV apiDir /var/www/api

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
    #libjpeg62-turbo-dev \
    #libpango1.0-dev \
    libssl-dev \
    libudev-dev \
    make \
    libpq-dev \
    rsync \
    rsyslog \
    software-properties-common \
    sudo \
    #telnet \
    wget \
    vim

RUN apt-get install -y  python-software-properties

RUN add-apt-repository ppa:nginx/stable

RUN apt-get update

RUN apt-get -y upgrade
RUN apt-get install -y nginx-full

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

RUN git clone https://github.com/tesseract-ocr/tesseract.git && cd tesseract && ./autogen.sh && ./configure && make && make install && ldconfig && cd ..

#RUN apt-get install -y tesseract-ocr
#RUN apt-get install -y tesseract-ocr-eng
#RUN mkdir /usr/local/share/tessdata
ENV TESSDATA_PREFIX /usr/local/share/tessdata

#download data files for tesseract
RUN wget https://github.com/tesseract-ocr/tessdata/raw/master/eng.traineddata -P /usr/local/share/tessdata/
RUN wget https://github.com/tesseract-ocr/tessdata/raw/master/osd.traineddata -P /usr/local/share/tessdata/


# RUN apt-get install -y    nginx-full
RUN apt-get -y autoclean
RUN rm -rf /var/lib/apt/lists/* && rm /etc/nginx/sites-enabled/default

ENV NVM_DIR /usr/local/nvm
ENV NODE_VERSION 4.5.0

# Install nvm with node and npm
RUN curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.26.0/install.sh | bash \
    && source $NVM_DIR/nvm.sh \
    && nvm install $NODE_VERSION \
    && nvm alias default $NODE_VERSION \
    && nvm use default

# Set up our PATH correctly so we don't have to long-reference npm, node, &c.
ENV NODE_PATH $NVM_DIR/versions/node/v$NODE_VERSION/lib/node_modules
ENV PATH      $NVM_DIR/versions/node/v$NODE_VERSION/bin:$PATH

# Create Directory
RUN mkdir -p /var/www/app
RUN mkdir -p /var/www/api
# Set the Log Directory
RUN mkdir -p /var/log/ocr

WORKDIR /var/www

# Install PM2
RUN npm install pm2 -g

# git repo crontab sh
RUN echo "* * * * * root /bin/bash /var/www/publicpages.sh  >> /var/log/cron.log 2>&1" >> /etc/crontab

# Create the log file to be able to run tail
RUN touch /var/log/cron.log

# add start.sh script
ADD start.sh /var/www
RUN chmod +x /var/www/start.sh

RUN apt-get -y autoclean && apt-get clean --quiet && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

ENTRYPOINT ["/bin/bash", "/var/www/start.sh"]