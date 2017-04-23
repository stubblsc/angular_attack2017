// row represents a sequence of steps for a given note
function Row(note, size, stepLen) {
	this.note = note;
	this.steps = new Array(size);

	for (var i = 0; i < this.steps.length; i++) {
		this.steps[i] = new Step(this.note, Tone.Time(stepLen).mult(i).toNotation());
	}
}

Row.prototype.reset = function() {
	for (var i = 0; i < this.steps.length; i++) {
		this.steps[i].reset();
	}
}
