var argv = require('yargs')
		.demand([ 'in', 'out' ])
		.argv,
	async = require('async'),
	csv = require('csv'),
	fs = require('fs'),
	_ = require('underscore'),
	bricklinkSearch = new require('./bricklink-search')({ 'debug': true }),
	bricklinkOrder = new require('./bricklink-order-simplex')();

var readPartsList = function (filenames, callback) {

	var readFile = function (filename, callback) {
		csv()
			.from.path(filename, { 'columns': true })
			.to.array(function (data) {
				callback(null, data);
			});			
	}

	filenames = [ ].concat(filenames || [ ]);
	async.reduce(filenames, { }, function (memo, filename, callback) { 
		readFile(filename, function (err, data) {
			data.forEach(function (d) {
				memo[d.partId] = parseInt(d.quantity) + (memo[d.partId] || 0);
			});
			callback(err, memo);
		}); 
	}, function (err, data) {
		callback(err, _.keys(data).map(function (partId) { return { 'partId': partId, 'quantity': data[partId] }; }));
	});
};

var writeOrders = function(orders, callback) {
	csv()
		.from.array(orders)
		.to.path(argv.out, { 
			'header': true, 
			'columns': _.keys(orders[0]).sort(), 
		})
		.on('close', function (count) {
			callback(null);
		});
}

readPartsList(argv.in, function (err, partsList) {

	function makeOrder() {
		bricklinkOrder.makeOrder(partsList, availability, function (err, orders) {
			writeOrders(orders, function (err) {
				console.log("Finished.");
			});		
		})
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
