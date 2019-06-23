var Service, Characteristic;
var http = require('http');

module.exports = function (hb) {
	Service = hb.hap.Service;
	Characteristic = hb.hap.Characteristic;

	hb.registerAccessory("homebridge-pihole", "Pihole", pihole);
}

function pihole(log, config) {
	this.log = log;

	this.manufacturer = config["manufacturer"] || "My manufacturer";
	this.model = config["model"] || "My model";
	this.serial = config["serial-number"] || "123-456-789";
	this.name = config["name"] || "Pihole";
}

pihole.prototype.getServices = function () {
	var infoService = new Service.AccessoryInformation()
		.setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
		.setCharacteristic(Characteristic.Model, this.model)
		.setCharacteristic(Characteristic.SerialNumber, this.serial);

	var switchService = new Service.Switch(this.name);
	switchService
		.getCharacteristic(Characteristic.On)
		.on('get', this.getStatus.bind(this))
		.on('set', this.setStatus.bind(this));

	this.informationService = infoService;
	this.switchService = switchService;

	return [this.informationService, this.switchService];
}

pihole.prototype.getStatus = function (next) {
	http.get({
		host: '192.168.1.9',
		path: '/admin/api.php?status'
	}, (res) => {
		next(null, res.status == 'enabled');
	})
}

pihole.prototype.setStatus = function (newVal, next) {
	http.get({
		host: '192.168.1.9',
		path: '/admin/api.php?' + (newVal ? 'enable' : 'disable') + '&auth=16406a5e80c9aa95474a080731d89fe9b9022dcbd109db15e7892c9568e4841f'
	}, (res) => {
		next(null, res.status == 'enabled');
	})
}