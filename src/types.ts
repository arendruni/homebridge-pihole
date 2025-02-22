import { AccessoryConfig } from "homebridge";

export enum LogLevel {
	DISABLED = 0,
	ERROR = 1,
	INFO = 2,
}

export type PiholeConfig = {
	"auth"?: string;
	"baseDirectory"?: string;
	"host"?: string;
	"logLevel"?: LogLevel;
	"manufacturer"?: string;
	"model"?: string;
	"port"?: number;
	"rejectUnauthorized"?: boolean;
	"reversed"?: boolean;
	"serial-number"?: string;
	"ssl"?: boolean;
	"time"?: number;
};

export type PiHoleAccessoryConfig = PiholeConfig & AccessoryConfig;

// eslint-disable-next-line @typescript-eslint/no-empty-interface,, @typescript-eslint/no-empty-object-type
export interface PiHoleRequest {}

export interface PiHoleAuthenticatedRequest extends PiHoleRequest {
	auth: string;
}

// from https://discourse.pi-hole.net/t/pi-hole-api/1863
export interface PiHoleStatusRequest extends PiHoleAuthenticatedRequest {
	status: number;
}
export interface PiHoleEnableRequest extends PiHoleAuthenticatedRequest {
	enable: number;
}
export interface PiHoleDisableRequest extends PiHoleAuthenticatedRequest {
	disable: number; // number of seconds
}

export interface PiHoleStatusResponse {
	status: "disabled" | "enabled";
}
