/* **************************************************************************
   This module prepares the data as vectors and matrices suitable to the
   running the simplex algorithm.
   ************************************************************************** */

var mathjs = require('mathjs'),
	// Iain Dunning's SimplexJS library https://github.com/IainNZ/SimplexJS ,
	// adapted to work as a NodeJS module
	SimplexJS = require('./SimplexJS'),
	_ = require('underscore');

module.exports = function (options) {

	var makeOrder = function (partsList, availability) {

		// note how we expect partsList and availability to come straight from
		// readying a loosely-typed file, so we need to enforce the types every
		// time

		// returns the reference list of sellers, in alphabetical, non-
		// case-sensitive order
		var sellers = _.uniq(availability
			.map(function (a) { return a.sellerUsername; }))
			.sort(function (a, b) {
				return a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0;
			});

		// returns the reference list of partIds available on the market 
		// (not the ones specified in the required parts list), in alphabetical, 
		// non-case-sensitive order
		var partIds = _.uniq(availability
			.map(function (a) { return a.partId; }))
			.sort(function (a, b) {
				return a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0;
			});

		// for each seller, returns the value of the minimum order they'll 
		// accept
		var minBuy = sellers.map(function (sellerUsername) {
			var temp = _.find(availability, function (a) {
					return a.sellerUsername === sellerUsername;
				}).minBuy;
			return temp ? parseFloat(temp) : 0.;
		});

		// for each seller, for each partId, this returns the worst price
		var prices = sellers.map(function (sellerUsername) {
			return partIds.map(function (partId) {
				var temp = _.filter(availability, function (a) {
						return (a.sellerUsername === sellerUsername) && (a.partId === partId);
					}).map(function (x) {
						return parseFloat(x.price);
					}).sort(function (a, b) {
						return b - a;
					});
				return temp.length > 0 ? temp[0] : 0.;
			});
		});

		// for each seller, for each partId, this returns the total available 
		// quantity of items, whatever the price (this is a simplification to
		// apply the simplex, otherwise alternative prices would create
		// more equations in the system as if they were different sellers)
		var quantities = sellers.map(function (sellerUsername) {
			return partIds.map(function (partId) {
				return _.filter(availability, function (a) {
					return (a.sellerUsername === sellerUsername) && (a.partId == partId);
				}).reduce(function (memo, a) {
					return memo + parseInt(a.quantity);
				}, 0);
			});
		});

		// for each partId available on the market, this returns how many 
		// bricks I need
		// note that:
		// a) I ignore the requirement for pieces that are not available, as
        //    there is no solution to that
		// b) I support the case where a requirement for the same partId
		//    is expressed in more than one record, it is not supposed to 
		//    happen in theory
		var requirement = partIds.map(function (partId) {
			return partsList.reduce(function (memo, p) {
				if (p.partId === partId) memo += parseInt(p.quantity);
				return memo;
			}, 0);
		});

		console.log("sellers: ", sellers.slice(0, 5));
		console.log("minBuy: ", minBuy.slice(0, 5));
		console.log("partIds: ", partIds.slice(0, 5));
		console.log("requirement: ", requirement.slice(0, 5));
		console.log("for seller " + sellers[1]);
		console.log(quantities[1].slice(0, 10));
		console.log(prices[1].slice(0, 10));

		return { };

	}

	return {
		'makeOrder': makeOrder,
	};

};