var app = angular.module("play", ["ui.router", "ui.bootstrap", "ngDialog", 'ui.toggle']);

var InstrumentList = {
    "synth1": function() {
        return new Tone.PolySynth(12, Tone.AMSynth);
    },
    "bass1": function() {
        return new Tone.PolySynth(12, Tone.FMSynth)
    },
    "drums": function() {
        var drumkit = new Tone.MultiPlayer({
            "kick": "resources/kick.wav",
            "snare1": "resources/snare1.wav",
            "hat1": "resources/hat1.wav",
            "hat2": "resources/hat2.wav",
            "clap": "resources/clap.wav",
            "sfx": "resources/sfx.wav"
        }, Tone.noOp)

        drumkit.triggerAttackRelease = function(name, dur, time) {
            drumkit.start(name, time, 0);
        }

        return drumkit;
    }
};

app.controller("MasterCtrl", [
    "$rootScope",
    "$scope",
    function($rs, $scope) {
        var c = this;

        c.play = function() {
            Tone.Transport.start("+0.1", 0);
            c.isPlaying = true;
        }

        c.stop = function() {
            Tone.Transport.stop();
            c.isPlaying = false;
        }

        var notes = [
            [
                "C", 0
            ],
            [
                "D", 0
            ],
            [
                "E", 0
            ],
            [
                "F", 0
            ],
            [
                "G", 0
            ],
            [
                "A", 0
            ],
            ["B", 0]
        ];
        var stepLen = "8n"
        var steps = 32;

        Tone.Transport.loopStart = 0;
        Tone.Transport.loopEnd = Tone.Time(stepLen).mult(steps);
        Tone.Transport.loop = true;

        c.track = new Track();
        c.track.addInstrument(new Instrument("synth1", Scale(notes, 3, 4), steps, stepLen));
        c.track.addInstrument(new Instrument("bass1", Scale(notes, 1, 2), steps, stepLen));
        c.track.addInstrument(new Instrument("drums", [
            "kick",
            "snare1",
            "hat1",
            "hat2",
            "clap",
            "sfx"
        ], steps, stepLen))
        c.track.schedule();

        c.reset = function() {
            c.track.reset();
        }
    }
]);

app.directive("playHeader", function() {
    return {
        restrict: "E",
        replace: true,
        controller: [
            "$rootScope", function($rootScope) {
                // handle global events here
            }
        ],
        templateUrl: "_header.html"
    }
});

app.directive("playInstrument", function() {
    return {
        restrict: "E",
        replace: true,
        controller: [
            "$scope",
            function($scope) {
                var c = this;

                console.log($scope.rows);
            }
        ],
        controllerAs: "c",
        scope: {
            inst: "="
        },
        templateUrl: "_instrument.html"
    }
});

/* class definitions */

function Track() {
    this.insts = [];
}

Track.prototype.addInstrument = function(inst) {
    console.log("adding " + inst.inst);
    this.insts.push(inst);
}

Track.prototype.reset = function() {
    for (var i in this.insts) {
        this.insts[i].reset()
    }
}

Track.prototype.schedule = function() {
    Tone.Transport.clear();

    for (var i in this.insts) {
        this.insts[i].schedule()
    }
}

// instrument represents a collection
// of steps in different rows
function Instrument(inst, notes, steps, stepLen) {
    var ix = this;
    ix.notes = notes;
    ix.inst = inst;
    ix.rows = new Array(ix.notes.length)
    ix.stepsPerRow = steps;
    ix.stepLen = stepLen;

    ix.bus = Tone.Master;

    ix.mute = false;

    for (var i = 0; i < ix.rows.length; i++) {
        ix.rows[i] = new Row(ix.notes[i], ix.stepsPerRow);
    }
}

Instrument.prototype.reset = function() {
    for (var i = 0; i < this.rows.length; i++) {
        this.rows[i].reset();
    }
}

Instrument.prototype.schedule = function() {
    var ix = this;

    var instObj = InstrumentList[ix.inst]().connect(ix.bus);

    for (var i = 0; i < ix.stepsPerRow; i++) {
        (function(idx_step) {
            for (var j = 0; j < ix.rows.length; j++) {
                (function(idx_row) {
                    Tone.Transport.schedule(function(time) {
                        var row = ix.rows[idx_row]
                        var step = new Step("C4")

                        if (row) {
                            step = row.steps[idx_step];
                        }

                        if (step.active && !ix.mute) {
                            instObj.triggerAttackRelease(row.note, ix.stepLen, time);
                            console.log("playing note " + ix.inst + ", " + step.note);
                        }
                    }, Tone.Time(ix.stepLen).mult(idx_step))
                })(j);
            }
        })(i);
    }
}

// row represents a sequence of steps for a given note
function Row(note, size) {
    this.note = note;
    this.steps = new Array(size);

    for (var i = 0; i < this.steps.length; i++) {
        this.steps[i] = new Step(this.note);
    }
}

Row.prototype.reset = function() {
    for (var i = 0; i < this.steps.length; i++) {
        this.steps[i].reset();
    }
}

// step contains information regarding whether a note should
// be played at a particular moment in time
function Step(note) {
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
