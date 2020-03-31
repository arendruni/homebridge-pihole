#!/bin/sh

# install homebridge
npm install -g --unsafe-perm homebridge

# install pihole
curl -sSL https://install.pi-hole.net | bash

# test configuration
DEBUG=* timeout --preserve-status --kill-after 30s --signal SIGINT 20s homebridge --debug --no-qrcode --user-storage-path ./test-configuration --plugin-path ./

if [ $? -eq 130 ]; then
	exit 0;
fi

exit $?
