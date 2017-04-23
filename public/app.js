var app = angular.module("play", ['ui.slider', 'ngCookies', "ui.bootstrap", "ngDialog", 'ui.toggle', 'ng-token-auth']);

app.config(function($authProvider) {
	$authProvider.configure({
		apiUrl: '//localhost:3000'
	});
});

app.service("dialogs", function(ngDialog) {
	// helper method to display a standard modal form
	this.modalForm = function(template, scope) {
		return ngDialog.open({
			className: 'dialog-wrapper',
			showClose: false,
			closeByEscape: false,
			closeByDocument: false,
			template: template,
			scope: scope
		}).closePromise
	}

	this.showAlert = function(templateStr, time) {
		return ngDialog.open({
			className: 'dialog-wrapper',
			showClose: false,
			plain: true,
			template: templateStr,
			controller: function($scope, $timeout) {
				if (time != null) {
					$timeout($scope.closeThisDialog, time);
				}
			}
		}).closePromise
	}
})

app.service("userSession", function($auth, $rootScope, dialogs) {
	var currentUserData = null;

	$rootScope.$on("auth:validation-success", function(evt, data) {
		currentUserData = data;
	})

	$rootScope.$on("auth:validation-error", function() {
		// probably do nothing for now, but we'll revisit later
	})

	this.register = function() {
		dialogs.modalForm("_register.html", $rootScope).then(function(data) {
			if (data.value != null) {
				$auth.submitRegistration(data.value).then(function(resp) {
					$rootScope.$broadcast("play:user:registered");
				}).catch(function(resp) {
					dialogs.showAlert(
						"<div class='text-center alert alert-danger'>" +
						"<b>Something went wrong signing you up...</b><br/><br/>" +
						resp.data.errors.full_messages.join("<br/>") +
						"</div>", 5000);
				});
			}
		})
	}

	this.login = function(data) {
		dialogs.modalForm("_login.html", $rootScope).then(function(data) {
			if (data.value != null) {
				$auth.submitLogin(data.value).then(function(resp) {
					currentUserData = resp;
					$rootScope.$broadcast("play:user:authenticated");
				}).catch(function(resp) {
					dialogs.showAlert(
						"<div class='text-center alert alert-danger'>" +
						"<b>Sorry, we couldn't sign you in</b><br/><br/>" +
						resp.errors.join("<br/>") +
						"</div>", 1500);
				});
			}
		});
	}

	this.logout = function() {
		currentUserData = null;
		$auth.signOut();
		dialogs.showAlert(
			"<div class='text-center alert alert-info'>" +
			"Signed Out" +
			"</div>", 1000);
	}

	this.currentUser = function() {
		return currentUserData;
	}
})

var InstrumentList = {
	"Synth": {
		componentName: "AMSynth",
		polyVoices: 12,
		effects: [{
				connected: true,
				def: {
					effectName: "PingPongDelay"
				}
			},
			{
				connected: false,
				def: {
					effectName: "Freeverb"
				}
			}
		]
	},
	"Bass": {
		componentName: "FMSynth",
		polyVoices: 12
	},
	"Drum Machine": {
		componentName: "MultiPlayer",
		buffers: {
			"kick": "resources/kick.wav",
			"snare1": "resources/snare1.wav",
			"hat1": "resources/hat1.wav",
			"clap": "resources/clap.wav",
			"sfx": "resources/sfx.wav"
		}
	}
};

app.controller("MasterCtrl", ["$rootScope", "$scope", "userSession", "$http", "dialogs", "$cookies", function($rs, $scope, userSession, $http, dialogs, $cookies) {
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

	c.signedIn = function() {
		return userSession.currentUser() != null;
	}

	c.editSongTitle = function() {
		dialogs.modalForm("_songname.html", $scope).then(
			function(result) {
				if (result.value != null) {
					c.track.name = result.value;
				}
			}
		);
	}

	var notes = [
		["C", 0],
		["D", 0],
		["E", 0],
		["F", 0],
		["G", 0],
		["A", 0],
		["B", 0]
	];

	c.stepLen = "16n"
	c.stepCount = "32";

	c.reset = function() {
		c.stop();
		Tone.Transport.cancel(0);
		c.track.reset();
		_renderloop = restartRenderLoop();
	}

	c.save = function() {
		if (!c.signedIn()) {
			dialogs.showAlert("<div class='alert alert-info'>Not signed in...</div>", 500);
			return;
		}

		if (c.track.id != null && typeof c.track.id != 'undefined') {
			c.update();
			return
		}

		var data = c.track.serialize();
		data.bpm = c.bpm;

		var payload = JSON.stringify(data);

		var auth_headers = JSON.parse($cookies.get("auth_headers"));

		$http.post("/songs", {
			song: {
				payload: payload,
				name: c.track.name,
				user_id: userSession.currentUser().id
			}
		}, {
			headers: auth_headers
		}).then(function(resp) {
			c.track.id = resp.data.id;
			dialogs.showAlert("<div class='alert alert-success'>Saved</div>", 1500);
            var h = resp.headers()
            var at = auth_headers["access-token"];
            var exp = auth_headers["expiry"];
            var cli = auth_headers["client"];
            if(h["access-token"]) {
                at = h["access-token"];
            }
            if(h["expiry"]) {
                exp = h["expiry"];
            }
            if(h["client"]) {
                cli = h["client"]
            }

            $cookies.put("auth_headers", JSON.stringify({
                "access-token": at,
                "uid": userSession.currentUser().uid,
                "token-type": "Bearer",
                "expiry": exp,
                "client": cli
            }))
		}, function(resp) {
            var h = resp.headers()
            var at = auth_headers["access-token"];
            var exp = auth_headers["expiry"];
            var cli = auth_headers["client"];
            if(h["access-token"]) {
                at = h["access-token"];
            }
            if(h["expiry"]) {
                exp = h["expiry"];
            }
            if(h["client"]) {
                cli = h["client"]
            }

            $cookies.put("auth_headers", JSON.stringify({
                "access-token": at,
                "uid": userSession.currentUser().uid,
                "token-type": "Bearer",
                "expiry": exp,
                "client": cli
            }))
			dialogs.showAlert("<div class='alert alert-danger'>Saving failed...</div>");
		});
	}

	c.update = function() {
		var data = c.track.serialize();
		data.bpm = c.bpm;

		var payload = JSON.stringify(data);

		var auth_headers = JSON.parse($cookies.get("auth_headers"));

		$http.put("/songs/" + c.track.id , {
			song: {
				payload: payload,
				name: c.track.name,
				user_id: userSession.currentUser().id
			}
		}, {
			headers: auth_headers
		}).then(function(resp) {
			dialogs.showAlert("<div class='alert alert-success'>Saved</div>", 1500);
            var h = resp.headers()
            var at = auth_headers["access-token"];
            var exp = auth_headers["expiry"];
            var cli = auth_headers["client"];
            if(h["access-token"]) {
                at = h["access-token"];
            }
            if(h["expiry"]) {
                exp = h["expiry"];
            }
            if(h["client"]) {
                cli = h["client"]
            }

            $cookies.put("auth_headers", JSON.stringify({
                "access-token": at,
                "uid": userSession.currentUser().uid,
                "token-type": "Bearer",
                "expiry": exp,
                "client": cli
            }))
		}, function(resp) {
            var h = resp.headers()
            var at = auth_headers["access-token"];
            var exp = auth_headers["expiry"];
            var cli = auth_headers["client"];
            if(h["access-token"]) {
                at = h["access-token"];
            }
            if(h["expiry"]) {
                exp = h["expiry"];
            }
            if(h["client"]) {
                cli = h["client"]
            }

            $cookies.put("auth_headers", JSON.stringify({
                "access-token": at,
                "uid": userSession.currentUser().uid,
                "token-type": "Bearer",
                "expiry": exp,
                "client": cli
            }))
			dialogs.showAlert("<div class='alert alert-danger'>Saving failed...</div>");
		});
	}

	c.load = function() {
		var payload = JSON.parse(SAVED);

		var newSong = new Song(payload.steps, payload.stepLen);

		for (var t in payload.tracks) {
			newSong.addTrack(payload.tracks[t])
		}

		newSong.name = payload.name;
		newSong.id = payload.id;

		c.track.dispose();
		c.track = null;
		c.track = newSong;
		c.stepLen = payload.stepLen;
		c.stepCount = String(payload.steps);
		c.bpm = payload.bpm;
		//newSong.schedule();
	}

	Tone.Transport.loopStart = 0;
	Tone.Transport.loopEnd = Tone.Time(c.stepLen).mult(c.stepCount);
	Tone.Transport.loop = true;

	c.track = new Song(c.stepCount, c.stepLen);
	c.track.addTrack({
		name: "Lead",
		instDef: InstrumentList["Synth"],
		notes: Scale(notes, 3, 4)
	});

	c.track.addTrack({
		name: "Bassline",
		instDef: InstrumentList["Bass"],
		notes: Scale(notes, 1, 2)
	});
	c.track.addTrack({
		name: "Drums",
		instDef: InstrumentList["Drum Machine"],
		notes: ["kick", "snare1", "hat1", "clap", "sfx"]
	});

	var _renderloop;

	$scope.$watch("c.stepCount", resize)
	$scope.$watch("c.stepLen", resize)

	function resize() {
		c.track.resize(Number(c.stepCount), c.stepLen);
		Tone.Transport.loopEnd = Tone.Time(c.stepLen).mult(c.stepCount);
		c.track.schedule();
		_renderloop = restartRenderLoop();
	}

	function restartRenderLoop() {
		if (_renderloop) {
			_renderloop.dispose()
		}
		return new Tone.Loop(function(time) {
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
				$scope.signedIn = function() {
					return userSession.currentUser() != null
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

var SAVED = '{"steps":16, "bpm": 120, "stepLen":"16n","tracks":[{"name":"Lead","instDef":{"componentName":"AMSynth","polyVoices":12,"effects":[{"connected":false,"def":{"effectName":"PingPongDelay","options":{}}},{"connected":true,"def":{"effectName":"Freeverb","options":{}}}],"options":{},"buffers":null},"notes":["B4","A4","G4","F4","E4","D4","C4","B3","A3","G3","F3","E3","D3","C3"],"rows":[{"note":"B4","steps":[{"time":"0","note":"B4","active":false},{"time":"16n","note":"B4","active":false},{"time":"8n","note":"B4","active":false},{"time":"8n + 16n","note":"B4","active":false},{"time":"4n","note":"B4","active":false},{"time":"4n + 16n","note":"B4","active":false},{"time":"4n + 8n","note":"B4","active":false},{"time":"4n + 8n + 16n","note":"B4","active":false},{"time":"2n","note":"B4","active":false},{"time":"2n + 16n","note":"B4","active":false},{"time":"2n + 8n","note":"B4","active":false},{"time":"2n + 8n + 16n","note":"B4","active":false},{"time":"2n + 4n","note":"B4","active":false},{"time":"2n + 4n + 16n","note":"B4","active":false},{"time":"2n + 4n + 8n","note":"B4","active":false},{"time":"2n + 4n + 8n + 16n","note":"B4","active":false}],"$$hashKey":"object:1195"},{"note":"A4","steps":[{"time":"0","note":"A4","active":false},{"time":"16n","note":"A4","active":false},{"time":"8n","note":"A4","active":false},{"time":"8n + 16n","note":"A4","active":false},{"time":"4n","note":"A4","active":false},{"time":"4n + 16n","note":"A4","active":false},{"time":"4n + 8n","note":"A4","active":false},{"time":"4n + 8n + 16n","note":"A4","active":false},{"time":"2n","note":"A4","active":false},{"time":"2n + 16n","note":"A4","active":false},{"time":"2n + 8n","note":"A4","active":false},{"time":"2n + 8n + 16n","note":"A4","active":false},{"time":"2n + 4n","note":"A4","active":false},{"time":"2n + 4n + 16n","note":"A4","active":false},{"time":"2n + 4n + 8n","note":"A4","active":false},{"time":"2n + 4n + 8n + 16n","note":"A4","active":false}],"$$hashKey":"object:1196"},{"note":"G4","steps":[{"time":"0","note":"G4","active":false},{"time":"16n","note":"G4","active":false},{"time":"8n","note":"G4","active":false},{"time":"8n + 16n","note":"G4","active":false},{"time":"4n","note":"G4","active":false},{"time":"4n + 16n","note":"G4","active":false},{"time":"4n + 8n","note":"G4","active":false},{"time":"4n + 8n + 16n","note":"G4","active":false},{"time":"2n","note":"G4","active":false},{"time":"2n + 16n","note":"G4","active":false},{"time":"2n + 8n","note":"G4","active":false},{"time":"2n + 8n + 16n","note":"G4","active":false},{"time":"2n + 4n","note":"G4","active":false},{"time":"2n + 4n + 16n","note":"G4","active":false},{"time":"2n + 4n + 8n","note":"G4","active":false},{"time":"2n + 4n + 8n + 16n","note":"G4","active":false}],"$$hashKey":"object:1197"},{"note":"F4","steps":[{"time":"0","note":"F4","active":false},{"time":"16n","note":"F4","active":false},{"time":"8n","note":"F4","active":false},{"time":"8n + 16n","note":"F4","active":false},{"time":"4n","note":"F4","active":false},{"time":"4n + 16n","note":"F4","active":false},{"time":"4n + 8n","note":"F4","active":false},{"time":"4n + 8n + 16n","note":"F4","active":false},{"time":"2n","note":"F4","active":false},{"time":"2n + 16n","note":"F4","active":false},{"time":"2n + 8n","note":"F4","active":false},{"time":"2n + 8n + 16n","note":"F4","active":false},{"time":"2n + 4n","note":"F4","active":false},{"time":"2n + 4n + 16n","note":"F4","active":false},{"time":"2n + 4n + 8n","note":"F4","active":false},{"time":"2n + 4n + 8n + 16n","note":"F4","active":false}],"$$hashKey":"object:1198"},{"note":"E4","steps":[{"time":"0","note":"E4","active":false},{"time":"16n","note":"E4","active":false},{"time":"8n","note":"E4","active":false},{"time":"8n + 16n","note":"E4","active":false},{"time":"4n","note":"E4","active":false},{"time":"4n + 16n","note":"E4","active":false},{"time":"4n + 8n","note":"E4","active":false},{"time":"4n + 8n + 16n","note":"E4","active":false},{"time":"2n","note":"E4","active":false},{"time":"2n + 16n","note":"E4","active":false},{"time":"2n + 8n","note":"E4","active":false},{"time":"2n + 8n + 16n","note":"E4","active":false},{"time":"2n + 4n","note":"E4","active":false},{"time":"2n + 4n + 16n","note":"E4","active":false},{"time":"2n + 4n + 8n","note":"E4","active":false},{"time":"2n + 4n + 8n + 16n","note":"E4","active":false}],"$$hashKey":"object:1199"},{"note":"D4","steps":[{"time":"0","note":"D4","active":false},{"time":"16n","note":"D4","active":false},{"time":"8n","note":"D4","active":true},{"time":"8n + 16n","note":"D4","active":false},{"time":"4n","note":"D4","active":false},{"time":"4n + 16n","note":"D4","active":false},{"time":"4n + 8n","note":"D4","active":false},{"time":"4n + 8n + 16n","note":"D4","active":false},{"time":"2n","note":"D4","active":false},{"time":"2n + 16n","note":"D4","active":false},{"time":"2n + 8n","note":"D4","active":false},{"time":"2n + 8n + 16n","note":"D4","active":false},{"time":"2n + 4n","note":"D4","active":false},{"time":"2n + 4n + 16n","note":"D4","active":false},{"time":"2n + 4n + 8n","note":"D4","active":false},{"time":"2n + 4n + 8n + 16n","note":"D4","active":false}],"$$hashKey":"object:1200"},{"note":"C4","steps":[{"time":"0","note":"C4","active":true},{"time":"16n","note":"C4","active":false},{"time":"8n","note":"C4","active":false},{"time":"8n + 16n","note":"C4","active":false},{"time":"4n","note":"C4","active":true},{"time":"4n + 16n","note":"C4","active":false},{"time":"4n + 8n","note":"C4","active":false},{"time":"4n + 8n + 16n","note":"C4","active":false},{"time":"2n","note":"C4","active":false},{"time":"2n + 16n","note":"C4","active":false},{"time":"2n + 8n","note":"C4","active":false},{"time":"2n + 8n + 16n","note":"C4","active":false},{"time":"2n + 4n","note":"C4","active":false},{"time":"2n + 4n + 16n","note":"C4","active":false},{"time":"2n + 4n + 8n","note":"C4","active":false},{"time":"2n + 4n + 8n + 16n","note":"C4","active":false}],"$$hashKey":"object:1201"},{"note":"B3","steps":[{"time":"0","note":"B3","active":false},{"time":"16n","note":"B3","active":false},{"time":"8n","note":"B3","active":false},{"time":"8n + 16n","note":"B3","active":false},{"time":"4n","note":"B3","active":false},{"time":"4n + 16n","note":"B3","active":false},{"time":"4n + 8n","note":"B3","active":false},{"time":"4n + 8n + 16n","note":"B3","active":false},{"time":"2n","note":"B3","active":false},{"time":"2n + 16n","note":"B3","active":false},{"time":"2n + 8n","note":"B3","active":false},{"time":"2n + 8n + 16n","note":"B3","active":false},{"time":"2n + 4n","note":"B3","active":false},{"time":"2n + 4n + 16n","note":"B3","active":false},{"time":"2n + 4n + 8n","note":"B3","active":false},{"time":"2n + 4n + 8n + 16n","note":"B3","active":false}],"$$hashKey":"object:1202"},{"note":"A3","steps":[{"time":"0","note":"A3","active":false},{"time":"16n","note":"A3","active":false},{"time":"8n","note":"A3","active":false},{"time":"8n + 16n","note":"A3","active":false},{"time":"4n","note":"A3","active":false},{"time":"4n + 16n","note":"A3","active":true},{"time":"4n + 8n","note":"A3","active":false},{"time":"4n + 8n + 16n","note":"A3","active":false},{"time":"2n","note":"A3","active":false},{"time":"2n + 16n","note":"A3","active":false},{"time":"2n + 8n","note":"A3","active":false},{"time":"2n + 8n + 16n","note":"A3","active":false},{"time":"2n + 4n","note":"A3","active":false},{"time":"2n + 4n + 16n","note":"A3","active":false},{"time":"2n + 4n + 8n","note":"A3","active":false},{"time":"2n + 4n + 8n + 16n","note":"A3","active":false}],"$$hashKey":"object:1203"},{"note":"G3","steps":[{"time":"0","note":"G3","active":false},{"time":"16n","note":"G3","active":false},{"time":"8n","note":"G3","active":false},{"time":"8n + 16n","note":"G3","active":false},{"time":"4n","note":"G3","active":false},{"time":"4n + 16n","note":"G3","active":false},{"time":"4n + 8n","note":"G3","active":false},{"time":"4n + 8n + 16n","note":"G3","active":false},{"time":"2n","note":"G3","active":false},{"time":"2n + 16n","note":"G3","active":false},{"time":"2n + 8n","note":"G3","active":false},{"time":"2n + 8n + 16n","note":"G3","active":false},{"time":"2n + 4n","note":"G3","active":false},{"time":"2n + 4n + 16n","note":"G3","active":false},{"time":"2n + 4n + 8n","note":"G3","active":false},{"time":"2n + 4n + 8n + 16n","note":"G3","active":false}],"$$hashKey":"object:1204"},{"note":"F3","steps":[{"time":"0","note":"F3","active":false},{"time":"16n","note":"F3","active":false},{"time":"8n","note":"F3","active":false},{"time":"8n + 16n","note":"F3","active":false},{"time":"4n","note":"F3","active":false},{"time":"4n + 16n","note":"F3","active":false},{"time":"4n + 8n","note":"F3","active":false},{"time":"4n + 8n + 16n","note":"F3","active":false},{"time":"2n","note":"F3","active":false},{"time":"2n + 16n","note":"F3","active":false},{"time":"2n + 8n","note":"F3","active":false},{"time":"2n + 8n + 16n","note":"F3","active":false},{"time":"2n + 4n","note":"F3","active":false},{"time":"2n + 4n + 16n","note":"F3","active":false},{"time":"2n + 4n + 8n","note":"F3","active":false},{"time":"2n + 4n + 8n + 16n","note":"F3","active":false}],"$$hashKey":"object:1205"},{"note":"E3","steps":[{"time":"0","note":"E3","active":false},{"time":"16n","note":"E3","active":false},{"time":"8n","note":"E3","active":false},{"time":"8n + 16n","note":"E3","active":false},{"time":"4n","note":"E3","active":false},{"time":"4n + 16n","note":"E3","active":false},{"time":"4n + 8n","note":"E3","active":false},{"time":"4n + 8n + 16n","note":"E3","active":false},{"time":"2n","note":"E3","active":false},{"time":"2n + 16n","note":"E3","active":false},{"time":"2n + 8n","note":"E3","active":false},{"time":"2n + 8n + 16n","note":"E3","active":false},{"time":"2n + 4n","note":"E3","active":false},{"time":"2n + 4n + 16n","note":"E3","active":false},{"time":"2n + 4n + 8n","note":"E3","active":false},{"time":"2n + 4n + 8n + 16n","note":"E3","active":false}],"$$hashKey":"object:1206"},{"note":"D3","steps":[{"time":"0","note":"D3","active":false},{"time":"16n","note":"D3","active":false},{"time":"8n","note":"D3","active":false},{"time":"8n + 16n","note":"D3","active":false},{"time":"4n","note":"D3","active":false},{"time":"4n + 16n","note":"D3","active":false},{"time":"4n + 8n","note":"D3","active":false},{"time":"4n + 8n + 16n","note":"D3","active":false},{"time":"2n","note":"D3","active":false},{"time":"2n + 16n","note":"D3","active":false},{"time":"2n + 8n","note":"D3","active":false},{"time":"2n + 8n + 16n","note":"D3","active":false},{"time":"2n + 4n","note":"D3","active":false},{"time":"2n + 4n + 16n","note":"D3","active":false},{"time":"2n + 4n + 8n","note":"D3","active":false},{"time":"2n + 4n + 8n + 16n","note":"D3","active":false}],"$$hashKey":"object:1207"},{"note":"C3","steps":[{"time":"0","note":"C3","active":false},{"time":"16n","note":"C3","active":false},{"time":"8n","note":"C3","active":false},{"time":"8n + 16n","note":"C3","active":false},{"time":"4n","note":"C3","active":false},{"time":"4n + 16n","note":"C3","active":false},{"time":"4n + 8n","note":"C3","active":false},{"time":"4n + 8n + 16n","note":"C3","active":false},{"time":"2n","note":"C3","active":false},{"time":"2n + 16n","note":"C3","active":false},{"time":"2n + 8n","note":"C3","active":false},{"time":"2n + 8n + 16n","note":"C3","active":false},{"time":"2n + 4n","note":"C3","active":false},{"time":"2n + 4n + 16n","note":"C3","active":false},{"time":"2n + 4n + 8n","note":"C3","active":false},{"time":"2n + 4n + 8n + 16n","note":"C3","active":false}],"$$hashKey":"object:1208"}]},{"name":"Bassline","instDef":{"componentName":"FMSynth","polyVoices":12,"effects":[],"options":{},"buffers":null},"notes":["B2","A2","G2","F2","E2","D2","C2","B1","A1","G1","F1","E1","D1","C1"],"rows":[{"note":"B2","steps":[{"time":"0","note":"B2","active":false},{"time":"16n","note":"B2","active":false},{"time":"8n","note":"B2","active":false},{"time":"8n + 16n","note":"B2","active":false},{"time":"4n","note":"B2","active":false},{"time":"4n + 16n","note":"B2","active":false},{"time":"4n + 8n","note":"B2","active":false},{"time":"4n + 8n + 16n","note":"B2","active":false},{"time":"2n","note":"B2","active":false},{"time":"2n + 16n","note":"B2","active":false},{"time":"2n + 8n","note":"B2","active":false},{"time":"2n + 8n + 16n","note":"B2","active":false},{"time":"2n + 4n","note":"B2","active":false},{"time":"2n + 4n + 16n","note":"B2","active":false},{"time":"2n + 4n + 8n","note":"B2","active":false},{"time":"2n + 4n + 8n + 16n","note":"B2","active":false}],"$$hashKey":"object:1447"},{"note":"A2","steps":[{"time":"0","note":"A2","active":false},{"time":"16n","note":"A2","active":false},{"time":"8n","note":"A2","active":false},{"time":"8n + 16n","note":"A2","active":false},{"time":"4n","note":"A2","active":false},{"time":"4n + 16n","note":"A2","active":false},{"time":"4n + 8n","note":"A2","active":false},{"time":"4n + 8n + 16n","note":"A2","active":false},{"time":"2n","note":"A2","active":false},{"time":"2n + 16n","note":"A2","active":false},{"time":"2n + 8n","note":"A2","active":false},{"time":"2n + 8n + 16n","note":"A2","active":false},{"time":"2n + 4n","note":"A2","active":false},{"time":"2n + 4n + 16n","note":"A2","active":false},{"time":"2n + 4n + 8n","note":"A2","active":false},{"time":"2n + 4n + 8n + 16n","note":"A2","active":false}],"$$hashKey":"object:1448"},{"note":"G2","steps":[{"time":"0","note":"G2","active":false},{"time":"16n","note":"G2","active":false},{"time":"8n","note":"G2","active":false},{"time":"8n + 16n","note":"G2","active":false},{"time":"4n","note":"G2","active":false},{"time":"4n + 16n","note":"G2","active":false},{"time":"4n + 8n","note":"G2","active":false},{"time":"4n + 8n + 16n","note":"G2","active":true},{"time":"2n","note":"G2","active":false},{"time":"2n + 16n","note":"G2","active":false},{"time":"2n + 8n","note":"G2","active":false},{"time":"2n + 8n + 16n","note":"G2","active":false},{"time":"2n + 4n","note":"G2","active":false},{"time":"2n + 4n + 16n","note":"G2","active":false},{"time":"2n + 4n + 8n","note":"G2","active":false},{"time":"2n + 4n + 8n + 16n","note":"G2","active":false}],"$$hashKey":"object:1449"},{"note":"F2","steps":[{"time":"0","note":"F2","active":false},{"time":"16n","note":"F2","active":false},{"time":"8n","note":"F2","active":false},{"time":"8n + 16n","note":"F2","active":false},{"time":"4n","note":"F2","active":false},{"time":"4n + 16n","note":"F2","active":false},{"time":"4n + 8n","note":"F2","active":false},{"time":"4n + 8n + 16n","note":"F2","active":false},{"time":"2n","note":"F2","active":false},{"time":"2n + 16n","note":"F2","active":false},{"time":"2n + 8n","note":"F2","active":false},{"time":"2n + 8n + 16n","note":"F2","active":false},{"time":"2n + 4n","note":"F2","active":false},{"time":"2n + 4n + 16n","note":"F2","active":false},{"time":"2n + 4n + 8n","note":"F2","active":false},{"time":"2n + 4n + 8n + 16n","note":"F2","active":false}],"$$hashKey":"object:1450"},{"note":"E2","steps":[{"time":"0","note":"E2","active":false},{"time":"16n","note":"E2","active":false},{"time":"8n","note":"E2","active":false},{"time":"8n + 16n","note":"E2","active":false},{"time":"4n","note":"E2","active":false},{"time":"4n + 16n","note":"E2","active":false},{"time":"4n + 8n","note":"E2","active":false},{"time":"4n + 8n + 16n","note":"E2","active":false},{"time":"2n","note":"E2","active":false},{"time":"2n + 16n","note":"E2","active":false},{"time":"2n + 8n","note":"E2","active":false},{"time":"2n + 8n + 16n","note":"E2","active":false},{"time":"2n + 4n","note":"E2","active":false},{"time":"2n + 4n + 16n","note":"E2","active":false},{"time":"2n + 4n + 8n","note":"E2","active":false},{"time":"2n + 4n + 8n + 16n","note":"E2","active":false}],"$$hashKey":"object:1451"},{"note":"D2","steps":[{"time":"0","note":"D2","active":false},{"time":"16n","note":"D2","active":false},{"time":"8n","note":"D2","active":false},{"time":"8n + 16n","note":"D2","active":false},{"time":"4n","note":"D2","active":false},{"time":"4n + 16n","note":"D2","active":false},{"time":"4n + 8n","note":"D2","active":false},{"time":"4n + 8n + 16n","note":"D2","active":true},{"time":"2n","note":"D2","active":false},{"time":"2n + 16n","note":"D2","active":false},{"time":"2n + 8n","note":"D2","active":false},{"time":"2n + 8n + 16n","note":"D2","active":false},{"time":"2n + 4n","note":"D2","active":false},{"time":"2n + 4n + 16n","note":"D2","active":false},{"time":"2n + 4n + 8n","note":"D2","active":false},{"time":"2n + 4n + 8n + 16n","note":"D2","active":false}],"$$hashKey":"object:1452"},{"note":"C2","steps":[{"time":"0","note":"C2","active":false},{"time":"16n","note":"C2","active":false},{"time":"8n","note":"C2","active":true},{"time":"8n + 16n","note":"C2","active":false},{"time":"4n","note":"C2","active":false},{"time":"4n + 16n","note":"C2","active":false},{"time":"4n + 8n","note":"C2","active":false},{"time":"4n + 8n + 16n","note":"C2","active":false},{"time":"2n","note":"C2","active":false},{"time":"2n + 16n","note":"C2","active":false},{"time":"2n + 8n","note":"C2","active":false},{"time":"2n + 8n + 16n","note":"C2","active":false},{"time":"2n + 4n","note":"C2","active":false},{"time":"2n + 4n + 16n","note":"C2","active":true},{"time":"2n + 4n + 8n","note":"C2","active":false},{"time":"2n + 4n + 8n + 16n","note":"C2","active":false}],"$$hashKey":"object:1453"},{"note":"B1","steps":[{"time":"0","note":"B1","active":false},{"time":"16n","note":"B1","active":false},{"time":"8n","note":"B1","active":false},{"time":"8n + 16n","note":"B1","active":false},{"time":"4n","note":"B1","active":false},{"time":"4n + 16n","note":"B1","active":false},{"time":"4n + 8n","note":"B1","active":false},{"time":"4n + 8n + 16n","note":"B1","active":false},{"time":"2n","note":"B1","active":false},{"time":"2n + 16n","note":"B1","active":false},{"time":"2n + 8n","note":"B1","active":false},{"time":"2n + 8n + 16n","note":"B1","active":false},{"time":"2n + 4n","note":"B1","active":false},{"time":"2n + 4n + 16n","note":"B1","active":false},{"time":"2n + 4n + 8n","note":"B1","active":false},{"time":"2n + 4n + 8n + 16n","note":"B1","active":false}],"$$hashKey":"object:1454"},{"note":"A1","steps":[{"time":"0","note":"A1","active":false},{"time":"16n","note":"A1","active":false},{"time":"8n","note":"A1","active":false},{"time":"8n + 16n","note":"A1","active":false},{"time":"4n","note":"A1","active":false},{"time":"4n + 16n","note":"A1","active":false},{"time":"4n + 8n","note":"A1","active":false},{"time":"4n + 8n + 16n","note":"A1","active":false},{"time":"2n","note":"A1","active":false},{"time":"2n + 16n","note":"A1","active":false},{"time":"2n + 8n","note":"A1","active":false},{"time":"2n + 8n + 16n","note":"A1","active":false},{"time":"2n + 4n","note":"A1","active":false},{"time":"2n + 4n + 16n","note":"A1","active":false},{"time":"2n + 4n + 8n","note":"A1","active":false},{"time":"2n + 4n + 8n + 16n","note":"A1","active":false}],"$$hashKey":"object:1455"},{"note":"G1","steps":[{"time":"0","note":"G1","active":false},{"time":"16n","note":"G1","active":false},{"time":"8n","note":"G1","active":false},{"time":"8n + 16n","note":"G1","active":false},{"time":"4n","note":"G1","active":false},{"time":"4n + 16n","note":"G1","active":false},{"time":"4n + 8n","note":"G1","active":true},{"time":"4n + 8n + 16n","note":"G1","active":false},{"time":"2n","note":"G1","active":false},{"time":"2n + 16n","note":"G1","active":false},{"time":"2n + 8n","note":"G1","active":false},{"time":"2n + 8n + 16n","note":"G1","active":false},{"time":"2n + 4n","note":"G1","active":false},{"time":"2n + 4n + 16n","note":"G1","active":false},{"time":"2n + 4n + 8n","note":"G1","active":false},{"time":"2n + 4n + 8n + 16n","note":"G1","active":false}],"$$hashKey":"object:1456"},{"note":"F1","steps":[{"time":"0","note":"F1","active":false},{"time":"16n","note":"F1","active":false},{"time":"8n","note":"F1","active":false},{"time":"8n + 16n","note":"F1","active":false},{"time":"4n","note":"F1","active":false},{"time":"4n + 16n","note":"F1","active":false},{"time":"4n + 8n","note":"F1","active":false},{"time":"4n + 8n + 16n","note":"F1","active":false},{"time":"2n","note":"F1","active":false},{"time":"2n + 16n","note":"F1","active":false},{"time":"2n + 8n","note":"F1","active":false},{"time":"2n + 8n + 16n","note":"F1","active":false},{"time":"2n + 4n","note":"F1","active":false},{"time":"2n + 4n + 16n","note":"F1","active":false},{"time":"2n + 4n + 8n","note":"F1","active":false},{"time":"2n + 4n + 8n + 16n","note":"F1","active":false}],"$$hashKey":"object:1457"},{"note":"E1","steps":[{"time":"0","note":"E1","active":false},{"time":"16n","note":"E1","active":false},{"time":"8n","note":"E1","active":false},{"time":"8n + 16n","note":"E1","active":false},{"time":"4n","note":"E1","active":false},{"time":"4n + 16n","note":"E1","active":false},{"time":"4n + 8n","note":"E1","active":false},{"time":"4n + 8n + 16n","note":"E1","active":false},{"time":"2n","note":"E1","active":false},{"time":"2n + 16n","note":"E1","active":false},{"time":"2n + 8n","note":"E1","active":false},{"time":"2n + 8n + 16n","note":"E1","active":false},{"time":"2n + 4n","note":"E1","active":false},{"time":"2n + 4n + 16n","note":"E1","active":false},{"time":"2n + 4n + 8n","note":"E1","active":false},{"time":"2n + 4n + 8n + 16n","note":"E1","active":false}],"$$hashKey":"object:1458"},{"note":"D1","steps":[{"time":"0","note":"D1","active":false},{"time":"16n","note":"D1","active":false},{"time":"8n","note":"D1","active":false},{"time":"8n + 16n","note":"D1","active":false},{"time":"4n","note":"D1","active":false},{"time":"4n + 16n","note":"D1","active":false},{"time":"4n + 8n","note":"D1","active":false},{"time":"4n + 8n + 16n","note":"D1","active":false},{"time":"2n","note":"D1","active":false},{"time":"2n + 16n","note":"D1","active":false},{"time":"2n + 8n","note":"D1","active":false},{"time":"2n + 8n + 16n","note":"D1","active":false},{"time":"2n + 4n","note":"D1","active":false},{"time":"2n + 4n + 16n","note":"D1","active":false},{"time":"2n + 4n + 8n","note":"D1","active":false},{"time":"2n + 4n + 8n + 16n","note":"D1","active":false}],"$$hashKey":"object:1459"},{"note":"C1","steps":[{"time":"0","note":"C1","active":false},{"time":"16n","note":"C1","active":false},{"time":"8n","note":"C1","active":false},{"time":"8n + 16n","note":"C1","active":false},{"time":"4n","note":"C1","active":false},{"time":"4n + 16n","note":"C1","active":false},{"time":"4n + 8n","note":"C1","active":false},{"time":"4n + 8n + 16n","note":"C1","active":false},{"time":"2n","note":"C1","active":false},{"time":"2n + 16n","note":"C1","active":false},{"time":"2n + 8n","note":"C1","active":false},{"time":"2n + 8n + 16n","note":"C1","active":false},{"time":"2n + 4n","note":"C1","active":false},{"time":"2n + 4n + 16n","note":"C1","active":false},{"time":"2n + 4n + 8n","note":"C1","active":false},{"time":"2n + 4n + 8n + 16n","note":"C1","active":false}],"$$hashKey":"object:1460"}]},{"name":"Drums","instDef":{"componentName":"MultiPlayer","buffers":{"kick":"resources/kick.wav","snare1":"resources/snare1.wav","hat1":"resources/hat1.wav","clap":"resources/clap.wav","sfx":"resources/sfx.wav"},"effects":[],"options":{},"polyVoices":1},"notes":["kick","snare1","hat1","clap","sfx"],"rows":[{"note":"kick","steps":[{"time":"0","note":"kick","active":false},{"time":"16n","note":"kick","active":false},{"time":"8n","note":"kick","active":true},{"time":"8n + 16n","note":"kick","active":false},{"time":"4n","note":"kick","active":false},{"time":"4n + 16n","note":"kick","active":false},{"time":"4n + 8n","note":"kick","active":false},{"time":"4n + 8n + 16n","note":"kick","active":false},{"time":"2n","note":"kick","active":false},{"time":"2n + 16n","note":"kick","active":false},{"time":"2n + 8n","note":"kick","active":false},{"time":"2n + 8n + 16n","note":"kick","active":false},{"time":"2n + 4n","note":"kick","active":false},{"time":"2n + 4n + 16n","note":"kick","active":false},{"time":"2n + 4n + 8n","note":"kick","active":false},{"time":"2n + 4n + 8n + 16n","note":"kick","active":false}],"$$hashKey":"object:1699"},{"note":"snare1","steps":[{"time":"0","note":"snare1","active":false},{"time":"16n","note":"snare1","active":false},{"time":"8n","note":"snare1","active":false},{"time":"8n + 16n","note":"snare1","active":false},{"time":"4n","note":"snare1","active":false},{"time":"4n + 16n","note":"snare1","active":true},{"time":"4n + 8n","note":"snare1","active":false},{"time":"4n + 8n + 16n","note":"snare1","active":true},{"time":"2n","note":"snare1","active":false},{"time":"2n + 16n","note":"snare1","active":false},{"time":"2n + 8n","note":"snare1","active":false},{"time":"2n + 8n + 16n","note":"snare1","active":false},{"time":"2n + 4n","note":"snare1","active":false},{"time":"2n + 4n + 16n","note":"snare1","active":true},{"time":"2n + 4n + 8n","note":"snare1","active":false},{"time":"2n + 4n + 8n + 16n","note":"snare1","active":false}],"$$hashKey":"object:1700"},{"note":"hat1","steps":[{"time":"0","note":"hat1","active":false},{"time":"16n","note":"hat1","active":false},{"time":"8n","note":"hat1","active":false},{"time":"8n + 16n","note":"hat1","active":false},{"time":"4n","note":"hat1","active":false},{"time":"4n + 16n","note":"hat1","active":false},{"time":"4n + 8n","note":"hat1","active":false},{"time":"4n + 8n + 16n","note":"hat1","active":false},{"time":"2n","note":"hat1","active":false},{"time":"2n + 16n","note":"hat1","active":false},{"time":"2n + 8n","note":"hat1","active":false},{"time":"2n + 8n + 16n","note":"hat1","active":false},{"time":"2n + 4n","note":"hat1","active":false},{"time":"2n + 4n + 16n","note":"hat1","active":false},{"time":"2n + 4n + 8n","note":"hat1","active":false},{"time":"2n + 4n + 8n + 16n","note":"hat1","active":false}],"$$hashKey":"object:1701"},{"note":"clap","steps":[{"time":"0","note":"clap","active":false},{"time":"16n","note":"clap","active":false},{"time":"8n","note":"clap","active":true},{"time":"8n + 16n","note":"clap","active":false},{"time":"4n","note":"clap","active":false},{"time":"4n + 16n","note":"clap","active":false},{"time":"4n + 8n","note":"clap","active":false},{"time":"4n + 8n + 16n","note":"clap","active":false},{"time":"2n","note":"clap","active":true},{"time":"2n + 16n","note":"clap","active":false},{"time":"2n + 8n","note":"clap","active":false},{"time":"2n + 8n + 16n","note":"clap","active":true},{"time":"2n + 4n","note":"clap","active":false},{"time":"2n + 4n + 16n","note":"clap","active":false},{"time":"2n + 4n + 8n","note":"clap","active":false},{"time":"2n + 4n + 8n + 16n","note":"clap","active":false}],"$$hashKey":"object:1702"},{"note":"sfx","steps":[{"time":"0","note":"sfx","active":false},{"time":"16n","note":"sfx","active":false},{"time":"8n","note":"sfx","active":false},{"time":"8n + 16n","note":"sfx","active":false},{"time":"4n","note":"sfx","active":false},{"time":"4n + 16n","note":"sfx","active":false},{"time":"4n + 8n","note":"sfx","active":false},{"time":"4n + 8n + 16n","note":"sfx","active":false},{"time":"2n","note":"sfx","active":false},{"time":"2n + 16n","note":"sfx","active":false},{"time":"2n + 8n","note":"sfx","active":true},{"time":"2n + 8n + 16n","note":"sfx","active":false},{"time":"2n + 4n","note":"sfx","active":false},{"time":"2n + 4n + 16n","note":"sfx","active":false},{"time":"2n + 4n + 8n","note":"sfx","active":false},{"time":"2n + 4n + 8n + 16n","note":"sfx","active":false}],"$$hashKey":"object:1703"}]}]}'
