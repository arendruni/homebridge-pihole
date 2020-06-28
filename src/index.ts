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
	Service,
} from "homebridge";

import axios, { AxiosResponse } from "axios";
import {
	LogLevel,
	PiHoleAccessoryConfig,
	PiHoleRequest,
	PiHoleStatusRequest,
	PiHoleEnableRequest,
	PiHoleDisableRequest,
	PiHoleStatusResponse,
} from "./types";

let hap: HAP;

export = (api: API) => {
	hap = api.hap;
	api.registerAccessory("homebridge-pihole", "Pihole", PiholeSwitch);
};

const BASE_API_URL = "api.php";

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
	private readonly reverseStatus: boolean;
	private readonly logLevel: LogLevel;

	private readonly baseUrl: string;

	private readonly switchService: Service;
	private readonly informationService: Service;

	constructor(log: Logging, config: AccessoryConfig) {
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
		this.reverseStatus = piHoleConfig.reverseStatus || false;
		this.logLevel = piHoleConfig.logLevel || 1;

		this.baseUrl =
			"http" + (this.ssl ? "s" : "") + "://" + this.host + ":" + this.port + this.baseDirectory;

		this.informationService = new hap.Service.AccessoryInformation()
			.setCharacteristic(hap.Characteristic.Manufacturer, this.manufacturer)
			.setCharacteristic(hap.Characteristic.Model, this.model)
			.setCharacteristic(hap.Characteristic.SerialNumber, this.serial);

		this.switchService = new hap.Service.Switch(this.name);
		this.switchService
			.getCharacteristic(hap.Characteristic.On)
			.on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {
				try {
					const response = await this._makeRequest<PiHoleStatusRequest, PiHoleStatusResponse>({
						status: 1,
					});

					callback(undefined, response.status === "enabled");
				} catch (e) {
					callback(e);
				}
			})
			.on(
				CharacteristicEventTypes.SET,
				async (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
					let switchState = value as boolean;

					if (this.reverseStatus) {
						switchState = !switchState;
					}

					try {
						let response: PiHoleStatusResponse;

						if (switchState) {
							response = await this._makeRequest<PiHoleEnableRequest, PiHoleStatusResponse>({
								enable: 1,
								auth: this.auth,
							});
						} else {
							response = await this._makeRequest<PiHoleDisableRequest, PiHoleStatusResponse>({
								disable: this.time,
								auth: this.auth,
							});
						}

						callback(undefined, response.status === "enabled");
					} catch (e) {
						callback(e);
					}
				},
			);
	}

	getServices(): Service[] {
		return [this.informationService, this.switchService];
	}

	private async _makeRequest<RequestType extends PiHoleRequest, ResponseType>(
		params: RequestType,
	): Promise<ResponseType> {
		try {
			const response: AxiosResponse<ResponseType> = await axios({
				method: "GET",
				url: BASE_API_URL,
				params: params,
				baseURL: this.baseUrl,
				responseType: "json",
			});

			if (this.logLevel >= LogLevel.INFO) {
				this.log.info(
					JSON.stringify({
						data: response.data,
						status: response.status,
						statusText: response.statusText,
						headers: response.headers,
						request: response.config,
					}),
				);
			}

			return response.data;
		} catch (e) {
			if (this.logLevel >= LogLevel.ERROR) {
				this.log.error(e);
			}

			throw e; // let the caller be responsible for callback
		}
	}
}
