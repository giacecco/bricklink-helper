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

var writeOrders = function(orders, callback) {
	var flattenedOrders = _.keys(orders).reduce(function (memo, sellerUsername) {
			return memo.concat(orders[sellerUsername].map(function (p) {
				p.sellerUsername = sellerUsername;
				return p;
			}));
		}, [ ]).sort(function (a, b) {
			return a.sellerUsername.toLowerCase() < b.sellerUsername.toLowerCase() ? -1 : 
				a.sellerUsername.toLowerCase() > b.sellerUsername.toLowerCase() ? 1 : 
				a.partId < b.partId ? -1 : a.partId > b.partId ? 1 : 
				parseFloat(a.price) - parseFloat(b.price);
		});
	csv()
		.from.array(flattenedOrders)
		.to.path(argv.out, { 
			'header': true, 
			'columns': _.keys(flattenedOrders[0]).sort(), 
		})
		.on('close', function (count) {
			callback(null);
		});
}

readPartsList(argv.in, function (err, partsList) {

	function makeOrder() {
		writeOrders(bricklinkOrder.makeOrder(partsList, availability), function (err) {
			console.log("Finished.");
		});
	}

	var availability;
	if (argv.cache && fs.existsSync(argv.cache)) {
		console.log("Reading parts availability from cache...");
		availability = JSON.parse(fs.readFileSync(argv.cache));
		makeOrder();
	} else {
		console.log("Searching for parts availability online...");
		bricklinkSearch.search(partsList, function (err, a) {
			availability = a;
			if (argv.cache) fs.writeFileSync(argv.cache, JSON.stringify(availability));
			makeOrder();
		});
	}
});
