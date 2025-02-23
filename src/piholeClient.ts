import { Logger } from "homebridge";
import { Agent, Dispatcher, request } from "undici";
import { LogLevel } from "./types";

interface PiholeClientOptions {
	auth?: string;
	path?: string;
	host: string;
	port?: number;
	rejectUnauthorized: boolean;
	https?: boolean;
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

	private get baseUrl(): string {
		return `${this.options.https ? "https" : "http"}://${this.options.host}:${this.options.port ?? (this.options.https ? 443 : 80)}${this.options.path ?? "/api"}`;
	}

	constructor(
		private readonly options: PiholeClientOptions,
		readonly logger: Logger,
	) {
		if (options.https === true && options.rejectUnauthorized === false) {
			this.dispatcher = new Agent({ connect: { rejectUnauthorized: options.rejectUnauthorized } });
		}
	}

	private async makeRequest<Res>(
		method: "GET" | "POST",
		path: `/${string}`,
		body?: unknown,
	): Promise<PiholeResponse<Res>> {
		const url = this.baseUrl.concat(path);

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
				"User-Agent": "PiholeClient",
				...(this.session?.sid ? { "X-FTL-SID": this.session.sid } : {}),
			},
		});

		const responseBody = (await response.body.json()) as Res;

		if (this.options.logLevel >= LogLevel.INFO) {
			this.logger.info("Response", {
				method,
				body,
				responseBody,
				response: { ...response, body: {} },
				url,
			});
		}

		return { body: responseBody, response };
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
