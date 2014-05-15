/* **************************************************************************
   This module prepares the data as vectors and matrices suitable to the
   running the simplex algorithm. Naming conventions and what the
   vectors and matrices actually are are described in the documentation at 
   https://github.com/Digital-Contraptions-Imaginarium/bricklink-helper/blob/master/README.md
   ************************************************************************** */

var async = require('async'),
	csv = require('csv'),
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

module.exports = function (options) {

	var makeOrder = function (partsList, availability, callback) {

		var rExchangeFolder = path.join(__dirname, ".r-exchange");

		// create the folder if it does not exist
		if (!fs.existsSync(rExchangeFolder)) fs.mkdirSync(rExchangeFolder);

		// save all data to transfer control to R
		async.parallel([
			function (callback) { writeCsv([
				{ 'S': 2.00 },
			], path.join(rExchangeFolder, "parameters.csv"), callback); },
			function (callback) { writeCsv(partsList, path.join(rExchangeFolder, "partsList.csv"), callback); },
			function (callback) { writeCsv(availability, path.join(rExchangeFolder, "availability.csv"), callback); },
		], function (err) {
	
			callback([ ], null);
		});
	}

	return {
		'makeOrder': makeOrder,
	};

};