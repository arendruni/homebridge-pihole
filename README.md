[![npm](https://img.shields.io/npm/v/homebridge-pihole.svg)](https://www.npmjs.com/package/homebridge-pihole)
[![npm](https://img.shields.io/npm/dt/homebridge-pihole.svg)](https://www.npmjs.com/package/homebridge-pihole)
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/8bf5a87dc8a84df6a15deb699d43ee2b)](https://www.codacy.com/manual/arendruni/homebridge-pihole?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=arendruni/homebridge-pihole&amp;utm_campaign=Badge_Grade)
[![Build Status](https://travis-ci.org/arendruni/homebridge-pihole.svg?branch=master)](https://travis-ci.org/arendruni/homebridge-pihole)
[![MIT license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

# Homebridge Pi-hole

[Pi-hole](https://github.com/pi-hole/pi-hole) plugin for Homebridge

## Requirements

- [Homebridge](https://github.com/nfarina/homebridge) - *HomeKit support for the impatient*
- [Pi-hole](https://github.com/pi-hole/pi-hole) - *A black hole for Internet advertisements*

## Installation

1. Install this plugin `npm install -g homebridge-pihole`
2. Update your configuration file. See sample-config.json in this repository for a sample.

See the Pi-hole [installation section](https://github.com/pi-hole/pi-hole#one-step-automated-install) for more details.

## Configuration

There are four options:

- `name` Required. Accessory name, default is *Pihole*.
- `auth` Pi-hole auth token.
- `host` Pi-hole host, default is `localhost`.
- `port` Pi-hole port, default is `80`.
- `time` How long Pi-hole will be disabled, in seconds, default is 0 that means permanently disabled.
- `logLevel` Logging level, three different levels: 0: logging disabled, 1: logs only HTTP errors, 2: logs each HTTP response. Default is set to 1.

See the [sample-config.json](sample-config.json) file to see an example of how to configure the accessory. In the example the configured accessory will disable pi-hole for a time interval of two minutes (120 seconds).

## How to get a Pi-hole authentication token

1. Login into your Pi-hole Admin Console.
2. Navigate to the *Settings* page and then to the *API / Web interface* tab.
3. At the bottom of the page click on the *Show API Token* button, a popup window will ask for confirmation, go ahead and click on *Yes, show API token*.
4. A new window will open showing a QR code, copy the *Raw API Token* below the QR code.
5. Paste your API token in the homebridge configuration file.

## Licence

(The MIT License)

Copyright (c) 2020

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
