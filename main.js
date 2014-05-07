var DB_FILENAME = 'foo.nedb',
	SEARCH_PAGE_DEPTH = 500,
	MAX_SIMULTANEOUS_QUERIES = 3;

var path = require('path'),
	Datastore = require('nedb'), 
	db = { 'searchResults': new Datastore({ filename: path.join(__dirname, DB_FILENAME), autoload: true }) },
	argv = require('yargs').argv,
	async = require('async'),
	cheerio = require('cheerio'),
	fs = require('fs'),
	qs = require('querystring'),
	request = require('request'),
	_ = require('underscore');

var search = function (partsList, callback) {

	var searchPage = function (part, pageNo, callback) {
		// the distribution of parameters between quesrystring and POST payload is
		// odd but it the one the original website is using
		request({
				'url': "http://www.bricklink.com/search.asp",
				'method': "POST",
				'form': {
					'viewFrom': "sf",
					'fromResults': "Y",
					'q': "",
					'w': "",
					'invNew': "*",
					'sz': "10",
					'searchSort': "P",
					'sellerLoc': "C",
					'sellerCountryID': "UK",
					'qMin': part.quantity,
					'regionID': "-1",
					'qMax': "",
				},
				'qs': { 
					'pg': pageNo,
					'q': part.legoId,
					'shipCountryID': "UK",
					'sz': SEARCH_PAGE_DEPTH, // the website's max is 500
					'searchSort': "P",
				},
			}, function (err, response, body) {
				var results = [ ];
				if (err || response.statusCode !== 200) {
					callback(new Error("Could not read BrickLink results page."), [ ]);
				} else {
					var $ = cheerio.load(body);
					results = $('tr.tm').map(function (index, elem) {
						var item = { 
							'partId': part.legoId,
							'new': "new" === $('td:nth-child(2)', elem).text().toLowerCase(),
							// the code, for the time being, consider only UK
							// sellers shipping to UK customers, so this is not
							// relevant
							// 'location': $('td:nth-child(3) font font', elem).text().match(/Loc: (.+),/)[1],
							'minBuy': $('td:nth-child(3) font font', elem).text().match(/Min Buy: (.+)$/)[1],
							'quantity': parseInt($(elem).text().match(/Qty: (.+)Each/)[1]),						
							'price': parseFloat($('td:nth-child(4) font:nth-child(1)', elem).text().match(/Each\:.~GBP (.+)\(/)[1]),						
							// 'sellerName': $('td:nth-child(4) a', elem).html(),
							'sellerFeedback': parseInt($('td:nth-child(4) a', elem).text().match(/\((.+)\)/)[1]),
							'sellerUsername': qs.parse($('td:nth-child(4) a', elem).attr('href').match(/\?(.+)/)[1]).p,
						};
						item.minBuy = item.minBuy === "None" ? null : parseFloat(item.minBuy.match(/~GBP (.+)/)[1]);
						item.sellerUrl = "http://www.bricklink.com/store.asp?" + qs.stringify({ 'p': item.sellerUsername });
						// TODO, rather than the URL, check the actual feedback!
						item.sellerFeedbackUrl = "http://www.bricklink.com/feedback.asp?" + qs.stringify({ 'u': item.sellerUsername });
						return item;
					}).get();	
					async.forEach(results, function (result, callback) {
						db.searchResults.insert(result, callback); 
					}, function (err) {
						callback(err, results);
					});
				}
		});
	};

	var searchOne = function (part, callback) {
		var cont = true,
			allResults = [ ],
			pageNo = 0;
		async.doWhilst(function (callback) {
			searchPage(part, ++pageNo, function (err, results) {
				allResults = allResults.concat(results);
				cont = results.length >= SEARCH_PAGE_DEPTH;
				callback(err);
			});
		}, function () { return cont; }, function (err) {
			callback(err, allResults);
		});
	}

	partsList = [ ].concat(partsList || [ ]);
	fs.unlinkSync(path.join(__dirname, DB_FILENAME));
	var allResults = { };
	async.eachLimit(partsList, MAX_SIMULTANEOUS_QUERIES, function (part, callback) {
		searchOne({ 
			'legoId': part.legoId,
			'qMin': part.quantity,
		}, function (err, results) {
			allResults[part.legoId] = results;
			callback(err);
		});
	}, function (err) {
		callback(err, allResults);
	});
}

/*
var getBySeller = function (byParts) {
	bySeller = { };
	_.keys(byPart).forEach(function (legoId) {
		byPart[legoId].forEach(function (availability) {
			if (!bySeller[availability.sellerUsername]) bySeller[availability.sellerUsername] = { 
				'minBuy': availability.minBuy,
				'sellerFeedback': availability.sellerFeedback,
				'parts': { },
			};
			bySeller[availability.sellerUsername].parts[legoId] = { 
					'new': availability.new,
					'quantity': availability.quantity, 
					'price': availability.price,
			};
		});
	});
	return bySeller;
}

var createOrderForRarestPieces = function (byPart) {
	byPart = JSON.parse(JSON.stringify(byPart)); // clones the object
	var	bySeller = getBySeller(byPart),
		// the rarest parts are the ones with the minimum number of sellers
		minNumberOfSellersForOnePart = _.keys(byPart).reduce(function (memo, partId) {
			if ((_.keys(byPart[partId]).length < memo) || _.isNull(memo)) memo = _.keys(byPart[partId]).length;
			return memo;
		}, null),
		// these sellers all sell one or more equally rare parts
		possibleSellerUsernames = _.keys(byPart).reduce(function (memo, partId) {
			if (byPart[partId].length === minNumberOfSellersForOnePart) {
				memo = _.unique(memo.concat(byPart[partId].map(function (item) { return item.sellerUsername; })));
			}
			return memo;
		}, [ ]);
	console.log("possibleSellerUsernames is " + possibleSellerUsernames);
	// delete information bySeller 
	_.keys(bySeller).forEach(function (sellerUsername) {
		if (!_.contains(possibleSellerUsernames, sellerUsername)) delete bySeller[sellerUsername];
	});
	// finds the seller from which I can buy the most parts
	var maxParts = _.keys(bySeller).reduce(function (memo, sellerUsername) {
		if ((_.keys(bySeller[sellerUsername]).length > memo) || _.isNull(memo)) {
			memo = _.keys(bySeller[sellerUsername]).length;
		}
		return memo;
	}, null);
	console.log("maxParts is " + maxParts);
	_.keys(bySeller).forEach(function (sellerUsername) {
		if (_.keys(bySeller[sellerUsername]).length < maxParts) {
			delete bySeller[sellerUsername];
		}
	});
	console.log(bySeller);

	// ABORTED, better using a database like memory structure, this is too messy

}
*/

var PARTS_LIST = [
	// page 1
	{ 'legoId': "235726", 'quantity': 4 }, { 'legoId': "4560182", 'quantity': 3 },
	{ 'legoId': "4180536", 'quantity': 2 }, { 'legoId': "302326", 'quantity': 9 },
	{ 'legoId': "379426", 'quantity': 3 }, { 'legoId': "379526", 'quantity': 2 },
	{ 'legoId': "241226", 'quantity': 15 }, { 'legoId': "4180508", 'quantity': 2 },
	{ 'legoId': "329826", 'quantity': 1 }, { 'legoId': "374726", 'quantity': 1 },
	{ 'legoId': "4528331", 'quantity': 3 },	{ 'legoId': "4118793", 'quantity': 2 },
	{ 'legoId': "4113915", 'quantity': 4 },	
	// page 2
	{ 'legoId': "4109995", 'quantity': 2 }, { 'legoId': "4162465", 'quantity': 6 },	
	{ 'legoId': "4113916", 'quantity': 16 }, { 'legoId': "4112982", 'quantity': 11 }, 
	{ 'legoId': "4114319", 'quantity': 2 }, { 'legoId': "4181134", 'quantity': 2 },	
	{ 'legoId': "4579306", 'quantity': 2 }, { 'legoId': "4114077", 'quantity': 1 }, 
	{ 'legoId': "4114026", 'quantity': 2 }, { 'legoId': "4550324", 'quantity': 10 },
	{ 'legoId': "4157277", 'quantity': 11 }, { 'legoId': "4544139", 'quantity': 1 },
	{ 'legoId': "4185177", 'quantity': 3 },	
	// page 3
	{ 'legoId': "4113917", 'quantity': 7 },
	{ 'legoId': "4155708", 'quantity': 9 },	{ 'legoId': "4124067", 'quantity': 4 },
	{ 'legoId': "4114324", 'quantity': 2 },	{ 'legoId': "4565387", 'quantity': 6 },
	{ 'legoId': "4118790", 'quantity': 6 },	{ 'legoId': "4113993", 'quantity': 2 },
	{ 'legoId': "4113988", 'quantity': 2 },	{ 'legoId': "4243824", 'quantity': 2 },
	{ 'legoId': "4509897", 'quantity': 4 },	{ 'legoId': "4655900", 'quantity': 6 },
	{ 'legoId': "6069165", 'quantity': 4 },	{ 'legoId': "4536667", 'quantity': 1 },
	// page 4
	{ 'legoId': "307021", 'quantity': 1 }, { 'legoId': "4626001", 'quantity': 1 },
	{ 'legoId': "6000606", 'quantity': 5 },	{ 'legoId': "4211052", 'quantity': 4 },
	{ 'legoId': "4210998", 'quantity': 1 }, { 'legoId': "4211043", 'quantity': 4 },
	{ 'legoId': "4278274", 'quantity': 4 }, { 'legoId': "4654582", 'quantity': 2 },
	{ 'legoId': "4650260", 'quantity': 7 }, { 'legoId': "4211397", 'quantity': 2 },
	{ 'legoId': "4622803", 'quantity': 5 }, 
];

/*
search(PARTS_LIST, function (err, byPart) {
	console.log("Finished.");
});
*/


/*
var byPart = JSON.parse(fs.readFileSync("./test_data.json"));

var partIds = _.keys(byPart),
	unavailablePartIds = partIds.filter(function (partId) { return _.keys(byPart[partId]).length === 0; });
// drop data for the unavailable parts
if (unavailablePartIds.length > 0) {
	console.log("The following parts are unavailable from any seller: " + unavailablePartIds.join(", "));
	unavailablePartIds.forEach(function (partId) { delete byPart[partId]; });
}
createOrderForRarestPieces(byPart);
*/