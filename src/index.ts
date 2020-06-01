import {
	AccessoryConfig,
	AccessoryPlugin,
	API,
	CharacteristicEventTypes,
	CharacteristicGetCallback,
	CharacteristicSetCallback,
	CharacteristicValue,
	HAP,
	Logging,
	Service
} from "homebridge";

import * as http from "http";
import { stringify } from "querystring";

let hap: HAP;

export = (api: API) => {
	hap = api.hap;
	api.registerAccessory("homebridge-pihole", "Pihole", PiholeSwitch);
};

const BASE_URL = "api.php",
	STATUS_URL = "status",
	ENABLE_URL = "enable",
	DISABLE_URL = "disable",
	AUTH_URL = "auth";

class PiholeSwitch implements AccessoryPlugin {

	private readonly log: Logging;
	private readonly name: string;
	private readonly manufacturer: string;
	private readonly model: string;
	private readonly serial: string;

	private auth: string;
	private host: string;
	private baseDirectory: string;
	private time: number;
	private port: number;
	private logLevel: number;

	private readonly switchService: Service;
	private readonly informationService: Service;

	constructor(log: Logging, config: AccessoryConfig, api: API) {
		this.log = log;
		this.name = config.name;

		this.manufacturer = config["manufacturer"] || "Raspberry Pi";
		this.model = config["model"] || "Pi-hole";
		this.serial = config["serial-number"] || "123-456-789";

		this.auth = config["auth"] || "";
		this.host = config["host"] || "localhost";
		this.baseDirectory = config["baseDirectory"] || "/admin/";
		this.time = config["time"] || 0;
		this.port = config["port"] || 80;
		this.logLevel = config["logLevel"] || 1;

		this.informationService = new hap.Service.AccessoryInformation()
			.setCharacteristic(hap.Characteristic.Manufacturer, this.manufacturer)
			.setCharacteristic(hap.Characteristic.Model, this.model)
			.setCharacteristic(hap.Characteristic.SerialNumber, this.serial);

		this.switchService = new hap.Service.Switch(this.name);
		this.switchService.getCharacteristic(hap.Characteristic.On)
			.on(CharacteristicEventTypes.GET, (next: CharacteristicGetCallback) => {
				this._makeRequest(STATUS_URL, next);
			})
			.on(CharacteristicEventTypes.SET, (value: CharacteristicValue, next: CharacteristicSetCallback) => {
				let queryString: any = {};
				let switchState = value as boolean;

				if (switchState) {
					queryString[ENABLE_URL] = 1;
				} else {
					queryString[DISABLE_URL] = this.time;
				}

				queryString[AUTH_URL] = this.auth;

				this._makeRequest(stringify(queryString), next);
			});
	}

	getServices(): Service[] {
		return [
			this.informationService,
			this.switchService,
		];
	}

	private _responseHandler(response: http.IncomingMessage, next: Function) {
		let body = "";

		response.on("data", (data) => {
			body += data
		});

		response.on("end", () => {
			if (this.logLevel >= 2) {
				this.log.info(body);
			}

			try {
				let jsonBody = JSON.parse(body);

				if (jsonBody && jsonBody.status) {
					next(undefined, jsonBody.status == "enabled");
				} else {
					next({});
				}
			} catch (e) {
				if (this.logLevel >= 1) {
					this.log.error(e);
				}

				next(e);
			}
		});
	}

	private _makeRequest(path: string, next: Function) {
		let request = http.get({
			host: this.host,
			port: this.port,
			path: `${this.baseDirectory}${BASE_URL}?${path}`
		}, (response) => this._responseHandler(response, next));

		request.on("error", (error) => {
			if (this.logLevel >= 1) {
				this.log.error(error.toString());
			}
		})
	}
}
