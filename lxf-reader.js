var es = require('event-stream'),
	fs = require('fs'),
	parseString = require('xml2js').parseString,
	_ = require('underscore'),
	// I am not very comfortable using this library, whose development looks 
	// abandoned at the moment, but couldn't manage to do the same with NodeJS's 
	// standard zlib library
	unzip = require('unzip'); // https://github.com/EvanOxfeld/node-unzip

var read = function (filename, callback) {
	var xmlText = "";
	fs.createReadStream(filename)
		.pipe(unzip.Parse())
		.on('entry', function (entry) {
			if (entry.path === "IMAGE100.LXFML") {
				// entry.pipe(fs.createWriteStream('/Users/giacecco/tmp/foo.txt'));
				entry
					.pipe(es.mapSync(function (buffer) {
						xmlText += buffer.toString();		
					}));
			} else {
				entry.autodrain();
			}
		})
		.on('close', function () {
			parseString(xmlText, function (err, result) {
				// extract the part ids and number of pieces, using a hash
				result = result.LXFML.Bricks[0].Brick.reduce(function (memo, x) {
					memo[x['$'].itemNos] = (memo[x['$'].itemNos] || 0) + 1;
					return memo;
				}, { });
				// flatten to an array
				result = _.keys(result).map(function (x) {
					return { 'partId': x, 'quantity': result[x] };
				});
				callback(null, result);
			});
		});
};

module.exports = function (options) {

	return {
		'read': read,
	};

}

read("/Users/giacecco/Projects/bricklink-helper/projects/nyan_cat_full.lxf", function (err, data) {
	if (err) console.log(err);
	console.log(data);
	// console.log(JSON.stringify(data));
});
