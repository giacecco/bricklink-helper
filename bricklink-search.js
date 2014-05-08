var SEARCH_PAGE_DEPTH = 500,
	MAX_SIMULTANEOUS_QUERIES = 3;

var async = require('async'),
	cheerio = require('cheerio'),
	qs = require('querystring'),
	request = require('request'),
	_ = require('underscore');

exports.search = function (partsList, callback) {

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
					'q': part.partId,
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
							'partId': part.partId,
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
					callback(null, results);
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
	var allResults = [ ];
	async.eachLimit(partsList, MAX_SIMULTANEOUS_QUERIES, function (part, callback) {
		searchOne({ 
			'partId': part.partId,
			'qMin': part.quantity,
		}, function (err, results) {
			allResults = allResults.concat(results);
			callback(err);
		});
	}, function (err) {
		callback(err, allResults);
	});
};
