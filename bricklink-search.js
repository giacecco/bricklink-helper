var SEARCH_PAGE_DEPTH = 25, // because of the BrickLink duplication bug, these are actually half of it!
	MAX_SIMULTANEOUS_QUERIES = 3;

var async = require('async'),
	cheerio = require('cheerio'),
	qs = require('querystring'),
	request = require('request'),
	_ = require('underscore');

module.exports = function (options) {

	var log = function (message) {
		if (options.debug) {
			var d = new Date();
			console.log(d.getFullYear() + "/" + (d.getMonth() < 9 ? '0' : '') + (d.getMonth() + 1) + "/" + (d.getDate() < 10 ? '0' : '') + d.getDate() + " " + (d.getHours() < 10 ? '0' : '') + d.getHours() + ":" + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes() + ":" + (d.getSeconds() < 10 ? '0' : '') + d.getSeconds() + " - " + message);
		}
	};

	var search = function (searchOptions, callback) {

		var searchQueue = async.queue(function (searchOptions, callback) {
			log("Searching for " + JSON.stringify(searchOptions));
			request({
					'url': "http://www.bricklink.com/searchAdvanced.asp",
					'method': "POST",
					'followAllRedirects': true,
					'form': {
						'a': "g",
						'qMin': searchOptions.quantity,
						'saleOff': "0",
						'searchSort': "P", 
						'sz': options.searchPageDepth || SEARCH_PAGE_DEPTH,
						'q': searchOptions.partId,
						'sellerUsername': searchOptions.sellerUsername,
						'sellerLoc': "C",
						'sellerCountryID': "UK",
						'regionID': "-1",
						'shipTo': "Y",
						'shipCountryID': "UK",
						'moneyTypeID': "27", // Pound Sterling
						'pmtMethodID': "11", // PayPal
					},
				}, function (err, response, body) {
					var results = [ ];
					if (err || response.statusCode !== 200) {
						callback(new Error("Could not read BrickLink results page."), [ ]);
					} else {
						var $ = cheerio.load(body);
						results = $('tr.tm').map(function (index, elem) {
							var item = { 
								'partId': searchOptions.partId,
								'new': "new" === $('td:nth-child(2)', elem).text().toLowerCase(),
								// the code, for the time being, consider only UK
								// sellers shipping to UK customers, so this is not
								// relevant
								// 'location': $('td:nth-child(3) font font', elem).text().match(/Loc: (.+),/)[1],
								'minBuy': $('td:nth-child(3) font font', elem).text().match(/Min Buy: (.+)$/)[1],
								'quantity': parseInt($(elem).text().match(/Qty: (.+)Each/)[1]),						
								'price': parseFloat($('td:nth-child(4) font:nth-child(1)', elem).text().match(/Each\:.~GBP (.+)\(/)[1]),						
								// 'sellerName': $('td:nth-child(4) a', elem).html(),
								'sellerNoOfFeedback': parseInt($('td:nth-child(4) a', elem).text().match(/\((.+)\)/)),
								'sellerUsername': qs.parse($('td:nth-child(4) a', elem).attr('href').match(/\?(.+)/)[1]).p,
							};
							if (item.sellerNoOfFeedback) item.sellerNoOfFeedback = item.sellerNoOfFeedback[1];
							item.minBuy = item.minBuy === "None" ? null : parseFloat(item.minBuy.match(/~GBP (.+)/)[1]);
							item.sellerUrl = "http://www.bricklink.com/store.asp?" + qs.stringify({ 'p': item.sellerUsername });
							// TODO, rather than the URL, check the actual feedback!
							item.sellerFeedbackUrl = "http://www.bricklink.com/feedback.asp?" + qs.stringify({ 'u': item.sellerUsername });
							return item;
						}).get();	
						// this is made necessary because at the moment BrickLink is
						// returning duplicate results!
						results = _.uniq(results, false, function (x) { return x.sellerUsername + '_' + x.price; });
						callback(null, results);
					}
			});
		}, options.maxSimultaneousQueries || MAX_SIMULTANEOUS_QUERIES);

		var searchPart = function (searchOptions, callback) {
			searchQueue.push(searchOptions, callback);
		}

		searchOptions = [ ].concat(JSON.parse(JSON.stringify(searchOptions)) || [ ]);
		var firstRoundResults = [ ],
			secondRoundResults = [ ];
		// first round, search for sellers that can provide the full number of 
		// pieces for at least one part
		log("Start of first round of search...");
		async.each(searchOptions, function (s, callback) {
			searchPart(s, function (err, results) {
				firstRoundResults = firstRoundResults.concat(results);
				callback(err);
			});
		}, function (err) {
			// second round, for all sellers identified this far, search also for 
			// partial availability of all other parts
			log("Start of second round of search...");
			var allPartIds = searchOptions.map(function (s) { return s.partId; });
			var sellerUsernames = _.uniq(firstRoundResults.map(function (r) { return r.sellerUsername; })).sort();
			async.each(sellerUsernames, function (sellerUsername, callback) {
				var fullAvailabilityPartIds = firstRoundResults.reduce(function (memo, r) { 
						if (r.sellerUsername === sellerUsername) memo = memo.concat(r.partId);
						return memo; 
					}, [ ]);
				async.each(_.difference(allPartIds, fullAvailabilityPartIds), function (partId, callback) {
					searchPart({ 'partId': partId, 'sellerUsername': sellerUsername }, function (err, results) {
						if (results.length > 0) {
							log("Adding partial availability of " + partId + " from " + sellerUsername + ".");
							secondRoundResults = secondRoundResults.concat(results);
						}
						callback(err);
					});				
				}, callback);
			}, function (err) {
				callback(err, firstRoundResults.concat(secondRoundResults));
			});
		});
	};

	return {
		'search': search,
	}

}


