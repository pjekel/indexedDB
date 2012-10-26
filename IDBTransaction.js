//
// Copyright (c) 2012, Peter Jekel
// All rights reserved.
//
//	The indexedDB implementation is released under to following two licenses:
//
//	1 - The "New" BSD License			 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//
define(["./dom/error/DOMException",
				"./dom/error/DOMError",
				"./dom/event/EventTarget",
				"./dom/event/Event",
				"./dom/string/DOMStringList"
			 ], function (DOMException, DOMError, EventTarget, Event, DOMStringList) {
	"use strict";

	// Requires JavaScript 1.8.5
	var defineProperty = Object.defineProperty;

	var moduleName = "indexedDB/Transaction";
	var transactionId = 1;
	var IDLE = 0,
			PENDING = 1,
			ACTIVE = 2;

	function IDBTransaction (/*IDBDatabase*/ connection, /*any*/ storeNames, /*String*/ mode ) {
		// summary:
		//		Implements the IDBTransaction interface
		// connection:
		//		The IDBDatabase with which the transaction will be assocaited.
		// storeNames:
		//		The names of object stores in the scope of the new transaction.
		// mode:
		//		The mode for isolating access to data inside the given object stores.
		//		If this parameter is not provided, the default access mode is "readonly".
		// tag:
		//		Public

		// Only IDBEnvironment calls IDBTransaction without arguments to create the
		// global IDBTransaction instance which merely declares the transaction modes.
		if (arguments.length == 0) {
			this.VERSION_CHANGE = "versionchange";
			this.READ_WRITE     = "readwrite";
			this.READ_ONLY      = "readonly";
			return;
		}

		EventTarget.call(this);			// Inherit from EventTarget

		var IDBModes    = window.IDBTransaction;
		var transaction = this;
		var requestList = [];

		var abortCallback;
		var abortHndl;
		var completeCallback;
		var completeHndl;
		var errorCallback;
		var errorHndl;
		var done = false;
		var db;

		this._request    = null;
		this._scope      = {};
		this._aborted    = false;
		this._running    = false;

		defineProperty( this, "_done", {
			get:	function () { return done; },
			set:	function (value) {
							this.active = false;
							if (!done && value) {
								done = value;		// Update done flag before firing the event.
								new Event("done", {bubbles:true}).dispatch(this);
							}
							done = value;
						},
			enumerable: false
		});

		this.identity = "trans_" + transactionId++;
		this.active   = true;

		defineProperty( this, "db", {
			get:	function () {return db;},
			set:	function (dbConn) {
							this.parentNode = dbConn;
							db = dbConn;
						},
			configurable: false,
			enumerable: true
		});

		//=========================================================================
		// Define the event handler properties such that an assignment of those properties
		// automatically results in the registration of the event handler.

		defineProperty( this, "onabort", {
			get:	function() {return abortCallback;},
			set:	function(callback) {
							if (typeof callback === "function") {
								if (abortHndl) {
									abortHndl.remove();
								}
								abortHndl = this.addEventListener("abort", callback);
								abortCallback = callback;
							}
						},
			configurable: false,
			enumerable: true
		});

		defineProperty( this, "oncomplete", {
			get:	function() {return completeCallback;},
			set:	function(callback) {
							if (typeof callback === "function") {
								if (completeHndl) {
									completeHndl.remove();
								}
								completeHndl = this.addEventListener("complete", callback);
								completeCallback = callback;
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

		defineProperty( this, "_aborted", {enumerable:false, writable: true});
		defineProperty( this, "_running", {enumerable:false, writable: true});
		defineProperty( this, "_request", {enumerable:false, writable: true});
		defineProperty( this, "_scope", {enumerable:false, writable: true});
		defineProperty( this, "_timeout", {enumerable:false, writable: true, configurable: true});

		defineProperty( this, "identity", {enumerable:true});

		//========================================================================

		function executeTask() {
			// summary:
			//		Start executing the next idle IDBRequest in line.
			// tag:
			//		Private
			var request = requestList.filter( function(request) {
											 return (request.state == IDLE);
										 })[0];
			if (request) {
				transaction._request = request;
				request._execute();
				return request;
			}
			return null;
		}

		function onAbort(/*Event*/ event) {
			// summary:
			//		The local 'onabort' event handler.
			// event:
			//		DOM style event
			// tag:
			//		Private
console.info("Transaction ["+this.identity+"] aborted.");
			requestList  = [];
			this._running = false;
			this._done    = true;
			this._scope   = [];
		}

		function onComplete(/*Event*/ event) {
			// summary:
			//		The local 'oncomplete' event handler.
			// event:
			//		DOM style event
			// tag:
			//		Private
// console.info("Transaction ["+this.identity+"] complete.");
			requestList  = [];
			this._running = false;
			this._done    = true;
			this._scope   = [];
		}

		function onError(/*Event*/ event) {
			// summary:
			//		The 'onerror' event handler.
			// event:
			//		DOM style event
			// tag:
			//		Private
			if (!this._aborted) {
				this._abortTransaction( transaction, event.target.error );
			}
			event.stopPropagation();
		}

		//========================================================================
		// Private methods

		this._abortTransaction = function(/*IDBTransaction*/ transaction, /*any*/ error ) {
			// summary:
			//		Abort a transaction. Any request, idle or active, is notified
			// tag:
			//		Private
			if (!transaction._aborted && !transaction._done) {
				transaction.error = error ? ((error instanceof Error) ? error : new DOMError( error )) : null;
				transaction._aborted = true;
				requestList.forEach( function(request) {
					if (!request.done) {
						request.reject( new DOMError("AbortError") );
					}
				});

				// TODO: rollback...

				new Event("abort", {bubbles:true}).dispatch(transaction);
			}
		}

		this._commit = function () {
			// summary:
			//		Commit the transaction
			//
			// IMPORTANT:
			//		BEFORE FIRING THE 'COMPLETE'EVENT WE  MUST CHECK ONE MORE TIME IF THE
			//		TRANSACTION HAS NOT BEEN ABORTED. THIS IS ESPECIALLY IMPORTANT IN CASE
			//		OF A VERSIONCHANGE TRANSACTION. FOR EXAMPLE; WHEN CREATING AN INDEX ON
			//		AN EXISITNG STORE THE CREATION OF THE INDEX MAY BE SUCCESSFUL BUT DUE
			//		TO INDEX CONTRAINTS THE INDEXING OF THE EXISTING DATA MAY FAIL IN WHICH
			//		CASE THE TRANSACTION IS STILL ABORTED.
			//
			// tag:
			//		Private

			// TODO: commit transaction....

			setTimeout( function () {
				if (!transaction._aborted) {
					new Event("complete").dispatch(transaction);
				}
			}, 0);
		}

		this._queue = function (/*IDBRequest*/ request ) {
			// summary:
			//		Add a request to the transaction. If the transaction is not active
			//		a DOMException is raised. If the transaction is running and there
			//		is no active request start the new request immediately.
			// request:
			//		An IDBRequest
			// tag:
			//		Private
			if ( !(this._done || this._aborted) && this.active) {
				request.transaction = this;
				requestList.push(request);
				if (this._running) {
					var active = requestList.filter( function(queued){
													return (queued.state != IDLE); }
												)[0];
					if (!active) {
						this._request = request;
						request._execute();
					}
				}
				if (this._timeout) {
					clearTimeout( this._timeout );
					delete this._timeout;
				}
				return request;
			} else {
				throw new DOMException("TransactionInactiveError");
			}
		}

		this._requestDone = function (/*IDBRequest*/ request ) {
			// summary:
			//		This method is called whenever a IDBRequest has finished execution.
			//		If there are no more idle requests the transaction is 'committed'
			//		and considered finished.
			// request:
			//		The IDBRequest that finished.
			// tag:
			//		Private
			if (!this._aborted){
				if (!executeTask()) {
					this._commit();
				}
			}
			if (this._timeout) {
				clearTimeout( this._timeout );
				delete this._timeout;
			}
		}

		this._start = function () {
			// summary:
			//		Start the transaction. This method MUST only be called by the global
			//		transaction manager IDBWorker.
			//
			// NOTE:
			//		Although this module implements the asynchronous API a timer is started
			//		just in case no requests are queued within 5 seconds for this transaction
			//		otherwise the transaction could block all other processing indefinitly.
			//
			// tag:
			//		Private
			if ( !(this._aborted ||this._done) ){
				if (requestList.length == 0) {
					transaction._timeout = setTimeout( function() {
						transaction._abortTransaction( transaction, "TimeoutError" );
					}, 5000);
				}
				setTimeout( function () {
					new Event("start").dispatch(transaction)
				}, 0 );

				this._running = true;
				executeTask();
			}
		}

		defineProperty( this, "_abortTransaction", {enumerable: false} );
		defineProperty( this, "_start", {enumerable: false} );
		defineProperty( this, "_requestDone", {enumerable: false} );
		defineProperty( this, "_queue", {enumerable: false} );
		defineProperty( this, "_commit", {enumerable: false} );

		//=========================================================================
		// Public methods.

		this.abort = function () {
			// summary:
			//		Abort the transaction
			// tag:
			//		Public
			if ( !(this._done || this._aborted) ) {
				this.active  = false;
				this._abortTransaction( transaction, null );

			} else {
				throw new DOMError("InvalidStateError", "Transaction already committed or aborted.");
			}
		}

		this.objectStore = function (/*String*/ name ) {
			// summary:
			//		Returns an IDBObjectStore representing an object store that is part
			//		of the scope of this transaction.
			// name:
			//		The name of the requested object store.
			// tag:
			//		Public
			var store = this._scope[name];
			if (store) {
				if (store._destoyed || (this._done || this._aborted)) {
					throw new DOMException("InvalidStateError");
				}
			} else {
				throw new DOMException("NotFoundError");
			}
			return store;
		}

		//=========================================================================

		if (connection) {
			if (!connection._isOpen()) {
				throw new DOMException("InvalidStateError");
			}
			this.db = connection;
		} else {
			throw new Error(moduleName+"(): Connection parameter required." );
		}

		switch(mode) {
			case undefined:
				mode = IDBModes.READ_ONLY;
			case IDBModes.READ_ONLY:
			case IDBModes.READ_WRITE:
			case IDBModes.VERSION_CHANGE:
				break;
			default:
				throw new TypeError(moduleName+"(): Invalid mode specified." );
				break;
		}
		this.mode = mode;

		// Convert storeNames to an array of strings. The storeNames parameter can be
		// either a DOMStringList, a string of comma separated store names or an array
		// of store name strings.
		if (storeNames) {
			if (storeNames instanceof DOMStringList) {
				storeNames = storeNames.toArray();
			} else if (typeof storeNames === "string") {
				storeNames = storeNames.split(",");
			} else if (!(storeNames instanceof Array)) {
				throw new DOMException( "DataError" );
			}
		} else {
			storeNames = [];
		}
		if (storeNames.length > 0 || mode == IDBModes.VERSION_CHANGE) {
			storeNames.forEach( function(storeName) {
				var objectStore = this.db._getObjectStore(storeName);
				if (objectStore) {
					this._scope[storeName] = objectStore._getInstance(this);
				} else {
					throw new DOMException( "NotFoundError" );
				}
			}, this);
		} else {
			throw new DOMException( "InvalidAccessError" );
		}

		// Add private event listeners
		this.addEventListener("complete", onComplete );
		this.addEventListener("error", onError );
		this.addEventListener("abort", onAbort );

		// Hand transaction off to the IDBWorker.
		IDBWorker.postMessage( this, false );

	}

	// Inherit from EventTarget
	IDBTransaction.prototype = new EventTarget();
	IDBTransaction.prototype.constructor = IDBTransaction;

	return IDBTransaction;

});
