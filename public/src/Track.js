// BuildInstrument takes a serialized instrument definition
// and returns the described Tone.Instrument
function BuildInstrument(def) {
	// ensure valid data for required parameters
	def = def || {};
	def.componentName = def.componentName || "Synth";
	def.options = def.options || {
		volume: 0
	};
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

	inst.volume.value = 1;

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

	return fx.toMaster();
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

    ix.id = ix.__def.id;

	ix.name = ix.__def.name;
	ix.notes = ix.__def.notes;
	ix.inst = BuildInstrument(ix.__def.instDef);
	ix.rows = new Array(ix.notes.length)
	ix.stepsPerRow = steps;
	ix.stepLen = stepLen;
	ix.events = [];

	ix.mute = ix.__def.mute;

	ix.fx = [];

	ix.changeInstrument(ix.__def.instDef, false);
	ix.setNotes(ix.notes, false);

	if (ix.__def.rows) {
		ix.setRows(ix.__def.rows, false)
	} else {
		ix.resize(ix.stepsPerRow, ix.stepLen, false);
	}

	ix.schedule();
}

Track.prototype.syncMuteWithDef = function() {
	var ix = this;
	ix.__def.mute = ix.mute;
}

Track.prototype.setNotes = function(newNotes, reschedule) {
	if (reschedule !== false && reschedule !== true) reschedule = true;

	var ix = this;

	ix.cleanup();

	ix.notes = newNotes;
	ix.__def.notes = newNotes;
	ix.rows = new Array(ix.notes.length);

	for (var i = 0; i < ix.rows.length; i++) {
		ix.rows[i] = new Row(ix.notes[i], ix.stepsPerRow, ix.stepLen);
	}

	if (reschedule) {
		ix.schedule();
	}
}

Track.prototype.setRows = function(newRows, reschedule) {
	if (reschedule !== false && reschedule !== true) reschedule = true;
	//
	// TODO FIXME
	// account for rows not matching the parent Track/Song's definitions
	// of stepsPerRow and stepLen
	//

	var ix = this;

	ix.cleanup();

	ix.notes = []
	for (var i in newRows) {
		ix.notes[i] = newRows[i].note
	}

	ix.__def.notes = ix.notes;

	ix.rows = newRows;

	ix.resize(ix.stepsPerRow, ix.stepLen, reschedule) // handles re-scheduling & copying existing notes
}

Track.prototype.changeInstrument = function(newDef, reschedule) {
	if (reschedule !== false && reschedule !== true) reschedule = true;
	var ix = this;

	ix.cleanup();

	ix.__def.instDef = newDef || {};
	ix.__def.instDef.effects = ix.__def.instDef.effects || [];

	if (ix.inst && ix.inst.destroy) {
		ix.inst.dispose();
	}

	for (var i in ix.fx) {
		ix.fx[i].dispose();
	}

	ix.inst = BuildInstrument(ix.__def.instDef);

	for (var e in ix.__def.instDef.effects) {
		var f = ix.__def.instDef.effects[e]
		var newFx;
		try {
			newFx = BuildEffect(f.def)
			ix.fx.push({
				name: f.def.effectName,
				connected: !!f.connected,
				effect: newFx
			})
		} catch (err) {
			console.log("can't build effect: " + err);
		}
	}

	ix.inst.fan.apply(ix.inst, ix.fx.filter(function(x) {
		return x.connected
	}).map(function(x) {
		return x.effect
	}))

	ix.inst.connect(Tone.Master);

	if (reschedule) {
		ix.schedule();
	}
}

Track.prototype.toggleFx = function(index) {
	var fx = this.fx[index];
	var fxDef = this.__def.instDef.effects[index]

	if (fx.connected) {
		fx.connected = false;
		this.inst.disconnect(fx.effect)
	} else {
		fx.connected = true;
		this.inst.connect(fx.effect)
	}

	fxDef.connected = fx.connected;
}

Track.prototype.setVolume = function(newDB) {
	this.inst.volume.value = newDB;
	this.__def.instDef.options.volume = newDB;
}

Track.prototype.resize = function(newCount, newLen, reschedule) {
	if (reschedule !== false && reschedule !== true) reschedule = true;
	var ix = this;

	ix.cleanup();

	ix.stepsPerRow = newCount;
	ix.stepLen = newLen;

	var oldRows = ix.rows;

	ix.rows = new Array(ix.notes.length);
	ix.__def.rows = ix.rows;

	if (!oldRows) {
		oldRows = ix.rows;
	}

	for (var i = 0; i < oldRows.length; i++) {
		var newRow = new Row(ix.notes[i], Number(ix.stepsPerRow), ix.stepLen);
		for (var j = 0; j < newRow.steps.length; j++) {
			var oldRow = oldRows[i];
			if (oldRow && oldRow.steps && j < oldRow.steps.length) {
				newRow.steps[j].active = oldRows[i].steps[j].active
			}
		}

		ix.rows[i] = newRow;
	}

	if (reschedule) {
		ix.schedule();
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
					if (!ix.inst) {
						console.log("no inst?");
						return
					}
					if (!ix.mute && step.active) {
						ix.inst.triggerAttackRelease(step.note, ix.stepLen, time);
					}
				}, step.time));
			})(ix.rows[k].steps[i])
		}
	}
}

Track.prototype.serialize = function() {
	return this.__def;
}

Track.prototype.dispose = function() {
    this.cleanup();

	for (var i in this.fx) {
		this.fx[i].effect.dispose()
	}

	if (this.inst) {
		this.inst.dispose()
	}

	this.notes = null;
	this.fx = null;
	this.inst = null;
	this.rows = null;
}
