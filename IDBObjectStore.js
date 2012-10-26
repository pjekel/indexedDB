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
			  "./dom/error/DOMException",
			  "./dom/event/Event",
			  "./dom/string/DOMStringList",
				"./IDBCursor",
			  "./IDBIndex",
				"./IDBKeyRange",
				"./IDBRequest",
				"./Record",
			  "./util/Keys"
			 ], function (lang, DOMException, Event, DOMStringList, Cursor, Index, KeyRange,
										 IDBRequest, Record, Keys) {
	"use strict";

	// Requires JavaScript 1.8.5
	var defineProperty = Object.defineProperty;

	var moduleName = "indexedDB/IDBObjectStore";

	// Default IDBObjectStoreParameters
	var IDBObjectStoreParameters = { autoIncrement: false,	keyPath: null };

	function IDBObjectStore(/*Database*/ database, /*DOMString*/ storeName,
													 /*IDBObjectStoreParameters*/ optionalParameters) {
		// summary:
		//		Implements the IDBDatabase interface (http://www.w3.org/TR/IndexedDB/#object-store)
		// storeName:
		//		The name of a new object store.
		// optionalParameters:
		//		The options object whose attributes are optional parameters to this function.
		//		keyPath specifies the key path of the new object store. If the attribute is
		//		null, no key path is specified and thus keys are out-of-line. autoIncrement
		//		specifies whether the object store created should have a key generator.
		//
		//		IDBObjectStoreParameters {
		//		  autoIncrement: false
		//			keyPath: null,
		//		};
		//
		// IMPORTANT:
		//		THE PRIVATE PROPERTY '_indexes' AND THE PUBLIC PROPERTY 'transaction'
		//		ARE ONLY AVAILABLE INSIDE A TRANSACTION AND ARE AUTOMATICALLY MIXED
		//		IN WHEN A NEW INSTANCE OF THE STORE IS CREATED. DO NOT DECLARE THESE
		//		PROPERTIES. (see _getinstance() for details).
		//
		// tag:
		//		Public

		var database       = database;
		var autoIndex      = 1;

		if (typeof storeName === "string") {
			var storeOptions   = lang.mixin( IDBObjectStoreParameters, optionalParameters || {});

			this._isStore      = true;
			this._records      = [];

			this.indexNames    = new DOMStringList();
			this.keyPath       = storeOptions.keyPath;
			this.autoIncrement = !!storeOptions.autoIncrement;
			this.name          = storeName;

			if (this.autoIncrement) {
				if (this.keyPath instanceof Array || this.keyPath === "") {
					throw new DOMException("InvalidAccessError", "ObjectStore KeyPath must be a string" );
				}
			}

			defineProperty( this, "autoIncrement", {writable: true});
			defineProperty( this, "keyPath", {writable: true});
			defineProperty( this, "name", {writable: false});

			defineProperty( this, "_records", {enumerable: true});
			defineProperty( this, "_isStore", {enumerable: false});

		} else {
			throw new DOMException("SyntaxError", "Name parameter is empty or missing" );
		}

		//========================================================================
		// Misc support procedures.

		function assertKey(/*any*/ key, /*Boolean*/ optional) {
			// summary:
			// key:
			// optional:
			// tag:
			//		Private
			if ((!key && !optional) || (!Keys.isValidKey(key) && !(key instanceof KeyRange))) {
				throw new DOMException("DataError", "Invalid key or key range");
			}
		}
		function assertStore(store) {
			// summary:
			// store:
			//		A IDBObjectStore.
			// tag:
			//		Private
			if ( store._destroyed || store._beingDestroyed ) {
				throw new DOMException("InvalidStateError", "Store ["+store.name+"] is destoyed");
			}
		}

		//========================================================================
		// Database operations (http://www.w3.org/TR/IndexedDB/#database-operations)

		function deleteRecord(/*IDBObjectStore*/ store, /*location*/ locator ) {
			// summary:
			//		Delete a single record from the store.
			// store:
			//		The IDBObjectStore to remove record(s) from.
			// locator:
			//		Record locator.
			// tag:
			//		Private
			var name, index;

			if (locator.record) {
				for(name in store._indexes) {
					index = store._indexes[name];
					index._deleteStoreRecord( locator.record );
				}
				store._records.splice( locator.eq, 1 );
			}
		}

		function deleteKeyRange(/*IDBObjectStore*/ store, /*any*/ key ) {
			// summary:
			//		Remove all records from store whose key is in the key range.
			// store:
			//		The IDBObjectStore to remove record(s) from.
			// key:
			//		Key identifying the record to be deleted. The key arguments can also
			//		be an IDBKeyRange.
			// tag:
			//		Private
			if( !(key instanceof KeyRange)) {
				key = IDBKeyRange.only(key);
			}
			var range   = Keys.getRange( store, key );
			var records = store._records.slice( range.ls+1, range.gt );
			var locator, i;

			if (records && records.length) {
				for (i=0; i<records.length; i++) {
					locator = Keys.search( store, records[i].key );
					if (locator.record) {
						deleteRecord( store, locator );
					}
				}
			}
		}

		function retrieveRecord(/*IDBObjectStore*/ store, /*any*/ key ) {
			// summary:
			//		Retrieve the first record from the store whose key matches key and
			//		return a locator object if found.
			// store:
			//		The IDBObjectStore to retrieve the record from.
			// key:
			//		Key identifying the record to be retrieved. The key arguments can also
			//		be an IDBKeyRange.
			// returns:
			//		A location object. (see the ./util/Keys module for detais).
			// tag:
			//		Private
			var locator;
			if (key instanceof KeyRange) {
				locator = Keys.getRange( store, key);
			} else {
				locator = Keys.search(store, key);
			}
			return locator;
		}

		function storeRecord(/*IDBObjectStore*/ store, /*any*/ value, /*any*/ key, /*Boolean*/ noOverwrite ) {
			// summary:
			//		Add a record to the store. Throws a DOMException of type ConstraintError
			//		if the key already exists and noOverwrite is set to true.
			// store:
			//		The IDBObjectStore to store the record
			// value:
			//		Record value property
			// key:
			//		Record key (optional).
			// noOverwrite:
			//		Indicates of the record associated with the key can be oeverwritten
			//		if it already exists.
			// returns:
			//		Record key.
			// tag:
			//		Private
			var objectKey = store.keyPath ? Keys.keyValue( store.keyPath, value ) : key;
			var name, index, record, recNum;

			if (objectKey) {
				if (store.autoIncrement && (typeof objectKey === "number")) {
					if (objectKey > autoIndex) {
						autoIndex = Math.floor(objectKey+1);
					}
				}
			} else {
				if (store.autoIncrement) {
					objectKey = autoIndex++;
					if (store.keyPath) {
						Keys.setValue( store.keyPath, objectKey, value );
					}
				} else {
					throw new DOMException("DataError");
				}
			}
			// Test if the key already exists.
			var locator = retrieveRecord(store, objectKey);
			if (locator.record) {
				if (noOverwrite) {
					throw new DOMException("ConstraintError");
				} else {
					deleteRecord( store, locator );
				}
			}
			// If there was a match preserve the exact record number.
			recNum = locator.record ? locator.eq : locator.gt;
			try {
				record = new Record( objectKey, lang.clone(value) );
			} catch(err) {
				throw new DOMException( "DataCloneError" );
			}
			// Index the record
			for(name in store._indexes) {
				index = store._indexes[name];
				index._addStoreRecord( record );
			}
			store._records.splice( recNum, 0, record );
			return objectKey;
		}

		//========================================================================
		// Private methods.

		this._clearRecords = function (/*IDBObjectStore*/ store ) {
			// summary:
			//		Remove all records from the store and all indexes that reference the
			//		store.
			// store:
			//		A IDBObjectStore.
			// tag:
			//		Private
			var name, index;
			for(name in store._indexes) {
				index = store._indexes[name];
				index._clear();
			}
			store._records.forEach( function (record) {
				record._destroyed = true;
			});
			store._records = [];
		}

		this._deleteKeyRange = function _deleteKeyRange(/*Object*/ kwArgs,/*IDBRequest*/ request ) {
			// summary:
			//		Delete a record from the store. This is the asynchronous entry point
			//		for the delete record store procedure.  If the store is destroyed or
			//		or in the process of being destroyed ignore the request.
			// kwArgs
			//		A JavaScript 'key:value' pairs object.
			// request:
			//		A IDBRequest
			// tag:
			//		Private
			if ( !kwArgs.store._destroyed && !kwArgs.store._beingDestroyed ) {
				deleteKeyRange( kwArgs.store, kwArgs.key );
			}
		}

		this._destroy = function _destroy() {
			// summary:
			//		Delete the object store. Method _deleteStore() is called by the
			//		IDBDatabase	deleteObjectStore() method. The store is cleared and
			//		marked ar 'destroyed'.
			// tag:
			//		Private
			this._destroyed = true;
			this._clearRecords(this);
		}

		this._getInstance = function _getInstance(/*IDBTransaction*/ transaction ) {
			// summary:
			//		Create a new instance of the store.  This method is called when a new
			//		transaction is created. Each transaction operates on its own instance
			//		of the store.
			// transaction:
			//		An IDBTransaction.
			// returns:
			//		A new IDBObjectStore instance.
			// tag:
			//		Private
			var storeInstance = lang.delegate( this, {transaction: transaction, _indexes: {}});
			var indexes       = database.getIndexByStore( this.name );
			var name;

			for (name in indexes) {
				storeInstance._indexes[name] = lang.delegate( indexes[name], {objectStore: storeInstance});
			}
			return storeInstance;
		}

		this._storeRecord = function _storeRecord(/*Object*/ kwArgs,/*IDBRequest*/ request ) {
			// summary:
			//		Add a record to the store. This is the asychronous entry point for
			//		the store record procedure.
			// kwArgs
			//		A JavaScript 'key:value' pairs object.
			// request:
			//		A IDBRequest
			// tag:
			//		Private
			assertStore(kwArgs.store);
			return storeRecord( kwArgs.store, kwArgs.value, kwArgs.key, kwArgs.noOverwrite );
		}

		defineProperty( this, "_clearRecords", {enumerable: false});
		defineProperty( this, "_deleteKeyRange", {enumerable: false});
		defineProperty( this, "_destroy", {enumerable: false} );
		defineProperty( this, "_getInstance", {enumerable: false} );
		defineProperty( this, "_setKeyPath", {enumerable: false});
		defineProperty( this, "_storeRecord", {enumerable: false});

		//========================================================================
		// Public methods

		this.add = function (/*any*/ value, /*any*/ key) {
			// summary:
			//		Add a record to the store. On successful completion the record key
			//		is returned as the result of the IDBRequest.  If a record with the
			//		same key exists a DOMException of type ConstraintError is thrown.
			// value:
			//		The value to be stored in the record.
			// key:
			//		The key used to identify the record.
			// returns:
			//		An IDBRequest object.
			// example:
			//		| var request = store.add( {name:"Bart", lastname:"Simpson"} );
			//		| request.onsuccess = function (event) {
			//		|   var key  = this.result
			//		| };
			// returns:
			//		An IDBRequest object.
			// exceptions:
			//		DataCloneError
			//		DataError
			//		InvalidStateError
			//		ReadOnlyError
			//		TransactionInactiveError
			// tag:
			//		Public

			assertStore( this );
			if (this.transaction.mode != IDBTransaction.READ_ONLY) {
				if (this.keyPath) {
					if (key || (!this.autoIncrement && !Keys.keyValue( this.keyPath, value ))) {
						throw new DOMException( "DataError");
					}
				} else {
					if (!this.autoIncrement && !key) {
						throw new DOMException( "DataError");
					}
				}
				if (key && !Keys.isValidKey(key)) {
					throw new DOMException( "DataError");
				}
				// Create a new IDBRequest and add it to the current transaction.
				var request = new IDBRequest( this, this._storeRecord,
																			{ store: this,
																				value: value,
																				key: key,
																				noOverwrite: true
																			});
				return this.transaction._queue(request);
			} else {
				throw new DOMException("ReadOnlyError");
			}
		};

		this.clear = function () {
			// summary:
			//		Clear all records from the the store and associated indexes.  This
			//		method throws a ReadOnlyError DOMException if the transaction which
			// 		this IDBObjectStore belongs to has its mode set to "readonly".
			// returns:
			//		An IDBRequest object.
			// exceptions:
			//		InvalidStateError
			//		ReadOnlyError
			//		TransactionInactiveError
			// tag:
			//		Public
			function _clear(/*Object*/ kwArgs,/*IDBRequest*/ request ) {
				assertStore(kwArgs.store);
				this._clearRecords( kwArgs.store );
			}

			assertStore( this );
			if (this.transaction.mode != IDBTransaction.READ_ONLY) {
				var request = new IDBRequest(this, _clear, { store: this });
				return this.transaction._queue(request);
			} else {
				throw new DOMException("ReadOnlyError");
			}
		};

		this.count = function (/*any?*/ key) {
			// summary:
			//		Count the total number of objects that share the key or key range and
			//		return that value as the result for the request.
			// key:
			//		Key identifying the record to be retrieved. The key arguments can also
			//		be an IDBKeyRange.
			// returns:
			//		An IDBRequest object.
			// exceptions:
			//		DataError
			//		InvalidStateError
			//		TransactionInactiveError
			// tag:
			//		Public
			function _count(/*Object*/ kwArgs,/*IDBRequest*/ request ) {
				assertStore(kwArgs.store);
				var range = Keys.getRange( kwArgs.store, kwArgs.key );
				return range.count;
			}

			assertStore( this );
			if (key) {
				if (Keys.isValidKey(key)) {
					key = IDBKeyRange.only( key );
				}
				assertKey(key);
			} else {
				key = IDBKeyRange.only();
			}
			var request = new IDBRequest( this, _count, {store: this, key: key} );
			return this.transaction._queue(request);
		};

		this.createIndex = function (/*DOMString*/ name, /*any*/ keyPath, /*IDBIndexParameters*/ optionalParameters) {
			// summary:
			//		This method creates and returns a new index with the given name and
			//		parameters in the connected database.    If this function is called
			//		from outside a "versionchange" transaction callback, a DOMException
			//		of type InvalidStateError is thrown. If an index with the same name
			//		already exists, a DOMException of type ConstraintError is thrown.
			// name:
			//		The name of a new index.
			// keyPath:
			//		The key path used by the new index.
			// optionalParameters:
			//		The options object whose attributes are optional parameters to this
			//		function. 'unique' specifies whether the index's unique flag is set.
			//		'multiEntry' specifies whether the index's multiEntry flag is set.
			// returns:
			//		An IDBIndex object.
			// exceptions:
			//		ConstraintError
			//		InvalidStateError
			//		SyntaxError
			// tag:
			//		Public
			if (this.transaction && this.transaction.mode == IDBTransaction.VERSION_CHANGE) {
				if (typeof name === "string" && Keys.isValidKey(keyPath)) {
					var dbIndex = database.createIndex( this, name, keyPath, optionalParameters );
					var index   = lang.delegate( dbIndex, {objectStore: this});
					this._indexes[name] = index;
					return index;
				}
				throw new DOMException("SyntaxError", "Name or keypath did not match the expected pattern" );
			}
			throw new DOMException( "InvalidStateError", "Method only allowed in a versionchange transaction" );
		}

		// WARNING: THE DOJO BUILD SYSTEM WILL FAIL ON 'this.delete'
		this.delete = function (/*any*/ key) {
			// summary:
			//		Delete all records that match key or are in the key range.
			// key:
			//		Key identifying the record to be deleted. The key arguments can also
			//		be an IDBKeyRange but can NOT be null.
			// returns:
			//		An IDBRequest object.
			// exceptions:
			//		ReadOnlyError
			//		TransactionInactiveError
			// tag:
			//		Public
			assertStore( this );
			if (this.transaction.mode != IDBTransaction.READ_ONLY) {
				// Key is a required parameter
				assertKey(key);
				var request = new IDBRequest( this, this._deleteKeyRange, {store:this, key: key});
				return this.transaction._queue(request);
			} else {
				throw new DOMException("ReadOnlyError");
			}
		};

		this.deleteIndex = function (/*DOMString*/ name) {
			// summary:
			//		This method destroys the index with the given name in the connected
			//		database. This method can only be called from a "versionchange"
			//		transaction callback.
			// name:
			//		The name of an existing index.
			// tag:
			//		Public
			if (this.transaction && this.transaction.mode == IDBTransaction.VERSION_CHANGE) {
				if (typeof name === "string") {
					database.deleteIndex( this.name, name );
				} else {
					throw new DOMException("DataError");
				}
			} else {
				throw new DOMException( "InvalidStateError", "Method only allowed in a versionchange transaction" );
			}
		};

		this.get = function get(/*any*/ key) {
			// summary:
			//		Get the first record that matches key. The record value is returned
			//		as the result of the IDBRequest.
			// key:
			//		Key identifying the record to be retrieved. This can also be an
			//		IDBKeyRange in which case the function retreives the first existing
			//		value in that range.
			// returns:
			//		An IDBRequest object.
			// exceptions:
			//		DataError
			//		InvalidStateError
			//		TransactionInactiveError
			// example:
			//		| var request = store.get( myKey );
			//		| request.onsuccess = function (event) {
			//		|   var value = this.result;
			//		| };
			//
			//		Alternatively:
			//
			//		| var request = store.get( myKey );
			//		| request.addEventListener( "success", function (event) {
			//		|   var value = this.result;
			//		| });
			// tag:
			//		Public
			function _get(/*Object*/ kwArgs,/*IDBRequest*/ request ) {
				assertStore(kwArgs.store);
				var locator = retrieveRecord( kwArgs.store, kwArgs.key );
				var value   = locator.record ? lang.clone( locator.record.value )  : undefined;
				return value;
			}

			assertStore( this );
			assertKey( key );

			var request = new IDBRequest( this, _get, {store:this, key: key});
			return this.transaction._queue(request);
		};

		this.index = function (/*DOMString*/ name) {
			// summary:
			//		Returns an IDBIndex representing an index that is part of the object
			//		store. Every call to this function on the same IDBObjectStore instance
			//		and with the same name returns the same IDBIndex instance. However the
			//		retured IDBIndex instance is specific to this IDBObjectStore instance
			// name:
			//		The name of an existing index.
			// returns:
			//		An IDBIndex object
			// exceptions:
			//		InvalidStateError
			//		NotFoundError
			// tag:
			//		Public
			var index;

			assertStore( this );
			if (index = this._indexes[name]) {
				if (index._destroyed || (!this.transaction || this.transaction.done)) {
					throw new DOMException("InvalidStateError");
				}
			} else {
				throw new DOMException("NotFoundError");
			}
			return index;
		}

		this.openCursor = function (/*any*/ range, /*DOMString*/ direction) {
			// summary:
			//		Open a new cursor. A cursor is a transient mechanism used to iterate
			//		over multiple records in the store.
			// range:
			//		The key range to use as the cursor's range.
			// direction:
			//		The cursor's required direction.
			// returns:
			//		An IDBRequest object.
			// exceptions:
			//		DataError
			//		InvalidStateError
			//		TypeError
			//		TransactionInactiveError
			// example:
			//		| var request = store.openCursor();
			//		| request.onsuccess = function (event) {
			//		|   var cursor = this.result;
			//		|   if (cursor) {
			//		|       ...
			//		|     cursor.continue();
			//		|   }
			//		| };
			// tag:
			//		Public
			var range = range || null;

			assertStore( this );
			if (range) {
				assertKey(range);
				if (Keys.isValidKey(range)) {
					range = IDBKeyRange.only( range );
				}
				assertKey(range);
			}
			var cursor  = new Cursor( this, range, direction, false );
			var request = new IDBRequest( this, cursor._iterate, null, cursor);
			return this.transaction._queue(request);
		};

		this.put = function (/*Object*/value, /*any*/ key) {
			// summary:
			//		Add a record to the store. On successful completion the record key
			//		is returned as the result of the IDBRequest.  If a record with the
			//		same key exists the record is overwritten otherwise a	new record is
			//		created.
			// value:
			//		The value to be stored in the record.
			// key:
			//		The key used to identify the record.
			// returns:
			//		An IDBRequest object.
			// example:
			//		| var request = store.add( {name:"Bart", lastname:"Simpson"} );
			//		| request.onsuccess = function (event) {
			//		|   var key  = this.result
			//		| };
			// exceptions:
			//		DataCloneError
			//		DataError
			//		InvalidStateError
			//		ReadOnlyError
			//		TransactionInactiveError
			// tag:
			//		Public
			assertStore( this );
			if (this.transaction.mode != IDBTransaction.READ_ONLY) {
				if (this.keyPath) {
					if (key || (!this.autoIncrement && !Keys.keyValue( this.keyPath, value ))) {
						throw new DOMException( "DataError");
					}
				} else {
					if (!this.autoIncrement && !key) {
						throw new DOMException( "DataError");
					}
				}
				if (key && !Keys.isValidKey(key)) {
					throw new DOMException( "DataError");
				}
				var request = new IDBRequest( this, this._storeRecord,
																			{ store: this,
																			  value: value,
																				key: key,
																				noOverwrite: false
																			});
				return this.transaction._queue(request);
			} else {
				throw new DOMException("ReadOnlyError");
			}
		};

	}

	return IDBObjectStore;

});
