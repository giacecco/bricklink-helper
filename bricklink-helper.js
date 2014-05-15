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
	// At the moment this is not really useful: the R output is exactly the same
	// file!
	csv()
		.from.array(orders)
		.to.path(argv.out, { 
			'header': true, 
			'columns': [ "sellerUsername" ].concat(_.difference(_.keys(orders[0]).sort(), [ "sellerUsername" ])), 
		})
		.on('close', function (count) {
			callback(null);
		});
}

var makeOrder = function (partsList_, availability_, callback) {
	// clones the input parameters
	var partsList = JSON.parse(JSON.stringify(partsList_)),
		availability = JSON.parse(JSON.stringify(availability_));
	// print a warning about the pieces that could not be found in their 
	// full quantity from at least one seller (read the documentation at
	// http://dico.im/1nBkI4i to understand why)
	var couldNotBeFound = partsList.reduce(function (memo, part) { 
		if (!_.find(availability, function (a) {
			return (a.partId === part.partId) && (a.quantity >= part.quantity);
		})) memo = memo.concat(part.partId);
		return memo;
	}, [ ]);
	if (couldNotBeFound.length > 0) {
		console.log("*** WARNING *** Suitable sellers could not be found for part ids: " + couldNotBeFound.join(", ") + ".");
		// remove the aforementioned pieces from both the requirements and 
		// the availability data
		partsList = partsList.filter(function (p) { return !_.contains(couldNotBeFound, p.partId); });
		availability = availability.filter(function (a) { return !_.contains(couldNotBeFound, a.partId); });
	}
	// call the dedicated algorithm to formulate the necessary orders
	bricklinkOrder.makeOrder(partsList, availability, callback);		
}

// main 

readPartsList(argv.in, function (err, partsList) {

	var complete = function (err, orders) {
		writeOrders(orders, function (err) {
			console.log("Finished.");
		});		
	};

	var availability;
	if (argv.cache && fs.existsSync(argv.cache)) {
		// if a cache filename was specified and the file exists, read the 
		// bricks availability from there
		console.log("Reading parts availability from cache...");
		availability = JSON.parse(fs.readFileSync(argv.cache));
		makeOrder(partsList, availability, complete);
	} else {
		// alternatively, query BrickLink from scratch
		console.log("Searching for parts availability online...");
		bricklinkSearch.search(partsList, function (err, a) {
			availability = a;
			if (argv.cache) fs.writeFileSync(argv.cache, JSON.stringify(availability));
			makeOrder(partsList, availability, complete);
		});
	}
});
