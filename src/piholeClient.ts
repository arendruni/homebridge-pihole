import { Logger } from "homebridge";
import { Agent, Dispatcher, request } from "undici";
import { LogLevel } from "./types";

interface PiholeClientOptions {
	auth?: string;
	path?: string;
	baseUrl: string;
	rejectUnauthorized: boolean;
	logLevel: LogLevel;
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

	private async makeRequest<Res>(
		method: "GET" | "POST",
		path: `/${string}`,
		body?: unknown,
		throwOnError = true,
	): Promise<PiholeResponse<Res>> {
		const url = `${this.baseUrl}${path}`;

		if (this.options.logLevel >= LogLevel.INFO) {
			this.logger.info("Request", {
				method,
				body,
				url,
			});
		}

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

		if (this.options.logLevel >= LogLevel.INFO) {
			this.logger.info("Response", {
				method,
				body,
				responseBody,
				response: { ...response, body: {} },
				url,
			});
		}

		if (typeof responseBody !== "object" || responseBody === null) {
			throw new Error("Invalid response", { cause: JSON.stringify({ response, responseBody }) });
		}

		if (throwOnError && "error" in responseBody) {
			throw new Error("Api Error", { cause: JSON.stringify({ response, responseBody }) });
		}

		return { body: responseBody as Res, response };
	}

	private async setupSession() {
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
}
