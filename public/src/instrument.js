// BuildInstrument takes a serialized instrument definition
// and returns the described Tone.Instrument
function BuildInstrument(def) {
	// ensure valid data for required parameters
	def = def || {};
	def.componentName = def.componentName || "Synth";
	def.options = def.options || {};
	def.polyVoices = def.polyVoices || 1;
	def.buffers = def.buffers || null;

	var inst;

	if (def.buffers != null) {
		// if we're given a list of buffers, this supersedes all other
		// definition data. We respond by using those buffers to create
		// and adapt a Tone.MultiPlayer instrument
		inst = new Tone.MultiPlayer(def.buffers, null);
		inst.triggerAttackRelease = triggerAttackRelease.bind(inst);
	} else if (def.polyVoices > 1) {
		// if this instrument has multiple voices, we use the componentName
		// to construct a Tone.PolySynth
		inst = new Tone.PolySynth(def.polyVoices, Tone[def.componentName]);
	} else {
		// in the simplest case, we just need to instantiate a Tone[componentName]
		// instrument
		inst = new Tone[def.componentName]();
	}

	inst.set(def.options);

	return inst;
}

// triggerAttackRelease is a helper function to attach to Tone.MultiPlayer
// instruments to create a common interface for scheduling notes
function triggerAttackRelease(name, dur, time) {
	this.start(name, time, 0);
}

// BuildEffect takes a serialized effect definition
// and returns the described Tone.Effect
function BuildEffect(def) {
	def = def || {};

	if (!def.effectName) {
		throw new Error("effect definition must specify effect name");
	}

    def.options = def.options || {};

	var fx = new Tone[def.effectName]();

	fx.set(def.options);

	return fx;
}

function Track(def, steps, stepLen) {
	def = def || {};

	steps = steps || 32;
	stepsLen = stepLen || "8n";

	def.instDef = def.instDef || {};
    def.instDef.effects = def.instDef.effects || [];
	def.name = def.name || "New Track";
	def.notes = def.notes || ["C4"];

	var ix = this;

    ix.__def = def;

	ix.notes = ix.__def.notes;
	ix.inst = BuildInstrument(ix.__def.instDef);
	ix.rows = new Array(ix.notes.length)
	ix.stepsPerRow = steps;
	ix.stepLen = stepLen;
	ix.events = [];

	ix.mute = false;

	ix.fx = [];

    for (var e in ix.__def.instDef.effects) {
		var f = ix.__def.instDef.effects[e]
		var newFx;
		try {
			newFx = BuildEffect(f.def)
			ix.fx.push({
				connected: f.connected || true,
				effect: newFx
			})
		} catch (err) {
			console.log("can't build effect: " + err);
		}
	}

	ix.inst.fan.apply(ix.inst, ix.fx.filter(function(i) {
		return i.connected
	}).map(function(i) {
		return i.effect
	}))

	ix.inst.connect(Tone.Master);

	for (var i = 0; i < ix.rows.length; i++) {
		ix.rows[i] = new Row(ix.notes[i], ix.stepsPerRow, this.stepLen);
	}

    if
}

Track.prototype.changeInstrument = function (newDef) {
    var ix = this;

    ix.cleanup()

    ix.__def.instdef = newDef || {};
    ix.__def.instDef.effects = ix.__def.instDef.effects || [];
    ix.inst = BuildInstrument(ix.__def.instDef);

    for (var e in ix.__def.instDef.effects) {
		var f = ix.__def.instDef.effects[e]
		var newFx;
		try {
			newFx = BuildEffect(f.def)
			ix.fx.push({
				connected: f.connected || true,
				effect: newFx
			})
		} catch (err) {
			console.log("can't build effect: " + err);
		}
	}
}

Track.prototype.toggleFx = function(index) {
	var fx = this.fx[index];
    var fxDef = this.__def.effects[index]

	if (fx.connected) {
		fx.connected = false;
		this.__inst.disconnect(fx.effect)
	} else {
		fx.connected = true;
		this.__inst.connect(fx.effect)
	}

    fxDef.connected = fx.connected;
}

Track.prototype.setVolume = function(newDB) {
	this.inst.volume.value = newDB;
    this.__def.instDef.options.volume = newDB;
}

Track.prototype.resize = function(newCount, newLen) {
	this.stepsPerRow = newCount;
	this.stepLen = newLen;

	for (var i = 0; i < this.rows.length; i++) {
		var newRow = new Row(this.notes[i], this.stepsPerRow, this.stepLen);
		for (var j = 0; j < Math.min(this.rows[i].steps.length, newRow.steps.length); j++) {
			newRow.steps[j].active = this.rows[i].steps[j].active
		}

		this.rows[i] = newRow;
	}
}

Track.prototype.reset = function() {
	for (var i = 0; i < this.rows.length; i++) {
		this.rows[i].reset();
	}
}

Track.prototype.cleanup = function() {
	for (var e in this.events) {
		Tone.Transport.clear(this.events[e]);
	}

	this.events = [];
}

Track.prototype.schedule = function() {
	var ix = this;

	ix.cleanup();

	for (var i = 0; i < ix.stepsPerRow; i++) {
		for (var k = 0; k < ix.rows.length; k++) {
			(function(step) {
				ix.events.push(Tone.Transport.schedule(function(time) {
					if (!ix.mute && step.active) {
						ix.inst.triggerAttackRelease(step.note, ix.stepLen, time);
					}
				}, step.time));
			})(ix.rows[k].steps[i])
		}
	}
}
