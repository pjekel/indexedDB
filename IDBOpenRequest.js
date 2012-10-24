//
// Copyright (c) 2012, Peter Jekel
// All rights reserved.
//
//	The indexedDB implementation is released under to following two licenses:
//
//	1 - The "New" BSD License			 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//
define (["dojo/Deferred",
				 "./dom/event/Event",
				 "./dom/event/EventDefault",
				 "./IDBRequest"
				], function (Deferred, Event, EventDefault, IDBRequest) {
	"use strict";

	// Requires JavaScript 1.8.5
	var defineProperty = Object.defineProperty;

	var IDLE = 0,
			PENDING = 1,
			ACTIVE = 2;

	// Register the default actions for the 'upgradeneeded' event.

	EventDefault.before( "upgradeneeded",
		function(event) {
			// Save the upgradeneeded callback on the transaction so createObjectStore()
			// and createIndex() can validate if they are being called in the correct
			// context, that is, from inside a 'versionchange' transaction. (Note: Only
			// one 'upgradeneeded' event handler per request is supported).
			var listener = this._getEventListener("upgradeneeded");
			if (listener && listener.length > 0) {
				this.transaction.callback = listener[0].handleEvent;
			}
			this.transaction.active = true;
		});

	EventDefault.after( "upgradeneeded",
		function(event) {
			// If the onupgradeneeded event handler threw an error it is caught by
			// the event dispatcher and the error condition is stored as part of the
			// original event otherwise the IDBOpenRequest is resolved.
			delete this.transaction.callback;
			this.transaction.active = false;
			if (event.error) {
				this.reject(event.error);
			} else {
				this.resolve();
			}
		});

	function IDBOpenRequest(/*any*/ source, /*Function*/ method, /*Object*/ args, /*context*/ scope) {
		// summary:
		//		Implements the IDBOpenRequest interface
		// source:
		//		The source of the request. For IDBOpenRequest's this should be null.
		// method:
		//		Method to be called when executing the IDBPoenRequest. The method is
		//		called with two arguments as in: method(args, request);
		// args:
		//		JavaScript 'key:value' pairs object which is passed as the first argument
		//		to the method.
		// scope:
		//		The scope use when executing the method. Inside the method the 'this'
		//		object equals scope.
		// tag:
		//		Private

		// IDBOpenRequest inherits from IDBRequest
		IDBRequest.call(this, source, method, args, scope);

		var request         = this;

		var upgradeCallback = null;
		var upgradeHndl     = null;
		var blockedCallback = null;
		var blockedHndl     = null;

		defineProperty( this, "onupgradeneeded", {
			get:	function() {return upgradeCallback;},
			set:	function(callback) {
							if (typeof callback === "function") {
								if (upgradeHndl) {
									upgradeHndl.remove();
								}
								upgradeHndl = this.addEventListener("upgradeneeded", callback);
								upgradeCallback = callback;
							}
						},
			configurable: false,
			enumerable: true
		});

		defineProperty( this, "onblocked", {
			get:	function() {return blockedCallback;},
			set:	function(callback) {
							if (typeof callback === "function") {
								if (blockedHndl) {
									blockedHndl.remove();
								}
								blockedHndl = this.addEventListener("blocked", callback);
								blockedCallback = callback;
							}
						},
			configurable: false,
			enumerable: true
		});

		this._execute = function () {
			// summary:
			//		Execute a request.
			// tag:
			//		Private
			function execMethod () {
				this.state = ACTIVE;
				try {
					var result = scope ? method.apply(scope, [args, this]) : method(args, this);
				} catch(err) {
					console.error(err);
					this.reject(err);
				}
			}

			// NOTE:
			//	In contrast to a regular IDBRequest, the 'success' event is NOT fired
			// 	at the IDBOpenRequest until the versionchange transaction has finished
			//	therefore the firing of the 'success' event is handled by IDBFactory.

			if (this.state == IDLE) {
				this.deferred.then(
					function (result) {
						request.result = (result !== undefined) ? result : request.result;
						request.error  = undefined;
						if (request.transaction) {
							request.transaction._requestDone( request );
							request.transaction = null;
						}
					},
					function (error) {
						request.result = undefined;
						request.error  = error;
						request._fireError(null);
					}
				);
				this.state = PENDING;
				setTimeout( function () {
											execMethod.call(request);
										}, 0 );
			} else {
				throw new DOMException("InvalidStateError");
			}
			return this;
		};

	} /* end IDBOpenRequest() */

	// Inherit from IDBRequest
	IDBOpenRequest.prototype = new IDBRequest();
	IDBOpenRequest.prototype.constructor = IDBOpenRequest;

	return IDBOpenRequest;

});