import { readFile, writeFile } from "fs/promises";
import { Logger } from "homebridge";
import { join } from "path";
import { Agent, Dispatcher, request } from "undici";
import { LogLevel } from "./types";

interface PiholeClientOptions {
	auth?: string;
	path?: string;
	baseUrl: string;
	serialNumber: string;
	rejectUnauthorized: boolean;
	logLevel: LogLevel;
	storagePath?: string;
}

export type BlockingResponse = {
	timer?: number | null;
	blocking: "enabled" | "disabled" | "failed" | "unknown";
	took?: number;
};

export type PiholeResponse<T> = {
	body: T;
	response: Dispatcher.ResponseData;
};

type Session = {
	valid: boolean;
	sid: string | null;
	validity: number;
	totp: boolean;
	csrf: string | null;
	message: string | null;
};

type SessionResponse = {
	session: Session;
	took?: number;
};

export class PiholeClient {
	private dispatcher?: Dispatcher;
	private session?: Session;

	private readonly baseUrl: string;

	constructor(
		private readonly options: PiholeClientOptions,
		readonly logger: Logger,
	) {
		const url = new URL(this.options.path ?? "/api", this.options.baseUrl);
		this.baseUrl = url.toString();

		if (this.baseUrl.endsWith("/")) {
			this.baseUrl = this.baseUrl.slice(0, -1);
		}

		if (url.protocol === "https:" && options.rejectUnauthorized === false) {
			this.dispatcher = new Agent({ connect: { rejectUnauthorized: options.rejectUnauthorized } });
		}
	}

	private static getFilePath(path: string, serialNumber: string): string {
		return join(path, `pihole-session-${serialNumber}.json`);
	}

	private async makeRequest<Res>(
		method: "GET" | "POST",
		path: `/${string}`,
		body?: unknown,
		throwOnError = true,
	): Promise<PiholeResponse<Res>> {
		const url = `${this.baseUrl}${path}`;

		this.logInfo("Request", {
			method,
			body,
			url,
		});

		const response = await request(url, {
			method,
			dispatcher: this.dispatcher,
			body: body ? JSON.stringify(body) : undefined,
			headers: {
				"Content-Type": "application/json",
				"User-Agent": "homebridge-pihole",
				...(this.session?.sid ? { "X-FTL-SID": this.session.sid } : {}),
			},
		});

		const responseBody = await response.body.json();

		this.logInfo("Response", {
			method,
			body,
			responseBody,
			response: { ...response, body: {} },
			url,
		});

		if (typeof responseBody !== "object" || responseBody === null) {
			throw new Error("Invalid response", { cause: JSON.stringify({ response, responseBody }) });
		}

		if (throwOnError && "error" in responseBody) {
			throw new Error("Api Error", { cause: JSON.stringify({ response, responseBody }) });
		}

		return { body: responseBody as Res, response };
	}

	private async loadSession() {
		if (!(this.options.storagePath && this.options.serialNumber)) {
			return;
		}

		const filePath = PiholeClient.getFilePath(this.options.storagePath, this.options.serialNumber);

		try {
			const data = await readFile(filePath, "utf-8");
			const session = JSON.parse(data);

			if (session && session.sid) {
				this.session = session;
				this.logInfo("Session loaded from disk");
			}
		} catch (e) {
			if (typeof e === "object" && e !== null && "code" in e && e.code === "ENOENT") {
				this.logInfo("Session not found on disk");
			} else {
				this.logError("Failed to load session", e);
			}
		}
	}

	private async saveSession(session: Session) {
		if (!(this.options.storagePath && this.options.serialNumber)) {
			return;
		}

		const filePath = PiholeClient.getFilePath(this.options.storagePath, this.options.serialNumber);

		try {
			await writeFile(filePath, JSON.stringify(session), "utf-8");

			this.logInfo("Session saved to disk");
		} catch (e) {
			this.logError("Failed to save session", e);
		}
	}

	private async setupSession() {
		if (!this.session) {
			await this.loadSession();
		}

		const { body } = await this.makeRequest<SessionResponse>("GET", "/auth", undefined);

		if (!body.session.valid) {
			if (!this.options.auth) {
				throw new Error("Auth is required");
			}

			const { body, response } = await this.makeRequest<SessionResponse>("POST", "/auth", {
				password: this.options.auth,
			});

			if (!body.session.valid) {
				throw new Error("Auth not valid", { cause: JSON.stringify({ body, response }) });
			}

			this.session = body.session;
			await this.saveSession(body.session);
		} else {
			this.session = body.session;
		}
	}

	async setBlocking(blocking: boolean, timer?: number) {
		await this.setupSession();

		return this.makeRequest<BlockingResponse>("POST", "/dns/blocking", { blocking, timer });
	}

	async getBlocking() {
		await this.setupSession();

		return this.makeRequest<BlockingResponse>("GET", "/dns/blocking");
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	logError(message: string, ...parameters: any[]) {
		if (this.options.logLevel >= LogLevel.ERROR) {
			this.logger.error(message, ...parameters);
		}
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	logInfo(message: string, ...parameters: any[]) {
		if (this.options.logLevel >= LogLevel.INFO) {
			this.logger.info(message, ...parameters);
		}
	}
}
