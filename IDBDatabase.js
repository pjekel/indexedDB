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
				"./dom/event/EventDefault",
				"./dom/event/EventTarget",
				"./dom/event/Event",
				"./dom/string/DOMStringList",
				"./IDBObjectStore",
				"./IDBTransaction"
			 ], function (DOMException, EventDefault, EventTarget, Event, DOMStringList,
										 IDBObjectStore, Transaction) {

	// Requires JavaScript 1.8.5
	var defineProperty = Object.defineProperty;
	var freezeObject   = Object.freeze;

	var connId = 1;

	// Register a default action for the 'versionchange' event type.
	EventDefault.before( "versionchange",
		function(event) {
			var listeners = this._getEventListener("versionchange");
			if (!listeners || listeners.length == 0) {
				console.warn("No 'versionchange' event handler registered, connection is forced to closed.");
				this.close();
			}
		}
	);

	function IDBDatabase(/*Database*/ database ) {
		// summary:
		//		This method implements the IDBDatabase interface.	A IDBdatabase object
		//		can be used to manipulate the objects of that database. It is also the
		//		only way to obtain a transaction for that database.
		//		A IDBDatabase object represents a connection with the database NOT the
		//		database itself.
		// database:
		//		Database to connect to.
		// returns:
		//		An IDBDatabase object.
		// tag:
		//		Public

		var closePending = false;
		var database     = database;
		var connection   = this;
		var version      = database.version;
		var open         = true;

		var versionChangeCallback;
		var versionChangeHndl;
		var abortCallback;
		var abortHndl;
		var errorCallback;
		var errorHndl;

		EventTarget.call(this);		// Inherit from EventTarget

		defineProperty( this, "_database", {
			get:	function () { return database; },
			enumerable: false
		});

		this.objectStoreNames = database.getStoreNames();
		this.identity = "dbconn_" + connId++;		// For debug purpose only.
		this.version  = database.version;
		this.name     = database.name;

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
			enumerable: true
		});

		defineProperty( this, "onversionchange", {
			get:	function() {return versionChangeCallback;},
			set:	function(callback) {
							if (typeof callback === "function") {
								if (versionChangeHndl) {
									versionChangeHndl.remove();
								}
								versionChangeHndl = this.addEventListener("versionchange", callback);
								versionChangeCallback = callback;
							}
						},
			configurable: false,
			enumerable: true
		});

		//=========================================================================

		function closeFinal() {
			// summary:
			//		Checks if there are any active or pending transactions for this
			//		connection. If not, the connection is set to closed and the 'closed'
			//		event is fired. The closed event is listened for by the IDBFactory.
			// tag:
			//		Private
			var transPending = IDBWorker.getTransactions(this);
			if (transPending.length == 0) {
				closePending = false;
				open = false;
				new Event( "closed" ).dispatch(this);
				console.info( "Connection closed...");
			} else {
				console.log( "Transactions pending...");
			}
		}

		function onDone (/*Event*/ event) {
			// summary:
			//		This is the transaction 'done' event handler. Whenever a transaction
			//		for this connection is done, that is, it finished or is aborted, the
			//		closePending state is checked. (Note: this event handler is registered
			//		for the bubble phase so we know we are last in line to get the event).
			// event:
			//		DOM style event.
			// tag:
			//		Private
			if (closePending) {
				closeFinal.call(this);
			}
		}

		//=========================================================================
		// Private methods

		this._getObjectStore = function (/*String*/ name) {
			// summary:
			//		Returns an IDBObjectStore representing an object store.
			// name:
			//		Name of the requested object store.
			// tag:
			//		Private
			var dbStores = database.getStores(name);
			return dbStores[name];
		}

		this._isOpen = function() {
			// summary:
			//		Returns true if the connection is considered 'open' otherwise false.
			// returns:
			//		Boolean, true or false.
			// tag:
			//		Public
			return closePending ? false : open;
		}

		defineProperty( this, "_getObjectStore", {enumerable: false});
		defineProperty( this, "_isOpen", {enumerable: false});

		//=========================================================================
		// Public methods

		this.close = function () {
			// summary:
			//		This method returns immediately and performs the steps for closing a
			//		database connection.
			// tag:
			//		Public
			closePending = true;
			closeFinal.call(this);
		};

		this.createObjectStore = function (/*DOMString*/ name, /*optionalParameters*/ objectStoreParameters) {
			// summary:
			//		This method creates and returns a new object store with the given name
			//		in the connected database. If this function is called from outside a
			//		"versionchange" transaction callback, an InvalidStateError DOMException
			//		is thrown.  If an objectStore with the same name already exists, a DOM
			//		exception of type ConstraintError is thrown
			// name:
			//		The name of a new object store
			// objectStoreParameters:
			//		The options object whose attributes are optional parameters to this
			//		function. keyPath specifies the key path of the new object store.
			//		autoIncrement specifies whether the object store created should have
			//		a key generator.
			// returns:
			//		a IDBObjectStore object.
			// tag:
			//		Public
			var transaction = IDBWorker.getVCTransaction(database);
			if (transaction && transaction.callback == this.createObjectStore.caller) {
				if (this._isOpen()) {
					if (typeof name !== "string") {
						throw new DOMException("DataError", "Store name must be a string.");
					}
					var store = database.createStore( name, objectStoreParameters );
					this.objectStoreNames = database.getStoreNames();
					var storeInstance = store._getInstance( transaction );
					return storeInstance;
				} else {
					throw new DOMException( "InvalidStateError", "Connection is closed." );
				}
			} else {
				throw new DOMException( "InvalidStateError", "Method only allowed in a versionchange transaction" );
			}
		}

		this.deleteObjectStore = function (/*DOMString*/ name) {
			// summary:
			//		This method destroys the object store with the given name in the
			//		connected database.   If this function is called from outside a
			//		"versionchange" transaction callback it throws a DOMException of
			//		type InvalidStateError.
			// name:
			//		The name of an existing object store.
			// tag:
			//		Public
			var transaction = IDBWorker.getVCTransaction(database);
			if (transaction && transaction.callback == this.deleteObjectStore.caller) {
				if (this._isOpen()) {

					database.deleteStore(name);
					this.objectStoreNames = database.getStoreNames();

				} else {
					throw new DOMException( "InvalidStateError", "Connection is closed." );
				}
			} else {
				throw new DOMException( "InvalidStateError", "Method only allowed in a versionchange transaction" );
			}
		}

		this.transaction = function (/*any*/ storeNames, /*DOMString*/ mode) {
			// summary:
			//		The method creates and returns an IDBTransaction object representing
			//		the transaction.  If this method is called on IDBDatabase object for
			//		which a "versionchange" transaction is still running, a DOMException
			//		of type InvalidStateError is thrown.
			// storeNames:
			// 		The names of object stores in the scope of the new transaction.
			// mode:
			//		The mode for isolating access to data inside the given object stores.
			//		If this parameter is omitted, the default access mode is "readonly".
			// returns:
			//		An IDBTransaction object
			// tag:
			//		Public
			if (this._isOpen()) {
				if (!IDBWorker.getVCTransaction(database)) {
					return new Transaction( this, storeNames, mode );
				} else {
					throw new DOMException("InvalidStateError", "Versionchange transaction still running.");
				}
			} else {
				throw new DOMException("InvalidStateError", "Connection is closed or closing.");
			}
		}

		// Register event handler for transaction completion (good or bad).
		this.addEventListener( "done", onDone );
	}

	// Inherit from EventTarget
	IDBDatabase.prototype = new  EventTarget();
	IDBDatabase.prototype.constructor = IDBDatabase;

	return IDBDatabase;

});
