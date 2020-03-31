#!/bin/sh

# install homebridge image
npm install -g --unsafe-perm homebridge

DEBUG=* timeout --preserve-status --kill-after 40s --signal SIGINT 30s homebridge --debug --no-qrcode --user-storage-path ./test-configuration --plugin-path ./ &
sleep 10 && curl -s -X PUT http://localhost:51826/characteristics --header "Content-Type:Application/json" --header "authorization: 031-45-156" --data "{\"characteristics\":[{\"aid\":3,\"iid\":10,\"value\":false}]}"
