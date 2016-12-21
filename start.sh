#!/bin/bash
#Run the script using - sh start.sh project-setup
echo "-------------------------->Start up script invoked<--------------------------"
# Set ENV $1
echo "export NODE_ENV=$1" |tee -a /etc/bash.bashrc
export NODE_ENV=$1

# git clone server-configs
cd /var/www/api
git clone https://$2@github.com/47Billion/cavo-ocr.git .
#git checkout $1
#git pull

npm install

echo "pm2 start ocr.js"
pm2 start ocr.js -i 1

cp /var/www/api/default /etc/nginx/sites-enabled/

/etc/init.d/nginx start

tail -f /etc/issue