import {
	AccessoryConfig
} from "homebridge";

export enum LogLevel {
	DISABLED = 0,
	ERROR = 1,
	INFO = 2,
};

export interface PiHoleAccessoryConfig extends AccessoryConfig {
	manufacturer ?: string;
	model ?: string;
	"serial-number" ?: string;
	auth ?: string;
	ssl ?: boolean;
	host ?: string;
	baseDirectory ?: string;
	time ?: number;
	port ?: number;
	logLevel ?: LogLevel;

};

export type PiHoleRequest<Endpoint extends string> = {
	[key in Endpoint]: any; // usually a "1" or current time, argument does not matter
};

export type PiHoleAuthenticatedRequest<Endpoint extends string> = PiHoleRequest<Endpoint> & {
	auth: string
};

// from https://discourse.pi-hole.net/t/pi-hole-api/1863
export type PiHoleStatusRequest = PiHoleRequest<"status">;
export type PiHoleEnableRequest = PiHoleAuthenticatedRequest<"enable">;
export type PiHoleDisableRequest = PiHoleAuthenticatedRequest<"disable">;

export type PiHoleStatusResponse = {
	status: "disabled" | "enabled";
};
