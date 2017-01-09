#!/bin/bash
#Run the script using - sh start.sh project-setup
echo "-------------------------->Start up script invoked<--------------------------"
# Set ENV $1
#echo "export NODE_ENV=$1" |tee -a /etc/bash.bashrc

# git clone server-configs
cd /var/www/api
git clone https://$2@github.com/47Billion/cavo-ocr.git .
git checkout $1
git pull

echo "bin/server $3 $3 $5"
bin/server $3 $4 $5

tail -f /etc/issue