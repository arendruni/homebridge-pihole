var Service, Characteristic;
var http = require("http");

const baseURL = "/admin/api.php";

function pihole(log, config) {
	this.log = log;

	this.manufacturer = config["manufacturer"] || "My manufacturer";
	this.model = config["model"] || "My model";
	this.serial = config["serial-number"] || "123-456-789";
	this.name = config["name"] || "Pihole";

	this.auth = config["auth"];
	this.host = config["host"] || "localhost";
	this.time = config["time"] || 0;
	this.port = config["port"] || 80;
}

pihole.prototype.getServices = function () {
	var infoService = new Service.AccessoryInformation()
		.setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
		.setCharacteristic(Characteristic.Model, this.model)
		.setCharacteristic(Characteristic.SerialNumber, this.serial);

	var switchService = new Service.Switch(this.name);
	switchService
		.getCharacteristic(Characteristic.On)
		.on("get", this.getStatus.bind(this))
		.on("set", this.setStatus.bind(this));

	this.informationService = infoService;
	this.switchService = switchService;

	return [this.informationService, this.switchService];
};

pihole.prototype.getStatus = function (next) {
	this._makeRequest("?status", next);
};

pihole.prototype.setStatus = function (newVal, next) {
	this._makeRequest((newVal ? "?enable" : ("?disable=" + this.time)) + "&auth=" + this.auth, next);
};

pihole.prototype._responseHandler = function (res, next) {
	let body = "";

	res.on("data", (data) => { body += data; });
	res.on("end", () => { this.log(body);  next(null, JSON.parse(body).status === "enabled"); });
};

pihole.prototype._makeRequest = function (path, next) {
	http.get({
		host: this.host,
		port: this.port,
		path: baseURL + path
	}, (res) => this._responseHandler(res, next));
};

module.exports = function (hb) {
	Service = hb.hap.Service;
	Characteristic = hb.hap.Characteristic;

	hb.registerAccessory("homebridge-pihole", "Pihole", pihole);
};
