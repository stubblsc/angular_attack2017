function Song(steps, stepLen) {
    this.name = "New Song";
	this.steps = steps || 32;
	this.stepLen = stepLen || "8n";
	this.insts = [];
	this.parts = [];
}

Song.prototype.addTrack = function(def) {
	this.insts.push(new Track(def, this.steps, this.stepLen));
}

Song.prototype.reset = function() {
	Tone.Transport.cancel(0);
	for (var i in this.insts) {
		this.insts[i].reset()
	}

	this.schedule();
}

Song.prototype.schedule = function() {
	for (var i in this.insts) {
		this.insts[i].schedule();
	}
}

Song.prototype.resize = function(newCount, newLen) {
	Tone.Transport.clear()
	this.steps = newCount;
	this.stepLen = newLen;
	for (var i in this.insts) {
		this.insts[i].resize(newCount, newLen);
	}
}

Song.prototype.serialize = function() {
	var tracks = [];

	for (var i in this.insts) {
		tracks.push(this.insts[i].serialize());
	}

	return {
        name: this.name,
		steps: this.steps,
		stepLen: this.stepLen,
		tracks: tracks
	}
}

Song.prototype.dispose = function() {
	for (var i in this.insts) {
		this.insts[i].dispose();
	}

	this.insts = null;
}
