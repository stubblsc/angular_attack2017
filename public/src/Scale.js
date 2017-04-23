function Scale(scaleDef, startOctave, endOctave) {
	var scale = [];

	if (typeof startOctave != "number") {
		startOctave = 4;
	}

	if (typeof endOctave != "number") {
		endOctave = startOctave;
	}

	for (var i = startOctave; i <= endOctave; i++) {
		var oct = scaleDef.map(function(c) {
			return c[0] + "" + (c[1] + i)
		})

		scale = scale.concat(oct);
	}

	return scale.reverse();
}
