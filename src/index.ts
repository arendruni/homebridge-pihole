import axios, { AxiosResponse } from "axios";
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
import { Agent } from "https";
import {
	LogLevel,
	PiHoleAccessoryConfig,
	PiHoleDisableRequest,
	PiHoleEnableRequest,
	PiHoleRequest,
	PiHoleStatusRequest,
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
	private readonly manufacturer: string;
	private readonly model: string;
	private readonly name: string;
	private readonly serial: string;

	private readonly auth: string;
	private readonly baseDirectory: string;
	private readonly host: string;
	private readonly logLevel: LogLevel;
	private readonly port: number;
	private readonly reversed: boolean;
	private readonly ssl: boolean;
	private readonly rejectUnauthorized: boolean;
	private readonly time: number;

	private readonly baseUrl: string;

	private readonly informationService: Service;
	private readonly switchService: Service;

	constructor(log: Logging, config: AccessoryConfig) {
		const piHoleConfig = config as PiHoleAccessoryConfig;
		this.log = log;
		this.name = config.name;

		this.manufacturer = piHoleConfig.manufacturer || "Raspberry Pi";
		this.model = piHoleConfig.model || "Pi-hole";
		this.serial = piHoleConfig["serial-number"] || "123-456-789";

		this.auth = piHoleConfig.auth || "";
		this.baseDirectory = piHoleConfig.baseDirectory || "/admin/";
		this.host = piHoleConfig.host || "localhost";
		this.logLevel = piHoleConfig.logLevel || 1;
		this.port = piHoleConfig.port || 80;
		this.rejectUnauthorized = piHoleConfig.rejectUnauthorized ?? true;
		this.reversed = piHoleConfig.reversed || false;
		this.ssl = piHoleConfig.ssl || this.port == 443; // for BC
		this.time = piHoleConfig.time || 0;

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
					const { value: oldValue } = this.switchService.getCharacteristic(hap.Characteristic.On);

					callback(undefined, oldValue);

					const { status } = await this._makeRequest<PiHoleStatusRequest, PiHoleStatusResponse>({
						status: 1,
					});

					this.switchService
						.getCharacteristic(hap.Characteristic.On)
						.updateValue(this.reversed ? status === "disabled" : status === "enabled");
				} catch (e) {
					if (this.logLevel >= LogLevel.ERROR) {
						this.log.error(e);
					}
				}
			})
			.on(
				CharacteristicEventTypes.SET,
				async (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
					const newValue = value as boolean;
					const switchState = this.reversed ? !newValue : newValue;

					try {
						let response: PiHoleStatusResponse;

						callback(undefined);

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

						this.switchService
							.getCharacteristic(hap.Characteristic.On)
							.updateValue(
								this.reversed ? response.status === "disabled" : response.status === "enabled",
							);
					} catch (e) {
						if (this.logLevel >= LogLevel.ERROR) {
							this.log.error(e);
						}
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
		const httpsAgent = new Agent({
			rejectUnauthorized: this.rejectUnauthorized,
		});

		const response: AxiosResponse<ResponseType> = await axios({
			method: "GET",
			url: BASE_API_URL,
			params: params,
			baseURL: this.baseUrl,
			responseType: "json",
			httpsAgent: httpsAgent,
		});

		if (this.logLevel >= LogLevel.INFO) {
			this.log.info(
				JSON.stringify({
					data: response.data,
					status: response.status,
					statusText: response.statusText,
					headers: response.headers,
					request: {
						method: "GET",
						url: BASE_API_URL,
						params: params,
						baseURL: this.baseUrl,
						responseType: "json",
					},
				}),
			);
		}

		return response.data;
	}
}
