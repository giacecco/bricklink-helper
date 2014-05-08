var argv = require('yargs')
		.demand([ 'in', 'out' ])
		.argv,
	async = require('async'),
	csv = require('csv'),
	fs = require('fs'),
	path = require('path'),
	_ = require('underscore'),
	bricklinkSearch = new require('./bricklink-search')({ 'debug': true }),
	bricklinkOrder = new require('./bricklink-order')();

var readPartsList = function (filename, callback) {
	csv()
		.from.path(filename, { 'columns': true })
		.to.array(function (data) {
			callback(null, data);
		});
};

readPartsList(argv.in, function (err, partsList) {

	function makeOrder() {
		fs.writeFileSync(argv.out, JSON.stringify(bricklinkOrder.makeOrder(partsList, availability)));
		console.log("Finished.");
	}

	var availability;
	if (argv.cache && fs.existsSync(argv.cache)) {
		availability = JSON.parse(fs.readFileSync(argv.cache));
		makeOrder();
	} else {
		bricklinkSearch.search(partsList, function (err, a) {
			availability = a;
			fs.writeFileSync(argv.cache, JSON.stringify(availability));
			makeOrder();
		});
	}
});
