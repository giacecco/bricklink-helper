var argv = require('yargs').argv,
	async = require('async'),
	_ = require('underscore'),
	bricklinkSearch = require('./bricklink-search.js');

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
	{ 'partId': "4113917", 'quantity': 7 },
	{ 'partId': "4155708", 'quantity': 9 },	{ 'partId': "4124067", 'quantity': 4 },
	{ 'partId': "4114324", 'quantity': 2 },	{ 'partId': "4565387", 'quantity': 6 },
	{ 'partId': "4118790", 'quantity': 6 },	{ 'partId': "4113993", 'quantity': 2 },
	{ 'partId': "4113988", 'quantity': 2 },	{ 'partId': "4243824", 'quantity': 2 },
	{ 'partId': "4509897", 'quantity': 4 },	{ 'partId': "4655900", 'quantity': 6 },
	{ 'partId': "6069165", 'quantity': 4 },	{ 'partId': "4536667", 'quantity': 1 },
	// page 4
	{ 'partId': "307021", 'quantity': 1 }, { 'partId': "4626001", 'quantity': 1 },
	{ 'partId': "6000606", 'quantity': 5 },	{ 'partId': "4211052", 'quantity': 4 },
	{ 'partId': "4210998", 'quantity': 1 }, { 'partId': "4211043", 'quantity': 4 },
	{ 'partId': "4278274", 'quantity': 4 }, { 'partId': "4654582", 'quantity': 2 },
	{ 'partId': "4650260", 'quantity': 7 }, { 'partId': "4211397", 'quantity': 2 },
	{ 'partId': "4622803", 'quantity': 5 }, 
];

/*
search(PARTS_LIST, function (err, byPart) {
	console.log("Finished.");
});
*/
// find the pieces with the min number of sellers
bricklinkSearch.get(function (err, searchResults) {

	var getLowestNumberOfSellers = function (callback) { 
		searchResults.find({ }, function (err, docs) {
			async.reduce(_.unique(docs.map(function (doc) { return doc.partId; })), null, function (memo, partId, callback) {
				searchResults.count({ 'partId': partId }, function (err, count) {
					if (!memo || count < memo) memo = count;
					callback(null, memo);
				});
			}, callback);
		});
	};

	var getPartsWithLowestNumberOfSellers = function (callback) {
		getLowestNumberOfSellers(function (err, lowestNumberOfSellers) {
			searchResults.find({ }, function (err, docs) {
				async.reduce(_.unique(docs.map(function (doc) { return doc.partId; })), [ ], function (memo, partId, callback) {
					searchResults.count({ 'partId': partId }, function (err, count) {
						if (lowestNumberOfSellers === count) memo = _.unique(memo.concat(partId));
						callback(null, memo);
					});
				}, callback);
			});
		});
	};

	getPartsWithLowestNumberOfSellers(function (err, partIds) {
		console.log(partIds);
	});


});
