var argv = require('yargs').argv,
	async = require('async'),
	fs = require('fs'),
	path = require('path'),
	_ = require('underscore'),
	bricklinkSearch = require('./bricklink-search');

var PARTS_LIST = [
	// page 1
	{ 'partId': "235726", 'quantity': 4 }, { 'partId': "4560182", 'quantity': 3 },
	{ 'partId': "4180536", 'quantity': 2 }, { 'partId': "302326", 'quantity': 9 },
	{ 'partId': "379426", 'quantity': 3 }, { 'partId': "379526", 'quantity': 2 },
	{ 'partId': "241226", 'quantity': 15 }, { 'partId': "4180508", 'quantity': 2 },
	{ 'partId': "329826", 'quantity': 1 }, { 'partId': "374726", 'quantity': 1 },
	{ 'partId': "4528331", 'quantity': 3 },	{ 'partId': "4118793", 'quantity': 2 },
	{ 'partId': "4113915", 'quantity': 4 },	
	// page 2
	{ 'partId': "4109995", 'quantity': 2 }, { 'partId': "4162465", 'quantity': 6 },	
	{ 'partId': "4113916", 'quantity': 16 }, { 'partId': "4112982", 'quantity': 11 }, 
	{ 'partId': "4114319", 'quantity': 2 }, { 'partId': "4181134", 'quantity': 2 },	
	{ 'partId': "4579306", 'quantity': 2 }, { 'partId': "4114077", 'quantity': 1 }, 
	{ 'partId': "4114026", 'quantity': 2 }, { 'partId': "4550324", 'quantity': 10 },
	{ 'partId': "4157277", 'quantity': 11 }, { 'partId': "4544139", 'quantity': 1 },
	{ 'partId': "4185177", 'quantity': 3 },	
	// page 3
	{ 'partId': "4113917", 'quantity': 7 }, { 'partId': "4155708", 'quantity': 9 },	
	{ 'partId': "4124067", 'quantity': 4 }, { 'partId': "4114324", 'quantity': 2 },	
	{ 'partId': "4565387", 'quantity': 6 }, { 'partId': "4118790", 'quantity': 6 },	
	{ 'partId': "4113993", 'quantity': 2 }, { 'partId': "4113988", 'quantity': 2 },	
	{ 'partId': "4243824", 'quantity': 2 }, { 'partId': "4509897", 'quantity': 4 },	
	{ 'partId': "4655900", 'quantity': 6 }, { 'partId': "6069165", 'quantity': 4 },	
	{ 'partId': "4536667", 'quantity': 1 },
	// page 4
	{ 'partId': "307021", 'quantity': 1 }, { 'partId': "4626001", 'quantity': 1 },
	{ 'partId': "6000606", 'quantity': 5 },	{ 'partId': "4211052", 'quantity': 4 },
	{ 'partId': "4210998", 'quantity': 1 }, { 'partId': "4211043", 'quantity': 4 },
	{ 'partId': "4278274", 'quantity': 4 }, { 'partId': "4654582", 'quantity': 2 },
	{ 'partId': "4650260", 'quantity': 7 }, { 'partId': "4211397", 'quantity': 2 },
	{ 'partId': "4622803", 'quantity': 5 }, 
];

/*
bricklinkSearch.search(PARTS_LIST, function (err, byPart) {
	fs.writeFileSync(path.join(__dirname, "foo.json"), JSON.stringify(byPart));
	console.log("Finished.");
});
*/

var data = JSON.parse(fs.readFileSync(path.join(__dirname, "test-data.json")));

// Returns the list of bricks specified by the part ids in the partIds 
// array the seller can provide. If partIds is not specified, it returns all
// possible part ids. If more prices are available for the same part ids, the
// cheapest options are favoured.
var getListOfPiecesSellerCanOffer = function (requirement, availability, sellerUsername, partIds) {
	// we need _.uniq below because the same seller may have the same part 
	// in different prices
	partIds = _.uniq(partIds ? [ ].concat(partIds) : availability.reduce(function (memo, a) {
		if (a.sellerUsername === sellerUsername) memo = memo.concat(a.partId);
		return memo;
	}, [ ]));
	return partIds.reduce(function (memo, partId) {
		// the number of bricks I need
		var totalRequirement = (_.find(requirement, function (p) {
				return p.partId === partId;
			}) || { 'quantity': 0 }).quantity;
		// the seller's availability
		var sellerAvailability = availability
			.filter(function (a) {
				return (a.sellerUsername === sellerUsername) && (a.partId === partId);
			})
			.sort(function (a, b) {
				return a.price - b.price;
			})
			.reduce(function (memo, a) {
				var missing = totalRequirement - memo.reduce(function (sum, i) { return sum + i.quantity; }, 0);
				if (missing > 0) {
					var newItems = JSON.parse(JSON.stringify(a));
					newItems.quantity = Math.min(missing, newItems.quantity);
					memo = memo.concat(newItems);					
				}
				return memo;
			}, [ ]);
		return memo.concat(sellerAvailability);
	}, [ ]);
};

// Returns the max number of bricks specified by the part ids in the partIds 
// array the seller can provide. If partIds is not specified, it returns all
// possible part ids.
var getMaxNoOfPiecesSellerCanOffer = function (requirement, availability, sellerUsername, partIds) {
	return getListOfPiecesSellerCanOffer(requirement, availability, sellerUsername, partIds).reduce(function (memo, part) {
			return memo + part.quantity;
		}, 0);
};

var getSellerUsernamesBySizeOfPotentialOrder = function (requirement, availability) {
	return _.uniq(availability.map(function (a) { return a.sellerUsername; }))
		.reduce(function (memo, sellerUsername) {
			var item = { 
				'username': sellerUsername, 
				'count': getMaxNoOfPiecesSellerCanOffer(requirement, availability, sellerUsername)
			};
			if (item.count > 0) memo = memo.concat(item);
			return memo;
		}, [ ])
		.sort(function (a, b) {
			return b.count - a.count;
		})
		.map(function (x) { return x.username; });
};

var makeOrder = function (requirement, availability, sellerUsername) {

	var makeOrderFromSeller = function (requirement, availability, sellerUsername) {
		var pieces = getListOfPiecesSellerCanOffer(requirement, availability, sellerUsername);
		var newRequirement = JSON.parse(JSON.stringify(requirement));
		var newAvailability = JSON.parse(JSON.stringify(availability));
		// I decrease the requirments by the volume of pieces I am ordering from
		// the seller
		newRequirement = newRequirement.reduce(function (memo, r) {
			pieces
				.filter(function (p) {
					return r.partId === p.partId;
				})
				.forEach(function (p) {
					r.quantity -= p.quantity;
				});
			if (r.quantity > 0) memo = memo.concat(r);
			return memo;
		}, [ ]);
		// I remove the seller from the availability
		newAvailability = newAvailability.filter(function (a) {
			return a.sellerUsername !== sellerUsername;
		});
		return {
			'pieces': pieces,
			'newRequirement': newRequirement,
			'newAvailability': newAvailability,
		};
	}

	if (sellerUsername) {
		return makeOrderFromSeller(requirement, availability, sellerUsername);
	} else {
		var newRequirement = JSON.parse(JSON.stringify(requirement));
		var newAvailability = JSON.parse(JSON.stringify(availability));
		var orders = { };
		var keepSearching = true;
		while (keepSearching && (newRequirement.reduce(function (memo, r) { return memo + r.quantity; }, 0) > 0)) {
			var topSellerUsername = _.first(getSellerUsernamesBySizeOfPotentialOrder(newRequirement, newAvailability));
			keepSearching = topSellerUsername;
			if (topSellerUsername) {
				var temp = makeOrderFromSeller(newRequirement, newAvailability, topSellerUsername);
				orders[topSellerUsername] = temp.pieces;
				newRequirement = temp.newRequirement;
				newAvailability = temp.newAvailability;			
			}
		}
		return orders;
	}
}

console.log(JSON.stringify(makeOrder(PARTS_LIST, data)));

/*
var getSellerUsernamesForPartId = function (data, partId) {
	return _.unique(data.reduce(function (memo, d) { 
			if (d.partId === partId) memo = memo.concat(d.sellerUsername);
			return memo;
		}, [ ]));
};

var getSellerUsernamesForAllPartIds = function (data, partIds) {
	partIds = [ ].concat(partIds || [ ]);
	return _.intersection(partIds.map(function (partId) {
		return getSellerUsernamesForPartId(data, partId);
	}));
};

var getMinNoOfSellers = function (data) {
	return _.unique(data.map(function (d) { return d.partId; }))
		.reduce(function (memo, partId) {
			var noOfSellers = data.filter(function (d) { return d.partId === partId; }).length;
			if (!memo || noOfSellers < memo) memo = noOfSellers;
			return memo;
		}, null); 
};

var getPartIdsWithMinNumberOfSellers = function (data) {
	var minNoOfSellers = getMinNoOfSellers(data);
	return _.unique(data.map(function (d) { return d.partId; }))
		.reduce(function (memo, partId) {
			var noOfSellers = data.filter(function (d) { return d.partId === partId; }).length;
			if (noOfSellers === minNoOfSellers) memo = _.unique(memo.concat(partId));
			return memo;
		}, [ ]);
};
*/
