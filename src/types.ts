import type { AccessoryConfig } from "homebridge";

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
