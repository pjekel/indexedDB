//
// Copyright (c) 2012, Peter Jekel
// All rights reserved.
//
//	The indexedDB implementation is released under to following two licenses:
//
//	1 - The "New" BSD License			 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//
define(["dojo/_base/lang",
				"./dom/event/EventTarget",
				"./dom/event/Event",
				"./dom/error/DOMException",
				"./dom/error/DOMError",
				"./promise/PromiseF"
			 ], function (lang, EventTarget, Event, DOMException, DOMError, Promise) {
	"use strict";

	// Requires JavaScript 1.8.5
	var defineProperty = Object.defineProperty;

	var moduleName = "indexedDB/IDBRequest";
	var requestId  = 0;

	var IDLE = 0,
			PENDING = 1,
			ACTIVE = 2,
			REPEAT = 3,
			DONE = 4;

	function IDBRequest (source, /*Function*/ method, /*Object*/ args, /*Object*/ scope) {
		// summary:
		//		Implements the IDBRequest interface.
		// source:
		// method:
		//		Method to be called when executing the IDBRequest. The method is called
		//		with two arguments as in: method(args, request);
		// args:
		//		JavaScript 'key:value' pairs object which is passed as the first argument
		//		to the method.
		// scope:
		//		The scope use when executing the method. Inside the method the 'this'
		//		object equals scope.
		// tag:
		//		Public

		var promise = new Promise();		// Need note below...
		var scope   = scope;
		var method  = method;
		var request = this;
		var args    = args;
		var done    = false;

		var successCallback;
		var successHndl;
		var errorCallback;
		var errorHndl;

		var transaction;

		EventTarget.call(this);

		this.identity = "request_" + requestId++;			// For debug purpose only...
		this.state    = IDLE;
		this.source   = source = source || null;
		this.result   = undefined;
		this.error    = undefined;

		//===================	A NOTE ON THE USE OF PROMISES ======================
		//
		//	Technically there is no need for the use of a promise with any IDBRequest
		//	as the request, by default, is event driven. Only IDBOpenRequest relies on
		//	the use of a promise on completion of the upgradeneeded event handler.
		//	However, for the time being we keep it in place in case we want to switch
		//	from an event driven model (the W3C standard) to a fully promise driven
		//	model. Whenever, if ever, the latter becomes the case we also would need
		//	to switch from a Promise/F to a Promise/A to allow for chained thens.
		//	On the other hand, removing the use of the promise would boost performance
		//	eventhough a Promise/F(ast) is already stripped to its bear minimum.
		// TODO:
		//	Peformance tests on large datasets is required to determine if the use of
		//	the promise can stay or should go.
		//
		defineProperty( this, "promise", {
			get:	function () { return promise },
			set:	function (value) { promise = value; },
			enumerable: false
		});

		defineProperty( this, "resolve", {
			get:	function () { return promise.resolve; },
			enumerable: false
		});

		defineProperty( this, "reject", {
			get:	function () { return promise.reject; },
			enumerable: false
		});
		//=========================================================================

		defineProperty( this, "done", {
			get:	function () { return done; },
			set:	function (value) {
							done = !!value;
							if (done) {
								this.state = DONE;
							}
						},
			enumerable: false
		});

		defineProperty( this, "transaction", {
			get:	function() { return transaction; },
			set:	function(value) {
							this.parentNode = value;
							transaction = value;
						},
			enumerable: true
			});

		defineProperty( this, "readyState", {
			get:	function () { return this.done ? "done" : "pending"; },
			enumerable: true
		});

		defineProperty( this, "state", {enumerable: false} );

		//=========================================================================
		// Declare the 'onsuccess' and 'onerror' event handler properties such that
		// an assignment automatically result in the event handler registration.
		//
		// example:
		//		request.onsuccess = function(event) {...};
		//
		// Alternatively the addEventListener() method can be used to register the
		// same type of event handler:
		//
		//		request.addEventListener("success", function(event) {...});

		defineProperty( this, "onsuccess", {
			get:	function() {return successCallback;},
			set:	function(callback) {
							if (typeof callback === "function") {
								if (successHndl) {
									successHndl.remove();
								}
								successHndl = this.addEventListener("success", callback);
								successCallback = callback;
							}
						},
			configurable: false,
			enumerable: true
		});

		defineProperty( this, "onerror", {
			get:	function() {return errorCallback;},
			set:	function(callback) {
							if (typeof callback === "function") {
								if (errorHndl) {
									errorHndl.remove();
								}
								errorHndl = this.addEventListener("error", callback);
								errorCallback = callback;
							}
						},
			configurable: false,
			enumerable: true
		});

		//=========================================================================
		// Private methods

		this._recycle = function(/*Function*/ newMethod, /*Object*/ newArgs, /*Object*/ newScope ) {
			// summary:
			//		Recyle the current request. Instead of creating a new IDBRequest the
			//		current request is re-used.   Recyling or re-using a request is ONLY
			//		allowed by the cursor.continue() or cursor.advance() methods.
			// newMethod:
			//		Method to be called when executing the IDBRequest. The method is called
			//		as method(args, request);
			// newArgs:
			//		JavaScript 'key:value' pairs object which is passed as the first
			//		argument to the method.
			// newScope:
			//		The scope use when executing the method. Inside the method the 'this'
			//		object equals scope.
			// tag:
			//		Private
			this.state = REPEAT;
			this.done  = false;
			method = newMethod;
			args   = newArgs;
			scope  = newScope;
		}

		this._fireSuccess = function (/*Event?*/ event, /*EventTarget[]?*/ propagationPath) {
			// summary:
			//		Fire a success event at the request.
			// event:
			//		Optional DOM style event, if specified it overwrites the default style
			//		success event.
			// propagationPath:
			//		Optional propagation path. The proprgation path is an array of DOM
			//		event targets. (see /dom/event/EventTarget.js)
			// tag:
			//		Private
			request.done     = true;
			if (request.transaction) {
				request.transaction.active = true;
			}
			var event = event || new Event("success");
			request.dispatchEvent( event, propagationPath );
			// In case of a cursor continue or advance call we must recycle the original
			// cursur request. Note, cursor.continue() and cursor.advance() are the only
			// methods allowed to set the request state to REPEAT.
			if (request.state == REPEAT) {
				request.promise = new Promise();
				request.state   = IDLE;
			}
			if (request.transaction) {
				// If any of the event handlers threw an exception we must abort the
				// transaction.
				if (event.error) {
					request.transaction._abortTransaction( request.transaction, "AbortError" );
				} else {
					request.transaction._requestDone( this );
				}
				request.transaction.active = false;
				if (request.done) {
					request.transaction = null;
				}
			}
		}

		this._fireError = function (/*Event?*/ event) {
			// summary:
			//		Fire an error event at the request.
			// event:
			//		Optional DOM style event, if specified it overwrites the default style
			//		error event.
			// tag:
			//		Private
			request.done = true;

			//Convert an instance of Error to a DOMError.
			if (request.error && request.error instanceof Error) {
				request.error = new DOMError( request.error.name, request.error.message );
			}

			if (request.transaction) {
				request.transaction.active = true;
			}
			var event = event || new Event("error", {bubbles: true, cancelable:true});
			request.dispatchEvent( event );

			if (request.transaction) {
				request.transaction.active = false;
				request.transaction = null;
			}
		}

/*
//		THE IDBRequest EXECUTION MODEL WITHOUT A PROMISE WOULD LOOK LIKE THIS:

		this._execute = function () {
			// summary:
			//		Execute a request.
			// tag:
			//		Private
			function _execMethod () {
				this.state = ACTIVE;
				try {
					var result = scope ? method.apply(scope, [args, this]) : method(args, this);
					request.result = (result !== undefined) ? result : request.result;
					request.error  = undefined;
					request._fireSuccess(null);
				} catch(err) {
					console.error(err);
					request.result = undefined;
					request.error  = error || request.error;
					request._fireError(null);
				}
			}

			if (this.state == IDLE) {
				this.state = PENDING;
				setTimeout( function () {
											_execMethod.call(request);
										}, 0 );
			} else {
				throw new DOMException("InvalidStateError");
			}
			return this;
		};
*/

//		THE IDBRequest EXECUTION MODEL WITH A PROMISE WOULD LOOK LIKE THIS:

		this._execute = function () {
			// summary:
			//		Execute a request.
			// tag:
			//		Private
			function _execMethod () {
				this.state = ACTIVE;
				try {
					var result = scope ? method.apply(scope, [args, this]) : method(args, this);
					this.resolve(result);
				} catch(err) {
					console.error(err);
					this.reject(err);
				}
			}

			if (this.state == IDLE) {
				this.promise.then(
					function (result) {
						request.result = (result !== undefined) ? result : request.result;
						request.error  = undefined;
						request._fireSuccess(null);
					},
					function (error) {
						request.result = undefined;
						request.error  = error || request.error;
						request._fireError(null);
					}
				);
				this.state = PENDING;
				setTimeout( function () {
											_execMethod.call(request);
										}, 0 );
			} else {
				throw new DOMException("InvalidStateError");
			}
			return this;
		};

		// Adjust some properties.
		defineProperty( this, "_recycle", {enumerable: false} );
		defineProperty( this, "_fireSuccess", {enumerable: false});
		defineProperty( this, "_fireError", {enumerable: false});
		defineProperty( this, "_execute", {enumerable: false} );

	}

	// Inherit from EventTarget
	IDBRequest.prototype = new EventTarget();
	IDBRequest.prototype.constructor = IDBRequest;

	return IDBRequest;

})
