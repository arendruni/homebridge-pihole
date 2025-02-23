import { AccessoryPlugin, API, HAP, Logging, Service } from "homebridge";
import { BlockingResponse, PiholeClient, PiholeResponse } from "./piholeClient";
import { LogLevel, PiHoleAccessoryConfig } from "./types";

export default (api: API): void => {
	api.registerAccessory("homebridge-pihole", "Pihole", PiholeSwitch);
};

const DEFAULT_CONFIG = {
	"manufacturer": "Raspberry Pi",
	"model": "Pi-hole",
	"serial-number": "123-456-789",
	"baseDirectory": "/api",
	"host": "localhost",
	"logLevel": LogLevel.INFO,
	"rejectUnauthorized": true,
	"reversed": false,
} as const;

class PiholeSwitch implements AccessoryPlugin {
	private readonly logLevel: LogLevel;

	private readonly informationService: Service;
	private readonly switchService: Service;

	private readonly piholeClient: PiholeClient;

	private readonly hap: HAP;

	constructor(
		private log: Logging,
		_config: PiHoleAccessoryConfig,
		api: API,
	) {
		({ hap: this.hap } = api);
		const { auth, reversed, ...config } = { ...DEFAULT_CONFIG, ..._config };

		this.logLevel = config.logLevel;

		this.piholeClient = new PiholeClient(
			{
				auth,
				host: config.host,
				https: config.ssl,
				path: config.baseDirectory,
				port: config.port,
				rejectUnauthorized: config.rejectUnauthorized,
				logLevel: config.logLevel,
			},
			log,
		);

		this.informationService = new this.hap.Service.AccessoryInformation()
			.setCharacteristic(this.hap.Characteristic.Manufacturer, config.manufacturer)
			.setCharacteristic(this.hap.Characteristic.Model, config.model)
			.setCharacteristic(this.hap.Characteristic.SerialNumber, config["serial-number"]);

		this.switchService = new this.hap.Service.Switch(config.name);
		this.switchService
			.getCharacteristic(this.hap.Characteristic.On)
			.onGet(async () => {
				try {
					const response = await this.piholeClient.getBlocking();

					return this.postRequest(response, reversed);
				} catch (e) {
					if (this.logLevel >= LogLevel.ERROR) {
						this.log.error("Error", e);
					}

					throw e;
				}
			})
			.onSet(async (value) => {
				const newValue = value as boolean;
				const switchState = reversed ? !newValue : newValue;

				try {
					const response = await this.piholeClient.setBlocking(
						switchState,
						switchState === false ? config.time : undefined,
					);

					this.postRequest(response, reversed);
				} catch (e) {
					if (this.logLevel >= LogLevel.ERROR) {
						this.log.error("Error", e);
					}

					throw e;
				}
			});
	}

	getServices(): Service[] {
		return [this.informationService, this.switchService];
	}

	private postRequest(response: PiholeResponse<BlockingResponse>, reversed: boolean) {
		const {
			body: { blocking },
			response: { statusCode },
		} = response;

		if (statusCode >= 400) {
			throw new Error("Api Error", { cause: response });
		}

		if (this.logLevel >= LogLevel.INFO) {
			this.log.info(JSON.stringify({ ...response, response: { ...response.response, body: {} } }));
		}

		if (blocking === "disabled" || blocking === "enabled") {
			return reversed ? blocking === "disabled" : blocking === "enabled";
		} else {
			throw new Error("Invalid status", { cause: { blocking } });
		}
	}
}
