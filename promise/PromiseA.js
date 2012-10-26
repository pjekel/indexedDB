define(["./Promise"], function (Promise) {
"use strict";

	// Requires JavaScript 1.8.5
	var defineProperty = Object.defineProperty;

	function PromiseA () {
		// summary:
		//		Implements a Promises/A promise effectively combining the dojo/deferred
		//		and dojo/promise/Promise functionality without the overhead of having
		//		to instantiate both.
		//  tag:
		//		Public
		var self, listeners, complete, fulfilled, failed;

		listeners = [];
		self = this;

		function noop () {};

		function then (resolved, rejected, progressed) {
			// capture calls to callbacks
			var listener = [progressed, resolved, rejected];
			listener.promise = new PromiseA();
			listeners.push(listener);
			return listener.promise;
		}

		// Promises/A supports chaining.
		function chained( promise, which, arg ) {
			switch (which) {
				case 0:
					promise.progress(arg);
					break;
				case 1:
					promise.resolve(arg);
					break;
				case 2:
					promise.reject(arg);
					break;
			}
		}

		function signalListener (which, arg) {
			// complete all callbacks
			var listener, cb, i = 0;
			while ((listener = listeners[i++])) {
				try {
					if (cb = listener[which]) {
						chained( listener.promise, which, cb(arg) );
					}
				} catch (err) {
					chained( listener.promise, 2, err );
				}
			}
		}

		complete = function (success, arg) {
			// switch over to sync then()
			then = success ?
					function (resolved, rejected) { resolved && resolved(arg); } :
					function (resolved, rejected) { rejected && rejected(arg); };

			fulfilled = success ? 1 : 2;
			// complete all callbacks
			signalListener(fulfilled, arg);
			// no more notifications
			signalListener = noop;
			complete = noop;
			// release memory
			listeners = undefined;
		};

		this.always = function (callback) {
			return then(callback, callback);
		}

		this.then = function (resolved, rejected, progressed) {
			return then(resolved, rejected, progressed);
		};

		this.resolve = function (val) {
			if (!fulfilled) {
				defineProperty( self, "resolved", {value:val, enumerable:true, writable: false});
				complete(true, val);
			}
		};

		this.reject = function (ex) {
			if (!fulfilled) {
				defineProperty( self, "rejected", {value:ex, enumerable:true, writable: false});
				complete(false, ex);
				failed = true;
			}
		};

		this.progress = function (msg) {
			signalListener(0, msg);
		}
	}

	// Inherit from abstract Promise
	PromiseA.prototype = new Promise();
	PromiseA.prototype.constructor = PromiseA;

	return PromiseA;
});