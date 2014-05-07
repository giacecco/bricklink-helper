var async = require('async'),
	cheerio = require('cheerio'),
	request = require('request'),
	argv = require('yargs').argv,
	qs = require('querystring'),
	_ = require('underscore');

var SEARCH_PAGE_DEPTH = 10;

var search = function (searchParameters, callback) {
	var cont = true,
		allResults = [ ],
		pageNo = 0;
	async.doWhilst(function (callback) {
		searchPage(searchParameters, ++pageNo, function (err, results) {
			allResults = allResults.concat(results);
			cont = results.length >= SEARCH_PAGE_DEPTH;
			callback(err);
		});
	}, function () { return cont; }, function (err) {
		callback(err, allResults);
	});
}

var searchPage = function (searchParameters, pageNo, callback) {
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
				'qMin': searchParameters.qMin,
				'regionID': "-1",
				'qMax': "",
			},
			'qs': { 
				'pg': pageNo,
				'q': searchParameters.legoId,
				'shipCountryID': "UK",
				'sz': SEARCH_PAGE_DEPTH, // the website's max is 500
				'searchSort': "P",
			},
		}, function (err, response, body) {
			var results = [ ];
			if (!err && response.statusCode == 200) {
				var $ = cheerio.load(body);
				results = $('tr.tm').map(function (index, elem) {
					var item = { 
						'new': "new" === $('td:nth-child(2)', elem).text().toLowerCase(),
						// the code, for the time being, consider only UK
						// sellers shipping to UK customers, so this is not
						// relevant
						// 'location': $('td:nth-child(3) font font', elem).text().match(/Loc: (.+),/)[1],
						'minBuy': $('td:nth-child(3) font font', elem).text().match(/Min Buy: (.+)$/)[1],
						'quantity': parseInt($(elem).text().match(/Qty: (.+)Each/)[1]),						
						'price': parseFloat($('td:nth-child(4) font:nth-child(1)', elem).text().match(/Each\:.~GBP (.+)\(/)[1]),						
						'sellerName': $('td:nth-child(4) a', elem).html(),
						'sellerFeedback': parseInt($('td:nth-child(4) a', elem).text().match(/\((.+)\)/)[1]),
						'sellerUsername': qs.parse($('td:nth-child(4) a', elem).attr('href').match(/\?(.+)/)[1]).p,
					};
					item.minBuy = item.minBuy === "None" ? null : parseFloat(item.minBuy.match(/~GBP (.+)/)[1]);
					item.sellerUrl = "http://www.bricklink.com/store.asp?" + qs.stringify({ 'p': item.sellerUsername });
					// TODO, rather than the URL, check the actual feedback!
					item.sellerFeedbackUrl = "http://www.bricklink.com/feedback.asp?" + qs.stringify({ 'u': item.sellerUsername });
					return item;
				}).get();	
			}
			callback(err, results);
	});
};

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

search({
	'legoId': '4655900',
	'qMin': 1,
}, function (err, results) {
	console.log(results.length);
});
