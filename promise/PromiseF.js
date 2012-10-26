define(["./Promise"], function (Promise) {
"use strict";

	// Requires JavaScript 1.8.5
	var defineProperty = Object.defineProperty;

	function PromiseF () {
		// summary:
		//		Implements a bear minimal promise, that is, it does not support chained
		//		thens. Therefore, the then() method does not return anything. This type
		//		of promise can be used if chaining is quarenteed not to be required.
		//		This promise is referred to as Promise/Fast or Promise/F for short and
		//		the main type of promise used by indexedDB.  (Note: Promise/F is NOT a
		//		formal name).
		// NOTE:
		//		This type of promise is intended for internal use only and as a result
		//		we don't care if the object is not froozen.
		//  tag:
		//		Public
		var complete, fulfilled, failed,
				listeners = [],
				self = this;

		function then (resolved, rejected) {
			// Register lsiteners
			listeners.push([null, resolved, rejected]);
		}

		function signalListener (which, arg) {
			// complete all callbacks
			var listener, cb, i = 0;
			while ((listener = listeners[i++])) {
				try {
					cb = listener[which];
					cb(arg);
				} catch (err) {
					// Oh well...
				}
			}
		}

		complete = function (success, arg) {
			// switch over to sync then()
			then = success ?
					function (resolved, rejected) { resolved && resolved(arg); } :
					function (resolved, rejected) { rejected && rejected(arg); };

			fulfilled = success ? 1 : 2;
			signalListener(fulfilled, arg);
			listeners = undefined;
		};

		this.then = function (resolved, rejected) {
			then(resolved, rejected);
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
	}

	// Inherit from abstract Promise.
	PromiseF.prototype = new Promise();
	PromiseF.prototype.constructor = PromiseF;

	return PromiseF;
});