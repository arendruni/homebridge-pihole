[![npm](https://img.shields.io/npm/v/homebridge-pihole.svg)](https://www.npmjs.com/package/homebridge-pihole)
[![npm](https://img.shields.io/npm/dt/homebridge-pihole.svg)](https://www.npmjs.com/package/homebridge-pihole)
[![MIT license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

# Homebridge Pi-hole

[Pi-hole](https://github.com/pi-hole/pi-hole) plugin for Homebridge

## Requirements
-	[Homebridge](https://github.com/nfarina/homebridge) - _HomeKit support for the impatient_
-	[Pi-hole](https://github.com/pi-hole/pi-hole) - _A black hole for Internet advertisements_

## Installation
1.	Install this plugin `npm install -g homebridge-pihole`
2.	Update your configuration file. See sample-config.json in this repository for a sample.

See the Pi-hole [installation section](https://github.com/pi-hole/pi-hole#one-step-automated-install) for more details.

## Configuration

There are only two required options:
 * ```name``` Accessory name.
 * ```auth``` Pi-hole auth token.

See the [sample-config.json](sample-config.json) file to see an example of working accessory config.

## How to get a Pi-hole authentication token
1.	Login into your Pi-hole Admin Console.
2.	Navigate to the _Settings_ page and then to the _API / Web interface_ tab.
3.	At the bottom of the page click on the _Show API Token_ button, a popup window will ask for confirmation, go ahead and click on _Yes, show API token_.
4.	A new window will open showing a QR code, copy the _Raw API Token_ below the QR code.
5.	Paste your API token in the homebridge configuration file.

## Licence

(The MIT License)

Copyright (c) 2019

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