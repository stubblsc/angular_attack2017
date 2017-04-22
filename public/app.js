var app = angular.module("play", ["ui.router", "ui.bootstrap", "ngDialog", 'ui.toggle', 'ng-token-auth']);

app.service("userSession", function($auth, $rootScope, ngDialog) {
  this.register = function() {
    modalForm("_register.html", $rootScope).then(function(data) {
      if (data.value != null) {
        $auth.submitRegistration(data.value).then(function(resp) {
          $rootScope.$broadcast("play:user:registered");
        }).catch(function(resp) {
          // handleFailedRegistration
        });
      }
    })
  }

  this.login = function(data) {
    modalForm("_login.html", $rootScope).then(function(data) {
      if (data.value != null) {
        $auth.submitLogin(data.value).then(function(resp) {
          $rootScope.$broadcast("play:user:authenticated");
        }).catch(function(resp) {
          // TODO
        });
      }
    });
  }

  this.logout = function() {
    $auth.signOut();
  }

  function modalForm(template, scope) {
    return ngDialog.open({
      className: 'dialog-wrapper',
      showClose: false,
      closeByEscape: false,
      closeByDocument: false,
      template: template,
      scope: scope
    }).closePromise
  }
})

var InstrumentList = {
  "Synth": function() {
    return new Tone.PolySynth(12, Tone.AMSynth);
  },
  "Bass": function() {
    return new Tone.PolySynth(12, Tone.FMSynth)
  },
  "Drum Machine": function() {
    var drumkit = new Tone.MultiPlayer({
      "kick": "resources/kick.wav",
      "snare1": "resources/snare1.wav",
      "hat1": "resources/hat1.wav",
      "clap": "resources/clap.wav",
      "sfx": "resources/sfx.wav"
    }, Tone.noOp)

    drumkit.triggerAttackRelease = function(name, dur, time) {
      drumkit.start(name, time, 0);
    }

    return drumkit;
  }
};

app.controller("MasterCtrl", ["$rootScope", "$scope", function($rs, $scope) {
  var c = this;

  c.play = function() {
    Tone.Transport.start("+0.1", 0);
    c.isPlaying = true;
  }

  c.stop = function() {
    Tone.Transport.stop();
    $(".toggle-box").removeClass("playing");
    c.isPlaying = false;
  }

  c.bpm = 120;

  $scope.$watch("c.bpm", function() {

    if (typeof c.bpm != 'number') {
      return
    }

    if (c.bpm < 10) {
      c.bpm = 10;
    }

    if (c.bpm > 500) {
      c.bpm = 500;
    }

    Tone.Transport.bpm.value = c.bpm;
  })

  var notes = [["C", 0], ["D", 0], ["E", 0], ["F", 0], ["G", 0], ["A", 0], ["B", 0]];

  c.stepLen = "16n"
  c.stepCount = "32";

  c.reset = function() {
    c.stop();
    c.track.reset();
  }

  Tone.Transport.loopStart = 0;
  Tone.Transport.loopEnd = Tone.Time(c.stepLen).mult(c.stepCount);
  Tone.Transport.loop = true;

  c.track = new Track(c.stepCount, c.stepLen);
  c.track.addInstrument("Synth", Scale(notes, 3, 4));
  c.track.addInstrument("Bass", Scale(notes, 1, 2));
  c.track.addInstrument("Drum Machine", ["kick", "snare1", "hat1", "clap", "sfx"]);

  var _renderloop;

  $scope.$watch("c.stepCount", resize)
  $scope.$watch("c.stepLen", resize)

  function resize() {
    c.track.resize(Number(c.stepCount), c.stepLen);
    Tone.Transport.loopEnd = Tone.Time(c.stepLen).mult(c.stepCount);
    c.track.schedule();
    if (_renderloop) {
      _renderloop.stop();
    }
    _renderloop = new Tone.Loop(function(time) {
      //triggered every eighth note.
      var index = Tone.Time(Tone.Transport.position).div(c.stepLen).toSeconds();
      $(".toggle-box").removeClass("playing");
      $(".toggle-box." + index).addClass("playing");
    }, c.stepLen).start(0);
  }
}]);

app.directive("playHeader", function() {
  return {
    restrict: "E",
    replace: true,
    controller: [
      "userSession",
      "$scope",
      "ngDialog",
      function(userSession, $scope) {
        $scope.doRegister = userSession.register;

        $scope.doSignIn = userSession.login;
        $scope.doSignOut = function() {
          userSession.logout();
        }
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

function Track(steps, stepLen) {
  this.steps = steps || 32;
  this.stepLen = stepLen || "8n";
  this.insts = [];
  this.parts = [];
}

Track.prototype.addInstrument = function(name, notes) {
  this.insts.push(new Instrument(name, notes, this.steps, this.stepLen));
}

Track.prototype.reset = function() {
  for (var i in this.insts) {
    this.insts[i].reset()
  }
}

Track.prototype.schedule = function() {
  for (var i in this.insts) {
    this.insts[i].schedule();
  }
}

Track.prototype.resize = function(newCount, newLen) {
  Tone.Transport.clear()
  this.steps = newCount;
  this.stepLen = newLen;
  for (var i in this.insts) {
    this.insts[i].resize(newCount, newLen);
  }
}

Track.prototype.serialize = function() {
  var obj = {};

}

// instrument represents a collection
// of steps in different rows
function Instrument(inst, notes, steps, stepLen, initialFx) {
  var ix = this;
  ix.notes = notes;
  ix.inst = inst;
  ix.rows = new Array(ix.notes.length)
  ix.stepsPerRow = steps;
  ix.stepLen = stepLen;
  ix.events = [];
  ix.bus = Tone.Master;

  ix.mute = false;

  ix.fx = initialFx || []
  /*[
    {
      name: "Delay",
      connected: false,
      effect: new Tone.PingPongDelay("32n").toMaster()
    },
    {
      name: "Reverb",
      connected: true,
      effect: new Tone.Freeverb(0.2, 1000).toMaster()
    }
]*/

  ix.__inst = InstrumentList[ix.inst]();
  ix.__inst.fan.apply(ix.__inst, ix.fx.filter(function(i) {
    return i.connected
  }).map(function(i) {
    return i.effect
  }))
  ix.__inst.connect(Tone.Master);

  for (var i = 0; i < ix.rows.length; i++) {
    ix.rows[i] = new Row(ix.notes[i], ix.stepsPerRow, this.stepLen);
  }
}

Instrument.prototype.toggleFx = function(index) {
  var fx = this.fx[index];

  if (fx.connected) {
    fx.connected = false;
    this.__inst.disconnect(fx.effect)
  } else {
    fx.connected = true;
    this.__inst.connect(fx.effect)
  }
}

Instrument.prototype.setVolume = function(newDB) {
  this.__inst.volume.value = newDB;
}

Instrument.prototype.resize = function(newCount, newLen) {
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

Instrument.prototype.reset = function() {
  for (var i = 0; i < this.rows.length; i++) {
    this.rows[i].reset();
  }
}

Instrument.prototype.cleanup = function() {
  for (var e in this.events) {
    Tone.Transport.clear(this.events[e]);
  }

  this.events = [];
}

Instrument.prototype.schedule = function() {
  var ix = this;

  ix.cleanup();

  for (var i = 0; i < ix.stepsPerRow; i++) {
    for (var k = 0; k < ix.rows.length; k++) {
      (function(step) {
        ix.events.push(Tone.Transport.schedule(function(time) {
          if (!ix.mute && step.active) {
            ix.__inst.triggerAttackRelease(step.note, ix.stepLen, time);
          }
        }, step.time));
      })(ix.rows[k].steps[i])
    }
  }
}

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
  console.log(this.time);
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
