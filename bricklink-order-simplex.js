/* **************************************************************************
   This module prepares the data as vectors and matrices suitable to the
   running the simplex algorithm. Naming conventions and what the
   vectors and matrices actually are are described in the documentation at 
   https://github.com/Digital-Contraptions-Imaginarium/bricklink-helper/blob/master/README.md
   ************************************************************************** */

var mathjs = require('mathjs')(),
	// Iain Dunning's SimplexJS library https://github.com/IainNZ/SimplexJS ,
	// adapted to work as a NodeJS module
	SimplexJS = require('./SimplexJS'),
	_ = require('underscore');

module.exports = function (options) {

	var makeOrder = function (partsList, availability) {

		// note how we expect partsList and availability to come straight from
		// readying a loosely-typed file, so we need to enforce the types every
		// time

		var sellers = _.uniq(availability
			.map(function (a) { return a.sellerUsername; }))
			.sort(function (a, b) {
				return a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0;
			});

		var M = sellers.length;

		var partIds = _.uniq(availability
			.map(function (a) { return a.partId; }))
			.sort(function (a, b) {
				return a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0;
			});

		var N = partIds.length;

		var v = sellers.map(function (sellerUsername) {
			var temp = _.find(availability, function (a) {
					return a.sellerUsername === sellerUsername;
				}).minBuy;
			return temp ? parseFloat(temp) : 0.;
		});

		var p = mathjs.matrix(sellers.map(function (sellerUsername) {
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
		}));

		var m = sellers.map(function (sellerUsername) {
			return partIds.map(function (partId) {
				return _.filter(availability, function (a) {
					return (a.sellerUsername === sellerUsername) && (a.partId == partId);
				}).reduce(function (memo, a) {
					return memo + parseInt(a.quantity);
				}, 0);
			});
		}).reduce(function (memo, x) {
			return memo.concat(x);
		}, [ ]);

		var r = partIds.map(function (partId) {
			return partsList.reduce(function (memo, p) {
				if (p.partId === partId) memo += parseInt(p.quantity);
				return memo;
			}, 0);
		});

		console.log(M, N);
		/*
		// assembling A...
		var A = mathjs.matrix();
		// the top left corner's eyes
		for (var i = 0; i < M; i++) 
			A.subset(mathjs.index([0, N], [i * N, (i + 1) * N]), mathjs.eye(N));
		// the big two eyes underneath
		A.subset(mathjs.index([N, N + M * N], [0,  M * N]), mathjs.eye(M * N));
		*/

		return { };

	}

	return {
		'makeOrder': makeOrder,
	};

};