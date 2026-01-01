import { MockAgent, setGlobalDispatcher } from "undici";
import { PiholeClient } from "./piholeClient";
import { LogLevel } from "./types";
import { Logger } from "homebridge";
import * as fs from "fs/promises";

// Mock fs/promises
jest.mock("fs/promises");

const mockLogger = {
	info: jest.fn(),
	error: jest.fn(),
	warn: jest.fn(),
	debug: jest.fn(),
	log: jest.fn(),
} as unknown as Logger;

// Helper to create a standard ENOENT error
const createEnoentError = () => {
	const error = new Error("ENOENT");
	Object.assign(error, { code: "ENOENT" });
	return error;
};

// Helper to mock valid auth session
const mockValidAuthSession = (mockPool: ReturnType<MockAgent["get"]>, sid = "test-sid") => {
	mockPool
		.intercept({ path: "/api/auth", method: "GET" })
		.reply(200, { session: { valid: true, sid } });
};

// Helper to mock invalid auth session followed by successful login
const mockAuthLoginFlow = (
	mockPool: ReturnType<MockAgent["get"]>,
	password: string,
	sid = "new-sid",
) => {
	mockPool
		.intercept({ path: "/api/auth", method: "GET" })
		.reply(200, { session: { valid: false } });
	mockPool
		.intercept({ path: "/api/auth", method: "POST", body: JSON.stringify({ password }) })
		.reply(200, { session: { valid: true, sid, validity: 300 } });
};

// Helper to mock blocking endpoint
const mockBlockingResponse = (
	mockPool: ReturnType<MockAgent["get"]>,
	method: "GET" | "POST",
	response: object,
) => {
	mockPool.intercept({ path: "/api/dns/blocking", method }).reply(200, response);
};

describe("PiholeClient", () => {
	let mockAgent: MockAgent;
	const baseUrl = "http://localhost";
	const auth = "test-auth-token";

	beforeEach(() => {
		mockAgent = new MockAgent();
		mockAgent.disableNetConnect();
		setGlobalDispatcher(mockAgent);
		jest.clearAllMocks();
	});

	it("should authenticate and get blocking status", async () => {
		const client = new PiholeClient(
			{ baseUrl, auth, rejectUnauthorized: true, logLevel: LogLevel.INFO },
			mockLogger,
		);

		const mockPool = mockAgent.get(baseUrl);
		mockAuthLoginFlow(mockPool, auth, "test-sid");
		mockBlockingResponse(mockPool, "GET", { blocking: "enabled", timer: null });

		const response = await client.getBlocking();

		expect(response.body.blocking).toBe("enabled");
		expect(mockLogger.info).toHaveBeenCalledWith(
			expect.stringContaining("Request"),
			expect.anything(),
		);
	});

	it("should persist session to disk if configured", async () => {
		const sessionPath = "/tmp/pihole-session.json";
		const client = new PiholeClient(
			{ baseUrl, auth, rejectUnauthorized: true, logLevel: LogLevel.INFO, sessionPath },
			mockLogger,
		);

		const mockPool = mockAgent.get(baseUrl);
		(fs.readFile as jest.Mock).mockRejectedValue(createEnoentError());
		mockAuthLoginFlow(mockPool, auth, "new-sid");
		mockBlockingResponse(mockPool, "GET", { blocking: "disabled" });

		await client.getBlocking();

		expect(fs.writeFile).toHaveBeenCalledWith(
			sessionPath,
			expect.stringContaining("new-sid"),
			"utf-8",
		);
	});

	it("should load session from disk if available", async () => {
		const sessionPath = "/tmp/pihole-session.json";
		const savedSession = { valid: true, sid: "saved-sid", validity: 300 };

		const client = new PiholeClient(
			{ baseUrl, auth, rejectUnauthorized: true, logLevel: LogLevel.INFO, sessionPath },
			mockLogger,
		);

		const mockPool = mockAgent.get(baseUrl);
		(fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(savedSession));
		mockValidAuthSession(mockPool, "saved-sid");
		mockBlockingResponse(mockPool, "GET", { blocking: "enabled" });

		await client.getBlocking();

		expect(fs.readFile).toHaveBeenCalledWith(sessionPath, "utf-8");
		expect(mockLogger.info).toHaveBeenCalledWith(
			expect.stringContaining("Session loaded from disk"),
		);
	});

	it("should handle API errors correctly", async () => {
		const client = new PiholeClient(
			{ baseUrl, auth, rejectUnauthorized: true, logLevel: LogLevel.ERROR },
			mockLogger,
		);

		const mockPool = mockAgent.get(baseUrl);
		mockValidAuthSession(mockPool);
		mockPool
			.intercept({ path: "/api/dns/blocking", method: "GET" })
			.reply(200, { error: "Some API Error" });

		await expect(client.getBlocking()).rejects.toThrow("Api Error");
	});

	it("should handle invalid JSON response (null)", async () => {
		const client = new PiholeClient(
			{ baseUrl, auth, rejectUnauthorized: true, logLevel: LogLevel.ERROR },
			mockLogger,
		);

		const mockPool = mockAgent.get(baseUrl);
		mockValidAuthSession(mockPool);
		mockPool
			.intercept({ path: "/api/dns/blocking", method: "GET" })
			.reply(200, null as unknown as object);

		await expect(client.getBlocking()).rejects.toThrow("Invalid response");
	});

	it("should throw if auth is required but not provided", async () => {
		const client = new PiholeClient(
			{
				baseUrl,
				rejectUnauthorized: true,
				logLevel: LogLevel.INFO,
				// No auth provided
			},
			mockLogger,
		);

		const mockPool = mockAgent.get(baseUrl);

		// Mock Auth Challenge returning invalid session
		mockPool
			.intercept({ path: "/api/auth", method: "GET" })
			.reply(200, { session: { valid: false } });

		await expect(client.getBlocking()).rejects.toThrow("Auth is required");
	});

	it("should throw if auth fails", async () => {
		const client = new PiholeClient(
			{
				baseUrl,
				auth: "wrong-password",
				rejectUnauthorized: true,
				logLevel: LogLevel.INFO,
			},
			mockLogger,
		);

		const mockPool = mockAgent.get(baseUrl);

		// Mock Auth Challenge
		mockPool
			.intercept({ path: "/api/auth", method: "GET" })
			.reply(200, { session: { valid: false } });

		// Mock Auth Login failing
		mockPool
			.intercept({ path: "/api/auth", method: "POST" })
			.reply(200, { session: { valid: false } });

		await expect(client.getBlocking()).rejects.toThrow("Auth not valid");
	});

	it("should handle file system errors during session load", async () => {
		const sessionPath = "/tmp/pihole-session.json";
		const client = new PiholeClient(
			{
				baseUrl,
				auth,
				rejectUnauthorized: true,
				logLevel: LogLevel.ERROR,
				sessionPath,
			},
			mockLogger,
		);

		// Mock fs.readFile to fail with permission error
		(fs.readFile as jest.Mock).mockRejectedValue(new Error("EACCES"));

		const mockPool = mockAgent.get(baseUrl);
		// Should proceed to normal auth flow
		mockPool
			.intercept({ path: "/api/auth", method: "GET" })
			.reply(200, { session: { valid: true, sid: "sid" } });

		mockPool
			.intercept({ path: "/api/dns/blocking", method: "GET" })
			.reply(200, { blocking: "enabled" });

		await client.getBlocking();

		expect(mockLogger.error).toHaveBeenCalledWith(
			expect.stringContaining("Failed to load session"),
			expect.any(Error),
		);
	});

	it("should handle file system errors during session save", async () => {
		const sessionPath = "/tmp/pihole-session.json";
		const client = new PiholeClient(
			{
				baseUrl,
				auth,
				rejectUnauthorized: true,
				logLevel: LogLevel.ERROR,
				sessionPath,
			},
			mockLogger,
		);

		const mockPool = mockAgent.get(baseUrl);

		// Mock fs.readFile to fail (no session)
		const enoentError = new Error("ENOENT");
		Object.assign(enoentError, { code: "ENOENT" });
		(fs.readFile as jest.Mock).mockRejectedValue(enoentError);

		// Mock Auth Challenge
		mockPool
			.intercept({ path: "/api/auth", method: "GET" })
			.reply(200, { session: { valid: false } });

		// Mock Auth Login
		mockPool
			.intercept({ path: "/api/auth", method: "POST" })
			.reply(200, { session: { valid: true, sid: "new-sid" } });

		// Mock Get Blocking
		mockPool
			.intercept({ path: "/api/dns/blocking", method: "GET" })
			.reply(200, { blocking: "enabled" });

		// Mock fs.writeFile to fail
		(fs.writeFile as jest.Mock).mockRejectedValue(new Error("EACCES"));

		await client.getBlocking();

		expect(mockLogger.error).toHaveBeenCalledWith(
			expect.stringContaining("Failed to save session"),
			expect.any(Error),
		);
	});

	it("should set blocking status", async () => {
		const client = new PiholeClient(
			{
				baseUrl,
				auth,
				rejectUnauthorized: true,
				logLevel: LogLevel.INFO,
			},
			mockLogger,
		);

		const mockPool = mockAgent.get(baseUrl);

		// Mock Auth Challenge
		mockPool
			.intercept({ path: "/api/auth", method: "GET" })
			.reply(200, { session: { valid: true, sid: "sid" } });

		// Mock Set Blocking
		mockPool
			.intercept({
				path: "/api/dns/blocking",
				method: "POST",
				body: JSON.stringify({ blocking: false, timer: 120 }),
			})
			.reply(200, { blocking: "disabled", timer: 120 });

		const response = await client.setBlocking(false, 120);

		expect(response.body.blocking).toBe("disabled");
		expect(response.body.timer).toBe(120);
	});

	it("should handle baseUrl with trailing slash", async () => {
		const client = new PiholeClient(
			{
				baseUrl: "http://localhost/",
				auth,
				rejectUnauthorized: true,
				logLevel: LogLevel.INFO,
			},
			mockLogger,
		);

		const mockPool = mockAgent.get("http://localhost");

		mockPool
			.intercept({ path: "/api/auth", method: "GET" })
			.reply(200, { session: { valid: true, sid: "sid" } });

		mockPool
			.intercept({ path: "/api/dns/blocking", method: "GET" })
			.reply(200, { blocking: "enabled" });

		await client.getBlocking();
	});

	it("should configure dispatcher for https with rejectUnauthorized false", () => {
		const client = new PiholeClient(
			{
				baseUrl: "https://localhost",
				auth,
				rejectUnauthorized: false,
				logLevel: LogLevel.INFO,
			},
			mockLogger,
		);
		expect((client as unknown as { dispatcher: unknown }).dispatcher).toBeDefined();
	});

	it("should generate correct file path", () => {
		const path = "/tmp";
		const serial = "12345";
		const result = PiholeClient.getFilePath(path, serial);
		expect(result).toContain("pihole-session-12345.json");
	});

	it("should handle path with trailing slash", () => {
		const client = new PiholeClient(
			{
				baseUrl: "http://localhost",
				path: "/api/",
				auth,
				rejectUnauthorized: true,
				logLevel: LogLevel.INFO,
			},
			mockLogger,
		);
		expect((client as unknown as { baseUrl: string }).baseUrl).not.toMatch(/\/$/);
	});

	it("should handle session file without sid", async () => {
		const sessionPath = "/tmp/pihole-session-invalid.json";
		const client = new PiholeClient(
			{
				baseUrl: "http://localhost",
				auth: "test-auth-token",
				rejectUnauthorized: true,
				logLevel: LogLevel.INFO,
				sessionPath,
			},
			mockLogger,
		);

		const mockPool = mockAgent.get("http://localhost");

		// Mock fs.readFile to return session without sid
		(fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify({ valid: true }));

		// Mock Auth Challenge
		mockPool
			.intercept({ path: "/api/auth", method: "GET" })
			.reply(200, { session: { valid: false } });

		// Mock Auth Login
		mockPool
			.intercept({ path: "/api/auth", method: "POST" })
			.reply(200, { session: { valid: true, sid: "new-sid" } });

		mockPool
			.intercept({ path: "/api/dns/blocking", method: "GET" })
			.reply(200, { blocking: "enabled" });

		await client.getBlocking();
	});

	it("should reuse in-memory session", async () => {
		const client = new PiholeClient(
			{
				baseUrl: "http://localhost",
				auth: "test-auth-token",
				rejectUnauthorized: true,
				logLevel: LogLevel.INFO,
			},
			mockLogger,
		);

		const mockPool = mockAgent.get("http://localhost");

		// First call
		mockPool
			.intercept({ path: "/api/auth", method: "GET" })
			.reply(200, { session: { valid: true, sid: "sid" } });

		mockPool
			.intercept({ path: "/api/dns/blocking", method: "GET" })
			.reply(200, { blocking: "enabled" });

		await client.getBlocking();

		// Second call - should validate session but NOT login again
		mockPool
			.intercept({ path: "/api/auth", method: "GET" })
			.reply(200, { session: { valid: true, sid: "sid" } });

		mockPool
			.intercept({ path: "/api/dns/blocking", method: "GET" })
			.reply(200, { blocking: "disabled" });

		await client.getBlocking();
	});

	it("should not log info if logLevel is DISABLED", async () => {
		const client = new PiholeClient(
			{
				baseUrl: "http://localhost",
				auth: "test-auth-token",
				rejectUnauthorized: true,
				logLevel: LogLevel.DISABLED,
			},
			mockLogger,
		);

		const mockPool = mockAgent.get("http://localhost");

		mockPool
			.intercept({ path: "/api/auth", method: "GET" })
			.reply(200, { session: { valid: true, sid: "sid" } });

		mockPool
			.intercept({ path: "/api/dns/blocking", method: "GET" })
			.reply(200, { blocking: "enabled" });

		await client.getBlocking();

		expect(mockLogger.info).not.toHaveBeenCalled();
	});

	it("should not log error if logLevel is DISABLED", async () => {
		const sessionPath = "/tmp/pihole-session.json";
		const client = new PiholeClient(
			{
				baseUrl: "http://localhost",
				auth: "test-auth-token",
				rejectUnauthorized: true,
				logLevel: LogLevel.DISABLED,
				sessionPath,
			},
			mockLogger,
		);

		const mockPool = mockAgent.get("http://localhost");

		// Mock fs.readFile to fail (no session)
		const enoentError = new Error("ENOENT");
		Object.assign(enoentError, { code: "ENOENT" });
		(fs.readFile as jest.Mock).mockRejectedValue(enoentError);

		// Mock Auth Challenge
		mockPool
			.intercept({ path: "/api/auth", method: "GET" })
			.reply(200, { session: { valid: false } });

		// Mock Auth Login
		mockPool
			.intercept({ path: "/api/auth", method: "POST" })
			.reply(200, { session: { valid: true, sid: "new-sid" } });

		// Mock Get Blocking
		mockPool
			.intercept({ path: "/api/dns/blocking", method: "GET" })
			.reply(200, { blocking: "enabled" });

		// Mock fs.writeFile to fail
		(fs.writeFile as jest.Mock).mockRejectedValue(new Error("EACCES"));

		await client.getBlocking();

		expect(mockLogger.error).not.toHaveBeenCalled();
	});

	it("should set blocking without timer", async () => {
		const client = new PiholeClient(
			{ baseUrl, auth, rejectUnauthorized: true, logLevel: LogLevel.INFO },
			mockLogger,
		);

		const mockPool = mockAgent.get(baseUrl);
		mockValidAuthSession(mockPool);
		mockPool
			.intercept({
				path: "/api/dns/blocking",
				method: "POST",
				body: JSON.stringify({ blocking: true, timer: undefined }),
			})
			.reply(200, { blocking: "enabled", timer: null });

		const response = await client.setBlocking(true);

		expect(response.body.blocking).toBe("enabled");
		expect(response.body.timer).toBeNull();
	});

	it("should handle custom path configuration", async () => {
		const client = new PiholeClient(
			{
				baseUrl: "http://localhost",
				path: "/admin/api",
				auth,
				rejectUnauthorized: true,
				logLevel: LogLevel.INFO,
			},
			mockLogger,
		);

		const mockPool = mockAgent.get("http://localhost");
		mockPool
			.intercept({ path: "/admin/api/auth", method: "GET" })
			.reply(200, { session: { valid: true, sid: "sid" } });
		mockPool
			.intercept({ path: "/admin/api/dns/blocking", method: "GET" })
			.reply(200, { blocking: "enabled" });

		const response = await client.getBlocking();
		expect(response.body.blocking).toBe("enabled");
	});

	it("should NOT create dispatcher for HTTP even with rejectUnauthorized false", () => {
		const client = new PiholeClient(
			{
				baseUrl: "http://localhost",
				auth,
				rejectUnauthorized: false,
				logLevel: LogLevel.INFO,
			},
			mockLogger,
		);
		expect((client as unknown as { dispatcher: unknown }).dispatcher).toBeUndefined();
	});

	it("should handle session that becomes invalid after initial load", async () => {
		const sessionPath = "/tmp/pihole-session.json";
		const savedSession = { valid: true, sid: "old-sid", validity: 300 };

		const client = new PiholeClient(
			{ baseUrl, auth, rejectUnauthorized: true, logLevel: LogLevel.INFO, sessionPath },
			mockLogger,
		);

		const mockPool = mockAgent.get(baseUrl);
		(fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(savedSession));

		// Session is now invalid (expired)
		mockPool
			.intercept({ path: "/api/auth", method: "GET" })
			.reply(200, { session: { valid: false } });
		// Re-authenticate
		mockPool
			.intercept({ path: "/api/auth", method: "POST", body: JSON.stringify({ password: auth }) })
			.reply(200, { session: { valid: true, sid: "new-sid", validity: 300 } });
		mockBlockingResponse(mockPool, "GET", { blocking: "enabled" });

		await client.getBlocking();

		// Should save new session
		expect(fs.writeFile).toHaveBeenCalledWith(
			sessionPath,
			expect.stringContaining("new-sid"),
			"utf-8",
		);
	});

	it("should handle session file with null value", async () => {
		const sessionPath = "/tmp/pihole-session-null.json";
		const client = new PiholeClient(
			{ baseUrl, auth, rejectUnauthorized: true, logLevel: LogLevel.INFO, sessionPath },
			mockLogger,
		);

		const mockPool = mockAgent.get(baseUrl);
		(fs.readFile as jest.Mock).mockResolvedValue("null");

		mockAuthLoginFlow(mockPool, auth, "new-sid");
		mockBlockingResponse(mockPool, "GET", { blocking: "enabled" });

		await client.getBlocking();
	});

	it("should skip session persistence when no sessionPath configured", async () => {
		const client = new PiholeClient(
			{ baseUrl, auth, rejectUnauthorized: true, logLevel: LogLevel.INFO },
			mockLogger,
		);

		const mockPool = mockAgent.get(baseUrl);
		mockAuthLoginFlow(mockPool, auth, "new-sid");
		mockBlockingResponse(mockPool, "GET", { blocking: "enabled" });

		await client.getBlocking();

		expect(fs.readFile).not.toHaveBeenCalled();
		expect(fs.writeFile).not.toHaveBeenCalled();
	});

	it("should handle blocking response with 'failed' status", async () => {
		const client = new PiholeClient(
			{ baseUrl, auth, rejectUnauthorized: true, logLevel: LogLevel.INFO },
			mockLogger,
		);

		const mockPool = mockAgent.get(baseUrl);
		mockValidAuthSession(mockPool);
		mockBlockingResponse(mockPool, "GET", { blocking: "failed" });

		const response = await client.getBlocking();
		expect(response.body.blocking).toBe("failed");
	});

	it("should handle blocking response with 'unknown' status", async () => {
		const client = new PiholeClient(
			{ baseUrl, auth, rejectUnauthorized: true, logLevel: LogLevel.INFO },
			mockLogger,
		);

		const mockPool = mockAgent.get(baseUrl);
		mockValidAuthSession(mockPool);
		mockBlockingResponse(mockPool, "GET", { blocking: "unknown" });

		const response = await client.getBlocking();
		expect(response.body.blocking).toBe("unknown");
	});

	it("should handle blocking response with active timer", async () => {
		const client = new PiholeClient(
			{ baseUrl, auth, rejectUnauthorized: true, logLevel: LogLevel.INFO },
			mockLogger,
		);

		const mockPool = mockAgent.get(baseUrl);
		mockValidAuthSession(mockPool);
		mockBlockingResponse(mockPool, "GET", { blocking: "disabled", timer: 60.5 });

		const response = await client.getBlocking();
		expect(response.body.blocking).toBe("disabled");
		expect(response.body.timer).toBe(60.5);
	});

	it("should include took property in response", async () => {
		const client = new PiholeClient(
			{ baseUrl, auth, rejectUnauthorized: true, logLevel: LogLevel.INFO },
			mockLogger,
		);

		const mockPool = mockAgent.get(baseUrl);
		mockValidAuthSession(mockPool);
		mockBlockingResponse(mockPool, "GET", { blocking: "enabled", timer: null, took: 0.003 });

		const response = await client.getBlocking();
		expect(response.body.took).toBe(0.003);
	});

	it("should log at ERROR level but not INFO when logLevel is ERROR", async () => {
		const sessionPath = "/tmp/pihole-session.json";
		const client = new PiholeClient(
			{ baseUrl, auth, rejectUnauthorized: true, logLevel: LogLevel.ERROR, sessionPath },
			mockLogger,
		);

		const mockPool = mockAgent.get(baseUrl);
		(fs.readFile as jest.Mock).mockRejectedValue(new Error("Permission denied"));
		mockValidAuthSession(mockPool);
		mockBlockingResponse(mockPool, "GET", { blocking: "enabled" });

		await client.getBlocking();

		expect(mockLogger.error).toHaveBeenCalled();
		expect(mockLogger.info).not.toHaveBeenCalled();
	});
});
