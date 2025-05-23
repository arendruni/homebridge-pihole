# Homebridge Pi-hole [![verified-by-homebridge](https://badgen.net/badge/homebridge/verified/purple)](https://github.com/homebridge/homebridge/wiki/Verified-Plugins)

[![npm](https://img.shields.io/npm/v/homebridge-pihole.svg)](https://www.npmjs.com/package/homebridge-pihole)
[![npm](https://img.shields.io/npm/dt/homebridge-pihole.svg)](https://www.npmjs.com/package/homebridge-pihole)
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/8bf5a87dc8a84df6a15deb699d43ee2b)](https://www.codacy.com/manual/arendruni/homebridge-pihole)
[![Build Status](https://github.com/arendruni/homebridge-pihole/workflows/Main/badge.svg?branch=master)](https://github.com/arendruni/homebridge-pihole/actions?query=workflow%3AMain)
[![MIT license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[Pi-hole](https://github.com/pi-hole/pi-hole) plugin for Homebridge.
This plugin publishes a virtual switch that disables Pi-hole, making it easier to temporarily turn off the ad-blocker. Supports SSL connections and can be configured with a timer to turn Pi-hole back on.

## Requirements

- [Homebridge](https://github.com/nfarina/homebridge) - _HomeKit support for the impatient_
- [Pi-hole](https://github.com/pi-hole/pi-hole) - _A black hole for Internet advertisements_

## Installation

1. Install this plugin `npm install -g homebridge-pihole`
2. Update your configuration file. See sample-config.json in this repository for a sample.

See the Pi-hole [installation section](https://github.com/pi-hole/pi-hole#one-step-automated-install) for more details.

## Configuration

There are the following options:

- `name` Required. Accessory name, default is _Pi-hole_.

### Pi-hole Configuration

- `auth` Pi-hole password or app password when using 2FA, see the section on [how to get an app password](#how-to-get-a-pi-hole-app-password).
- `baseUrl` Pi-hole base URL, default is `http://localhost`.
- `path` The directory where the Pi-hole dashboard is located. Default is `/api`.
- `rejectUnauthorized` If the HTTPS agent should check the validity of SSL cert, set it to `false` to allow self-signed certs to work. Default is `true`.
- `time` How long Pi-hole will be disabled, in seconds, default is 0 that means permanently disabled.
- `reversed` When set to `true` reverse the status of Pi-hole. When Pi-hole is _off_ the plugin will be set to _on_ and when Pi-hole is _on_ the plugin will be set to _off_. Default is `false`.
- `logLevel` Logging level, three different levels: 0: logging disabled, 1: logs only HTTP errors, 2: logs each HTTP response. Default is set to 1.

### Device Information

- `manufacturer` Custom manufacturer, default is _Raspberry Pi_.
- `model` Custom model, default is _Pi-hole_.
- `serial-number` Should be a 9 digit number in the string format _123-456-789_.

See the [sample-config.json](sample-config.json) file to see an example of how to configure the accessory. In the example the configured accessory will disable Pi-hole for a time interval of two minutes (120 seconds).

## How to get a Pi-hole app password

1. Login into your Pi-hole Admin Console.
2. Navigate to the _Settings_ page and then to the  _Web interface / API_ tab, and enable the _Expert_ settings.
3. In the _Advanced Settings_ panel, click on the _Configure app password_ button, a popup window will ask for confirmation, go ahead and copy the app password then click on _Enable new app password_.
4. Paste your App password in the homebridge-pihole configuration file.
