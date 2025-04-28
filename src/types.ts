import type { AccessoryConfig } from "homebridge";

export enum LogLevel {
	DISABLED = 0,
	ERROR = 1,
	INFO = 2,
}

export type PiholeConfig = {
	"auth"?: string;
	"path"?: string;
	"baseUrl"?: string;
	"rejectUnauthorized"?: boolean;
	"manufacturer"?: string;
	"model"?: string;
	"serial-number"?: string;
	"reversed"?: boolean;
	"time"?: number;
	"logLevel"?: LogLevel;
};

export type PiHoleAccessoryConfig = PiholeConfig & AccessoryConfig;
