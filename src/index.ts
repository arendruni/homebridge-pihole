import {
	AccessoryPlugin,
	API,
	CharacteristicEventTypes,
	CharacteristicGetCallback,
	CharacteristicSetCallback,
	CharacteristicValue,
	Logging,
	Service,
} from "homebridge";
import {
	LogLevel,
	PiHoleAccessoryConfig,
	PiholeConfig,
	PiHoleDisableRequest,
	PiHoleEnableRequest,
	PiHoleRequest,
	PiHoleStatusRequest,
	PiHoleStatusResponse,
} from "./types";
import axios, { AxiosResponse } from "axios";
import { Agent } from "https";

export default (api: API): void => {
	api.registerAccessory("homebridge-pihole", "Pihole", PiholeSwitch);
};

const BASE_API_URL = "api.php";

const DEFAULT_CONFIG: Required<PiholeConfig> = {
	"manufacturer": "Raspberry Pi",
	"model": "Pi-hole",
	"serial-number": "123-456-789",
	"auth": "",
	"baseDirectory": "/admin/",
	"host": "localhost",
	"logLevel": LogLevel.INFO,
	"port": 80,
	"rejectUnauthorized": true,
	"reversed": false,
	"ssl": false,
	"time": 0,
};

class PiholeSwitch implements AccessoryPlugin {
	private readonly logLevel: LogLevel;

	private readonly rejectUnauthorized: boolean;
	private readonly baseUrl: string;

	private readonly informationService: Service;
	private readonly switchService: Service;

	constructor(
		private log: Logging,
		_config: PiHoleAccessoryConfig,
		api: API,
	) {
		const { hap } = api;
		const { auth, reversed, ...config } = { ...DEFAULT_CONFIG, ..._config };

		this.logLevel = config.logLevel;
		this.rejectUnauthorized = config.rejectUnauthorized;

		this.baseUrl = `http${config.ssl ? "s" : ""}://${config.host}:${config.port}${
			config.baseDirectory
		}`;

		this.informationService = new hap.Service.AccessoryInformation()
			.setCharacteristic(hap.Characteristic.Manufacturer, config.manufacturer)
			.setCharacteristic(hap.Characteristic.Model, config.model)
			.setCharacteristic(hap.Characteristic.SerialNumber, config["serial-number"]);

		this.switchService = new hap.Service.Switch(config.name);
		this.switchService
			.getCharacteristic(hap.Characteristic.On)
			.on(CharacteristicEventTypes.GET, async (callback: CharacteristicGetCallback) => {
				try {
					const { value: oldValue } = this.switchService.getCharacteristic(hap.Characteristic.On);

					callback(undefined, oldValue);

					const { status } = await this._makeRequest<PiHoleStatusRequest, PiHoleStatusResponse>({
						status: 1,
						auth,
					});

					this.switchService
						.getCharacteristic(hap.Characteristic.On)
						.updateValue(reversed ? status === "disabled" : status === "enabled");
				} catch (e) {
					if (this.logLevel >= LogLevel.ERROR) {
						this.log.error("Error", e);
					}
				}
			})
			.on(
				CharacteristicEventTypes.SET,
				async (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
					const newValue = value as boolean;
					const switchState = reversed ? !newValue : newValue;

					try {
						let response: PiHoleStatusResponse;

						callback(undefined);

						if (switchState) {
							response = await this._makeRequest<PiHoleEnableRequest, PiHoleStatusResponse>({
								enable: 1,
								auth,
							});
						} else {
							response = await this._makeRequest<PiHoleDisableRequest, PiHoleStatusResponse>({
								disable: config.time,
								auth,
							});
						}

						this.switchService
							.getCharacteristic(hap.Characteristic.On)
							.updateValue(
								reversed ? response.status === "disabled" : response.status === "enabled",
							);
					} catch (e) {
						if (this.logLevel >= LogLevel.ERROR) {
							this.log.error("Error", e);
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
