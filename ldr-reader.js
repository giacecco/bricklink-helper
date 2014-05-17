/* **************************************************************************
   The LDF file format specifications are at 
   http://www.ldraw.org/article/218.html . I could not study them in detail
   nor implemented them thoroughly. Moreover I took a few assumptions that - 
   if incorrect - could break the correct interpretation of some of the files. 

   The assumptions are:
   a) The input LDF file will not reference other LDF files
   b) the "main" part of a LDF is always the top '0 FILE' section: starting 
      from it I will get to all other parts that make the model. There are no
      "loose" parts that are not referenced by the main one.
   c) the names specified by the '0 Name:' directive can contain most 
      characters, as for the '.' in regular expressions. 
   ************************************************************************** */

var fs = require('fs'),
	_ = require('underscore');

var read = function (filename, callback) {

	var	mainGroup = null,
		groups = { };

	// the memoization below is important to make recursion acceptable
	var readIndividualGroup = _.memoize(function (groupName) {
		// extract the part ids and number of pieces, including 'expanding'
		// any reference to other groups
		return groups[groupName].split("\r\n").reduce(function (memo, line) {
				var found = line.match(/^1 \d+ (([-+]?[0-9]*\.?[0-9]+ ){12})(.+)$/);
				if (found) {
					var found2 = found[3].toLowerCase().match(/(.+).dat$/); 
					if (found2) {
						// the line is a reference to a simple piece
						memo[found2[1]] = (memo[found2[1]] || 0) + 1;
					} else {
						// the line is a reference to another group
						var temp = readIndividualGroup(found[3]);
						_.keys(temp).forEach(function (partId) {
							memo[partId] = (memo[partId] || 0) + temp[partId];
						});
					}
				}
				return memo;
			}, { });
	});

	fs.readFile(filename, { 'encoding': 'utf-8' }, function (err, ldrText) {
		// split the file in its "components"
		var found,
			nextGroupName = null,
			itIsTheBeginningOfTheFile = true;
		do {
			// TODO: what characters can be used in the component names?
			found = ldrText.match(/0 Name: (.+)\r\n/);
			if (found) {
				var temp = ldrText.split(found[0]);
				if (!nextGroupName) {
					// the next group of lines is going to be the very first 
					// (or only) group, hence the root to the whole model
					mainGroup = found[1];
				} else {
					groups[nextGroupName] = temp[0]; 
				}
				nextGroupName = found[1];
				ldrText = temp[1];
			} else {
				groups[nextGroupName] = ldrText;	
			}
		} while (found);
		// calculate the requirements by 'expanding' the component that has
		// a "FILE" directive in its specs
		var result = readIndividualGroup(mainGroup);
		// flatten to an array
		result = _.keys(result).map(function (x) {
			return { 'partId': x, 'quantity': result[x] };
		});
		callback(null, result);
	});
};

module.exports = function (options) {

	return {
		'read': read,
	};

}
