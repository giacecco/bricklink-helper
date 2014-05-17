/* **************************************************************************
   I could not find the specifications for the LXF file format, probably 
   because it is proprietary by LEGO. The files are not encrypted, though,
   and LXF files are nothing but the .ZIP of two other files: IMAGE100.PNG (a 
   .PNG design preview) and IMAGE100.LXFML, that is an XML file.

   This implementation of the reader assumes that all bricks are referenced
   in the XML file once for every time they are used, which means that 
   producing the parts list means scanning the file top to bottom taking
   count of the reference to each part.

   Unfortunately, the format may be more complicated than this. If I am 
   incorrect, this module could fail interpreting some of the files. 
   ************************************************************************** */

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
