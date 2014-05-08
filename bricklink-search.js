var SEARCH_PAGE_DEPTH = 500, // because of the BrickLink duplication bug, these are actually 250!
	MAX_SIMULTANEOUS_QUERIES = 3;

/* TODO: at the moment, 'search' returns only lots that fully match the 
   requirements for some partId. This is not optimal, as, after identifying a
   possible seller, it is useful to know about the partial availaibility of 
   other partIds, too! I should do a 'second round' of searching on all
   sellers identified that far, for all other partIds they could partially
   supply. http://www.bricklink.com/searchAdvanced.asp should be able to
   enable that. */

var async = require('async'),
	cheerio = require('cheerio'),
	qs = require('querystring'),
	request = require('request'),
	_ = require('underscore');

exports.search = function (searchOptions, callback) {

	var searchPart = function (searchOptions, callback) {
		request({
				'url': "http://www.bricklink.com/searchAdvanced.asp",
				'method': "POST",
				'followAllRedirects': true,
				'form': {
					'a': "g",
					'qMin': searchOptions.quantity,
					'saleOff': "0",
					'searchSort': "P", 
					'sz': SEARCH_PAGE_DEPTH,
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
	};

	searchOptions = [ ].concat(searchOptions || [ ]);
	var allResults = [ ];
	async.eachLimit(searchOptions, MAX_SIMULTANEOUS_QUERIES, function (s, callback) {
		searchPart(s, function (err, results) {
			allResults = allResults.concat(results);
			callback(err);
		});
	}, function (err) {
		callback(err, allResults);
	});
};
