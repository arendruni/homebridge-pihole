/* eslint-disable @typescript-eslint/no-explicit-any */
import { ChildProcess, spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { GenericContainer, StartedTestContainer, Wait } from "testcontainers";
import { request } from "undici";

const HOMEBRIDGE_PORT = 51828;
const STORAGE_PATH = path.join(__dirname, "test-storage-jest");
const CONFIG_PATH = path.join(STORAGE_PATH, "config.json");

describe("Pihole Plugin E2E with Docker", () => {
	let container: StartedTestContainer;
	let hbProcess: ChildProcess;
	let piholeUrl: string;
	const piholePassword = "test-password";

	// Helper to get Pi-hole status directly from the container using CLI
	const getPiholeStatus = async () => {
		const { output } = await container.exec(["pihole", "status"]);

		if (output.includes("Pi-hole blocking is enabled")) {
			return { blocking: "enabled" };
		} else if (output.includes("Pi-hole blocking is disabled")) {
			return { blocking: "disabled" };
		}

		console.error("Unknown Pi-hole status output:", output);
		return { blocking: "unknown" };
	};

	// Helper to set Pi-hole status directly (reset state)
	const setPiholeStatus = async (blocking: boolean) => {
		if (blocking) {
			await container.exec(["pihole", "enable"]);
		} else {
			await container.exec(["pihole", "disable"]);
		}
	};

	// Helper to find accessory by name
	const getAccessory = async (name: string) => {
		const { body } = await request(`http://localhost:${HOMEBRIDGE_PORT}/accessories`);
		const data = (await body.json()) as any;
		return data.accessories.find((acc: any) =>
			acc.services.some((s: any) =>
				s.characteristics.some((c: any) => c.description === "Name" && c.value === name),
			),
		);
	};

	// Helper to set characteristic
	const setCharacteristic = async (accessory: any, value: any) => {
		const switchService = accessory.services.find(
			(s: any) => s.type === "49" || s.type.includes("00000049"),
		);
		const onChar = switchService.characteristics.find(
			(c: any) => c.type === "25" || c.type.includes("00000025"),
		);

		const putBody = {
			characteristics: [
				{
					aid: accessory.aid,
					iid: onChar.iid,
					value: value,
				},
			],
		};

		await request(`http://localhost:${HOMEBRIDGE_PORT}/characteristics`, {
			method: "PUT",
			headers: {
				"Content-Type": "application/json",
				"Authorization": "031-45-154",
			},
			body: JSON.stringify(putBody),
		});
	};

	beforeAll(async () => {
		// Clean storage
		if (fs.existsSync(STORAGE_PATH)) {
			fs.rmSync(STORAGE_PATH, { recursive: true, force: true });
		}
		fs.mkdirSync(STORAGE_PATH, { recursive: true });

		console.log("Starting Pi-hole container...");
		const image = process.env.PIHOLE_IMAGE || "pihole/pihole:latest";
		container = await new GenericContainer(image)
			.withEnvironment({
				WEBPASSWORD: piholePassword,
				FTLCONF_webserver_api_password: piholePassword,
				TZ: "UTC",
			})
			.withCopyFilesToContainer([
				{
					source: path.join(__dirname, "pihole.toml"),
					target: "/etc/pihole/pihole.toml",
				},
			])
			.withExposedPorts(80)
			.withWaitStrategy(Wait.forHttp("/admin/login", 80).forStatusCode(200))
			.start();

		const port = container.getMappedPort(80);
		const host = container.getHost();
		piholeUrl = `http://${host}:${port}`;
		console.log(`Pi-hole running at ${piholeUrl}`);

		// Setup Homebridge Config with 5 accessories
		const config = {
			bridge: {
				name: "Homebridge Pihole Jest",
				username: "CC:22:3D:E3:CE:36",
				port: HOMEBRIDGE_PORT,
				pin: "031-45-154",
			},
			accessories: [
				{
					accessory: "Pihole",
					name: "Pihole Normal",
					baseUrl: piholeUrl,
					auth: piholePassword,
					logLevel: 2,
					manufacturer: "Custom Maker",
					model: "Custom Model",
					"serial-number": "Custom-Serial-1",
				},
				{
					accessory: "Pihole",
					name: "Pihole Reversed",
					baseUrl: piholeUrl,
					auth: piholePassword,
					logLevel: 2,
					reversed: true,
				},
				{
					accessory: "Pihole",
					name: "Pihole Timer",
					baseUrl: piholeUrl,
					auth: piholePassword,
					logLevel: 2,
					time: 5, // 5 seconds
				},
				{
					accessory: "Pihole",
					name: "Pihole Persist",
					baseUrl: piholeUrl,
					auth: piholePassword,
					persistSession: true,
					logLevel: 2,
					"serial-number": "Persist-Serial-1",
				},
				{
					accessory: "Pihole",
					name: "Pihole Invalid",
					baseUrl: piholeUrl,
					auth: "wrong-password",
					logLevel: 2,
				},
			],
			platforms: [],
		};
		fs.writeFileSync(CONFIG_PATH, JSON.stringify(config));

		// Initialize Homebridge
		console.log("Starting Homebridge...");
		const hbBin = path.resolve(require.resolve("homebridge"), "../../bin/homebridge");

		hbProcess = spawn(
			process.execPath,
			[
				hbBin,
				"-U",
				STORAGE_PATH,
				"-P",
				path.resolve(__dirname, "../"),
				"-I",
				"--no-qrcode",
				"--no-timestamp",
			],
			{
				stdio: "inherit",
				env: { ...process.env },
			},
		);

		// Give it a moment to initialize
		await new Promise((resolve) => setTimeout(resolve, 5000));
	}, 300000);

	afterAll(async () => {
		if (container) {
			await container.stop();
		}
		if (hbProcess) {
			hbProcess.kill();
		}
	});

	beforeEach(async () => {
		// Reset Pi-hole to Blocking Enabled before each test
		await setPiholeStatus(true);
		// Wait a bit for Homebridge to poll/sync if needed
		await new Promise((resolve) => setTimeout(resolve, 1000));
	});

	describe("Normal Mode", () => {
		it("should have initial state ON (Blocking Enabled)", async () => {
			const acc = await getAccessory("Pihole Normal");
			const switchService = acc.services.find((s: any) => s.type.includes("49"));
			const onChar = switchService.characteristics.find((c: any) => c.type.includes("25"));
			
			// Force a fresh fetch from Pi-hole by reading the characteristic directly
			const { body } = await request(
				`http://localhost:${HOMEBRIDGE_PORT}/characteristics?id=${acc.aid}.${onChar.iid}`,
				{
					headers: {
						"Authorization": "031-45-154",
					},
				},
			);
			const freshData = (await body.json()) as any;
			const freshValue = freshData.characteristics[0].value;
			
			expect([true, 1]).toContain(freshValue);
		});

		it("should disable Pi-hole when turned OFF", async () => {
			const acc = await getAccessory("Pihole Normal");
			await setCharacteristic(acc, false);

			// Wait for propagation
			await new Promise((resolve) => setTimeout(resolve, 1000));

			// Verify directly on Pi-hole
			const status = await getPiholeStatus();
			expect(status.blocking).toBe("disabled");
		});
	});

	describe("Reversed Mode", () => {
		it("should have initial state OFF (Blocking Enabled)", async () => {
			// In reversed mode: Blocking Enabled = Switch OFF
			const acc = await getAccessory("Pihole Reversed");
			const switchService = acc.services.find((s: any) => s.type.includes("49"));
			const onChar = switchService.characteristics.find((c: any) => c.type.includes("25"));
			
			// Force a fresh fetch from Pi-hole by reading the characteristic directly
			const { body } = await request(
				`http://localhost:${HOMEBRIDGE_PORT}/characteristics?id=${acc.aid}.${onChar.iid}`,
				{
					headers: {
						"Authorization": "031-45-154",
					},
				},
			);
			const freshData = (await body.json()) as any;
			const freshValue = freshData.characteristics[0].value;
			
			expect([false, 0]).toContain(freshValue);
		});

		it("should disable Pi-hole when turned ON", async () => {
			// In reversed mode: Switch ON = Disable Blocking
			const acc = await getAccessory("Pihole Reversed");
			await setCharacteristic(acc, true);

			await new Promise((resolve) => setTimeout(resolve, 1000));

			const status = await getPiholeStatus();
			expect(status.blocking).toBe("disabled");
		});
	});

	describe("Timer Mode", () => {
		it("should set a timer when disabled and re-enable after time expires", async () => {
			const acc = await getAccessory("Pihole Timer");
			// Turn OFF to disable (Normal mode logic for this accessory, just with time)
			await setCharacteristic(acc, false);

			await new Promise((resolve) => setTimeout(resolve, 1000));

			let status = await getPiholeStatus();
			expect(status.blocking).toBe("disabled");

			// Wait for timer to expire (5s configured + 1s buffer)
			console.log("Waiting for timer to expire...");
			await new Promise((resolve) => setTimeout(resolve, 5000));

			status = await getPiholeStatus();
			expect(status.blocking).toBe("enabled");
		}, 15000); // Increase timeout for this test
	});

	describe("Persist Session", () => {
		it("should create a session file when persistSession is true", async () => {
			const acc = await getAccessory("Pihole Persist");
			// Trigger a request to ensure session is created
			await setCharacteristic(acc, false);
			await new Promise((resolve) => setTimeout(resolve, 1000));

			// Check if session file exists
			const files = fs.readdirSync(STORAGE_PATH);
			const sessionFile = files.find((f) => f.startsWith("pihole-session-"));
			expect(sessionFile).toBeDefined();

			if (sessionFile) {
				const content = fs.readFileSync(path.join(STORAGE_PATH, sessionFile), "utf-8");
				const session = JSON.parse(content);
				expect(session).toHaveProperty("sid");
				expect(session.valid).toBe(true);
			}
		});
	});

	describe("Accessory Information", () => {
		it("should have correct manufacturer, model and serial number", async () => {
			const acc = await getAccessory("Pihole Normal");
			const infoService = acc.services.find((s: any) => s.type.includes("3E")); // 3E is Accessory Information

			const manufacturer = infoService.characteristics.find((c: any) => c.type.includes("20"));
			const model = infoService.characteristics.find((c: any) => c.type.includes("21"));
			const serial = infoService.characteristics.find((c: any) => c.type.includes("30"));

			expect(manufacturer.value).toBe("Custom Maker");
			expect(model.value).toBe("Custom Model");
			expect(serial.value).toBe("Custom-Serial-1");
		});
	});

	describe("Error Handling", () => {
		it("should handle invalid authentication gracefully", async () => {
			const acc = await getAccessory("Pihole Invalid");

			// Try to turn it OFF (should fail)
			// The request to Homebridge should probably succeed (204) but the characteristic update might fail internally
			// or Homebridge might return an error if the plugin throws.
			// Since we throw in the plugin, Homebridge usually returns a 500 or 207 Multi-Status.
			// Let's see what happens.

			const switchService = acc.services.find((s: any) => s.type.includes("49"));
			const onChar = switchService.characteristics.find((c: any) => c.type.includes("25"));

			const putBody = {
				characteristics: [
					{
						aid: acc.aid,
						iid: onChar.iid,
						value: false,
					},
				],
			};

			const response = await request(`http://localhost:${HOMEBRIDGE_PORT}/characteristics`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					"Authorization": "031-45-154",
				},
				body: JSON.stringify(putBody),
			});

			// Homebridge returns 207 or 400/500 on error depending on version and setup
			// But specifically, if the characteristic set handler throws, it should report an error status for that characteristic.
			if (response.statusCode === 207) {
				const body = (await response.body.json()) as any;
				expect(body.characteristics[0].status).not.toBe(0); // 0 is Success
			} else {
				// If it's not 207, it might be a 500 if the whole request failed
				expect(response.statusCode).not.toBe(204); // 204 is Success for simple requests
			}
		});
	});
});
