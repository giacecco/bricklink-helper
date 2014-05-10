var async = require('async'),
	_ = require('underscore');

module.exports = function (options) {

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
				} else {
					console.log("Could not find sellers for " + newRequirement.map(function (r) { return r.partId; }).join(", ") + ".");
				}
			}
			return orders;
		}
	}

	return {
		'makeOrder': makeOrder,
	};

}