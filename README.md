# Homebridge Pi-hole [![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

[![npm](https://img.shields.io/npm/v/homebridge-pihole.svg)](https://www.npmjs.com/package/homebridge-pihole)
[![npm](https://img.shields.io/npm/dt/homebridge-pihole.svg)](https://www.npmjs.com/package/homebridge-pihole)
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/8bf5a87dc8a84df6a15deb699d43ee2b)](https://www.codacy.com/manual/arendruni/homebridge-pihole?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=arendruni/homebridge-pihole&amp;utm_campaign=Badge_Grade)
[![Build Status](https://github.com/arendruni/homebridge-pihole/workflows/Main/badge.svg?branch=master)](https://github.com/arendruni/homebridge-pihole/actions?query=workflow%3AMain)
[![MIT license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[Pi-hole](https://github.com/pi-hole/pi-hole) plugin for Homebridge

## Requirements

- [Homebridge](https://github.com/nfarina/homebridge) - *HomeKit support for the impatient*
- [Pi-hole](https://github.com/pi-hole/pi-hole) - *A black hole for Internet advertisements*

## Installation

1. Install this plugin `npm install -g homebridge-pihole`
2. Update your configuration file. See sample-config.json in this repository for a sample.

See the Pi-hole [installation section](https://github.com/pi-hole/pi-hole#one-step-automated-install) for more details.

## Configuration

There are the following options:

- `accessory` Required. Accessory name, default is *Pihole*.

### Pi-hole Configuration

- `auth` Pi-hole auth token.
- `host` Pi-hole host, default is `localhost`.
- `port` Pi-hole port, default is `80`.
- `time` How long Pi-hole will be disabled, in seconds, default is 0 that means permanently disabled.
- `logLevel` Logging level, three different levels: 0: logging disabled, 1: logs only HTTP errors, 2: logs each HTTP response. Default is set to 1.

### Device Information

- `manufacturer` Custom manufacturer, default is __Raspberry Pi__.
- `model` Custom model, default is __Pi-hole__.
- `serial-number` Should be a 9 digit number in the string format *123-456-789*.
- `name` The model name, default is __Pi-hole__.

See the [sample-config.json](sample-config.json) file to see an example of how to configure the accessory. In the example the configured accessory will disable Pi-hole for a time interval of two minutes (120 seconds).

## How to get a Pi-hole authentication token

1. Login into your Pi-hole Admin Console.
2. Navigate to the *Settings* page and then to the *API / Web interface* tab.
3. At the bottom of the page click on the *Show API Token* button, a popup window will ask for confirmation, go ahead and click on *Yes, show API token*.
4. A new window will open showing a QR code, copy the *Raw API Token* below the QR code.
5. Paste your API token in the homebridge configuration file.
