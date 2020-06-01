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
import { LogLevel, PiHoleAccessoryConfig, PiHoleRequest, PiHoleStatusRequest, PiHoleEnableRequest, PiHoleDisableRequest, PiHoleStatusResponse } from "./types";

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

	private readonly auth: string;
	private readonly ssl: boolean;
	private readonly host: string;
	private readonly baseDirectory: string;
	private readonly time: number;
	private readonly port: number;
	private readonly logLevel: LogLevel;

	private readonly baseUrl: string;

	private readonly switchService: Service;
	private readonly informationService: Service;

	constructor(log: Logging, config: AccessoryConfig, api: API) {
		const piHoleConfig = config as PiHoleAccessoryConfig;
		this.log = log;
		this.name = config.name;

		this.manufacturer = piHoleConfig.manufacturer || "Raspberry Pi";
		this.model = piHoleConfig.model || "Pi-hole";
		this.serial = piHoleConfig["serial-number"] || "123-456-789";

		this.auth = piHoleConfig.auth || "";
		this.host = piHoleConfig.host || "localhost";
		this.baseDirectory = piHoleConfig.baseDirectory || "/admin/";
		this.time = piHoleConfig.time || 0;
		this.port = piHoleConfig.port || 80;
		this.ssl = piHoleConfig.ssl || this.port == 443; // for BC
		this.logLevel = piHoleConfig.logLevel || 1;

		this.baseUrl = "http" + (this.ssl ? "s" : "") + "://" + this.host + ":" + this.port + this.baseDirectory;

		this.informationService = new hap.Service.AccessoryInformation()
			.setCharacteristic(hap.Characteristic.Manufacturer, this.manufacturer)
			.setCharacteristic(hap.Characteristic.Model, this.model)
			.setCharacteristic(hap.Characteristic.SerialNumber, this.serial);

		this.switchService = new hap.Service.Switch(this.name);
		this.switchService.getCharacteristic(hap.Characteristic.On)
			.on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
				this._makeRequest(STATUS_URL, callback);
			})
			.on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
				let queryString: any = {};
				let switchState = value as boolean;

				if (switchState) {
					queryString[ENABLE_URL] = 1;
				} else {
					queryString[DISABLE_URL] = this.time;
				}

				queryString[AUTH_URL] = this.auth;

				this._makeRequest(stringify(queryString), callback);
			});
	}

	getServices(): Service[] {
		return [
			this.informationService,
			this.switchService,
		];
	}

	private _responseHandler(response: http.IncomingMessage, callback: Function) {
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
					callback(undefined, jsonBody.status == "enabled");
				} else {
					callback({});
				}
			} catch (e) {
				if (this.logLevel >= 1) {
					this.log.error(e);
				}

				callback(e);
			}
		});
	}

	private _makeRequest(path: string, callback: Function) {
		let request = http.get({
			host: this.host,
			port: this.port,
			path: `${this.baseDirectory}${BASE_URL}?${path}`
		}, (response) => this._responseHandler(response, callback));

		request.on("error", (error) => {
			if (this.logLevel >= 1) {
				this.log.error(error.toString());
			}
		})
	}
}
