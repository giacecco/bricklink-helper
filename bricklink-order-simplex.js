/* **************************************************************************
   This module prepares the data as vectors and matrices suitable to the
   running the simplex algorithm. Naming conventions and what the
   vectors and matrices actually are are described in the documentation at 
   https://github.com/Digital-Contraptions-Imaginarium/bricklink-helper/blob/master/README.md
   ************************************************************************** */

var async = require('async'),
	csv = require('csv'),
	exec = require('child_process').exec,
	fs = require('fs'),
	path = require('path'),
	_ = require('underscore');

var writeCsv = function (data, filename, callback) {
	csv()
		.from.array(data)
		.to.path(filename, { 
			'header': true, 
			'columns': _.keys(data[0]).sort(), 
		})
		.on('close', function (count) {
			callback(null);
		});
};

var readCsv = function (filename, callback) {
	csv()
		.from.path(filename, {
			'header': true, 
			'columns': true, 
		})
		.to.array(function (data) {
			callback(null, data);
		});
};

var makeOrder = function (partsList_, availability_, callback) {
	// clones the input parameters
	var partsList = JSON.parse(JSON.stringify(partsList_)),
		availability = JSON.parse(JSON.stringify(availability_)),
		// TODO: make the exchange folder name random, so to allow multiple
		// simultaneous executions of this function
		// rExchangeFolder = path.join(__dirname, ".r-exchange-", Math.random().toString(36).replace(/[^a-z]+/g, ''));
		rExchangeFolder = path.join(__dirname, ".r-exchange");
	// create the R exchange folder if it does not exist
	if (!fs.existsSync(rExchangeFolder)) fs.mkdirSync(rExchangeFolder);
	// save all data to transfer control to R
	async.parallel([
		function (callback) { writeCsv([
			{ 'S': 2.00, 'maxSellers': 10 }
		], path.join(rExchangeFolder, "parameters.csv"), callback); },
		function (callback) { writeCsv(partsList, path.join(rExchangeFolder, "partsList.csv"), callback); },
		function (callback) { writeCsv(availability, path.join(rExchangeFolder, "availability.csv"), callback); },
	], function (err) {
		console.log("Handing control over to R; this can take a long time...");
		exec('/usr/local/bin/rscript "' + path.join(__dirname, 'bricklink-order-simplex.R') + '" "' + rExchangeFolder + '"', function (error, stdout, stderr) {
			console.log("Completed.");
			console.log(stdout);
			console.log(stderr);
			readCsv(path.join(rExchangeFolder, "output.csv"), function (err, data) {
				// TODO: delete the R exhange folder
				callback(null, data);
			});
		});
	});
};

module.exports = function (options) {

	return {
		'makeOrder': makeOrder,
	};

};