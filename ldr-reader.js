var fs = require('fs'),
	_ = require('underscore');

var read = function (filename, callback) {
	fs.readFile(filename, { 'encoding': 'utf-8' }, function (err, ldrText) {
		// extract the part ids and number of pieces, using a hash
		var result = ldrText.split("\n").reduce(function (memo, line) {
				var found = line.toLowerCase().match(/ ([a-z0-9]+).dat\r$/);
				if (found) memo[found[1]] = (memo[found[1]] || 0) + 1;
				return memo;
			}, { });
		// flatten to an array
		result = _.keys(result).map(function (x) {
			return { 'partId': x, 'quantity': result[x] };
		});
		console.log(result);
		callback(null, result);
	});
};

module.exports = function (options) {

	return {
		'read': read,
	};

}
