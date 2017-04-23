// step contains information regarding whether a note should
// be played at a particular moment in time
function Step(note, time) {
	this.time = time;
	this.note = note;
	this.active = false;
}

Step.prototype.reset = function() {
	this.active = false;
}

// step::toggle toggles the active state of the step
Step.prototype.toggle = function() {
	this.active = !this.active;
}
