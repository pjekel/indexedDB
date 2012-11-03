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
				"./IDBCursor",
				"./IDBKeyRange",
				"./IDBRequest",
			  "./Record",
			  "./util/Keys"
			 ], function (lang, DOMException, Event, Cursor, KeyRange, IDBRequest, Record, Keys) {
	"use strict";

	// Requires JavaScript 1.8.5
	var defineProperty = Object.defineProperty;

	var moduleName = "indexedDB/IDBIndex";

	var IDBIndexParameters = { unique: false, multiEntry: false };

	function IDBIndex (/*IDBObjectStore*/ store, /*DOMString*/ name, /*any*/ keyPath, optionalParameters) {
		// summary:
		//		Implements the IDBIndex interface (http://www.w3.org/TR/IndexedDB/#index)
		// store:
		//		A IDBObjectStore object which is the parent of the new index.
		// name:
		//		The name of a new index.
		// keyPath:
		//		The key path used by the new index.
		// optionalParameters:
		//		The options object whose attributes are optional parameters to this
		//		function. unique specifies whether the index's unique flag is set.
		//		multiEntry specifies whether the index's multiEntry flag is set.
		//
		//		IDBIndexParameters {
		//			unique: false,
		//			multiEntry: false
		//		}
		//
		// IMPORTANT:
		//		The index property 'objectStore' is ONLY available inside a transaction
		//		and is automatically mixed in when a new instance of the parent store
		//		is created. Therefore, do NOT declare the 'objectStore' property.
		//
		// tag:
		//		Public

		if (typeof name === "string" && keyPath && store) {
			var indexOptions   = lang.mixin( IDBIndexParameters, optionalParameters || {});

			// If keyPath is and Array and the multiEntry property is true throw an
			// exception of type NotSupportedError.
			if (keyPath instanceof Array && !!indexOptions.multiEntry) {
				throw new DOMException("NotSupportedError", "KeyPath cannot be an array when multiEntry is enabled");
			}
			this._isIndex    = true;
			this._records    = [];

			this.name        = name;
			this.keyPath     = keyPath || null;

			this.multiEntry = !!indexOptions.multiEntry;
			this.unique     = !!indexOptions.unique;

			defineProperty( this, "keyPath", {writable: false} );
			defineProperty( this, "store", {writable: false} );
			defineProperty( this, "name", {writable: false} );
			defineProperty( this, "multiEntry", {writable: false} );
			defineProperty( this, "unique", {writable: false} );

			defineProperty( this, "_isIndex", {enumerable: false} );
			defineProperty( this, "_records", {enumerable: true} );

		} else {
			throw new DOMException( "SyntaxError" );
		}

		//=========================================================================

		function assertIndex(/*IDBIndex*/ index) {
			// summary:
			//		Validate if the index and associated store have not been destroyed.
			// index:
			//		Index to assert, typically the thisObject.
			// tag:
			//		Private
			if ( index._destroyed || index.objectStore._destroyed || index.objectStore._beingDestroyed ) {
				throw new DOMException("InvalidStateError");
			}
		}

		function assertKey(/*any?*/ key, /*Boolean*/ optional) {
			// summary:
			//		Validate if a key is a valid key or key range
			// key:
			//		Key to assert.
			// optional:
			//		Indicate if the key is optional.
			// tag:
			//		Private
			if ((!key && !optional) || (!Keys.isValidKey(key) && !(key instanceof KeyRange))) {
				throw new DOMException("DataError", "Invalid key or key range");
			}
		}

		function addIndexRecord(/*IDBIndex*/ index, /*any*/ indexKey, /*any*/ storeKey ) {
			// summary:
			//		Add a new record to the index.
			// index:
			//		Index to which the record is added.
			// record:
			//		Index Record to insert.
			// tag:
			//		Private
			var locator = Keys.search(index, indexKey);

			if (locator.record) {
				locator.record.value.push(storeKey);
				locator.record.value.sort();
			} else {
				var record = new Record( indexKey, [storeKey]);
				index._records.splice(locator.gt, 0, record);
			}
		}

		//=========================================================================
		// Database operations (http://www.w3.org/TR/IndexedDB/#database-operations)

		function retrieveIndexValue(/*IDBIndex*/ index, /*any*/ key ) {
			// summary:
			//		Retrieve the value of an index record.
			// index:
			//		Index to retrieve the value from, typically the thisObject.
			// key:
			//		Index key.
			// tag:
			//		Private
			var locator;
			if (key instanceof KeyRange) {
				locator = Keys.getRange(index, key);
			} else {
				locator = Keys.search(index, key);
			}
			if (locator.record) {
				return locator.record.value[0];
			}
		}

		function retrieveReferenceValue(/*IDBIndex*/ index, /*any*/ key ) {
			// summary:
			//		Retrieve the referenced value from a store and return a structured
			//		clone.
			// index:
			//		Index to retrieve the value from, typically the thisObject.
			// key:
			//		Index key.
			// tag:
			//		Private
			var indexValue = retrieveIndexValue( index, key );
			if (indexValue) {
				var record = Keys.search( index.objectStore, indexValue ).record;
				if (record) {
					return lang.clone( record.value );
				} else {
					// TODO: should not happen, it would indicate the index and store are
					//			 out of sync...
				}
			}
		}

		//=========================================================================
		// Private methods

		this._addStoreRecord = function (/*Record*/ storeRecord ) {
			// summary:
			//		Add an index entry for the store record. If the index key is an array
			//		and multiEntry is enabled an index entry is created for each element
			//		in the index key array. If the index key already exists and unique is
			//		true a DOMException of type ConstraintError is thrown.
			// storeRecord:
			//		Store record to index
			// exception:
			//		ConstraintError
			// tag:
			//		Private
			var indexKey = Keys.indexKeyValue( this.keyPath, storeRecord.value );

			function hasKey(/*IDBIndex*/ index, /*any*/ indexKey) {
				// summary:
				//		Return true if an index key already exists otherwise false. If the
				//		key is an array and multiEntry is enabled each entry in the array
				//		is tested.
				// index:
				// indexKey:
				// tag:
				//		Private
				if (indexKey instanceof Array && index.multiEntry) {
					return indexKey.some( function(key) {
										return !!Keys.search(index, key).record;
									});
				}
				return !!Keys.search(index, indexKey).record;
			}

			if (indexKey) {
				if (!hasKey(this, indexKey) || !this.unique) {
					if (this.multiEntry) {
						if (indexKey instanceof Array) {
							// Add an index record for each array element.
							indexKey.forEach( function(key) {
								addIndexRecord( this, key, storeRecord.key );
							}, this);
							return;
						}
					}
					// Add a single index record.
					addIndexRecord( this, indexKey, storeRecord.key );
				} else {
					throw new DOMException("ConstraintError", "Key ["+indexKey+"] already exist in index ["+this.name+"]" );
				}
			}
		}

		this._clear = function() {
			// summary:
			//		Remove all records from the index.
			// tag:
			//		Private
			this._records   = [];
		}

		this._deleteStoreRecord = function (/*Record*/ storeRecord) {
			//summary:
			//		Remove all index records whose value matches the store key if any
			//		such records exist. Note: index records are structured as follows:
			//		{ key: indexKey, value: [storeKey1, storeKey2, storeKey3, .. ]}.
			// storeRecord:
			//		Store record whose index record(s) are to be deleted.
			// tag:
			//		Private
			var indexKey   = Keys.indexKeyValue( this.keyPath, storeRecord.value );
			var storeKey   = storeRecord.key;
			var candidates = [];
			var self = this;
			var i;

			if (indexKey) {
				// First, based on the index key(s) collect all candidate index records.
				if (indexKey instanceof Array && this.multiEntry) {
					indexKey.forEach( function (key) {
						var search = Keys.search(self, key);
						if (search.record) {
							for (i=search.eq; i<search.gt; i++) {
								candidates.push(i);
							}
						}
					});
				} else {
					var search = Keys.search(this, indexKey);
					if (search.record) {
						candidates.push(search.eq);
					}
				}
				// Of all candidate index records get only those whose value length equals
				// zero AFTER removing the store key.
				candidates = candidates.filter( function (recNum) {
					var value = self._records[recNum].value;
					var index = value.indexOf(storeKey);
					// If the index record value contains the store key, remove it from the
					// record value.
					if (index != -1) {
						value.splice(index,1);
						return (value.length == 0);
					}
					return false;
				});

				// If any candidates are left reverse the record order (descending) and delete
				// the records starting with the highest record number.
				if (candidates.length > 0) {
					candidates.reverse().forEach( function(recNum) {
						self._records.splice(recNum,1);
					});
				}
			}
		}

		this._destroy = function () {
			// summary:
			//		Destroy the index.
			// tag:
			//		Private
			this._destroyed = true;
			this._clear();
		};

		defineProperty( this, "_addStoreRecord", {enumerable: false} );
		defineProperty( this, "_clear", {enumerable: false} );
		defineProperty( this, "_deleteStoreRecord", {enumerable: false} );
		defineProperty( this, "_destroy", {enumerable: false} );

		//=========================================================================
		// Public methods

		this.count = function (/*any*/ key) {
			// summary:
			//		Count the total number of records that share the key or key range and
			//		return that value as the result for the IDBRequest.
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
				var index = kwArgs.index;
				var count = 0;
				var i, range;

				assertIndex(index);

				range = Keys.getRange(index, kwArgs.key);
				if (range.count) {
					for (i = range.eq; i < range.gt; i++) {
						count = count + index._records[i].value.length;
					}
				}
				return count;
			}

			assertIndex(this);
			if (key) {
				if (Keys.isValidKey(key)) {
					key = IDBKeyRange.only( key );
				}
				assertKey(key);
			} else {
				key = IDBKeyRange.only();
			}
			var request = new IDBRequest( this, _count, {index: this, key: key} );
			return this.objectStore.transaction._queue(request);
		};

		this.get = function (/*any*/ key) {
			// summary:
			//		Get the first record that matches key. The store record value is
			//		returned as the result of the IDBRequest.
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
			//		| var request = index.get( myKey );
			//		| request.onsuccess = function (event) {
			//		|   var value = this.result;
			//		| };
			//
			//		Alternatively:
			//
			//		| var request = index.get( myKey );
			//		| request.addEventListener( "success", function (event) {
			//		|   var value = this.result;
			//		| });
			// tag:
			//		Public
			function _get(/*Object*/ kwArgs,/*IDBRequest*/ request ) {
				assertIndex(kwArgs.index);
				return retrieveReferenceValue( kwArgs.index, kwArgs.key );
			}

			assertIndex(this);
			assertKey(key);

			var request = new IDBRequest( this, _get, {index: this, key: key} );
			return this.objectStore.transaction._queue(request);
		};

		this.getKey = function (/*any*/ key) {
			// summary:
			//		Get the first record that matches key.   The index record value, that
			//		is, the primary key of the referenced store is returned as the result
			//		of the IDBRequest.
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
			// tag:
			//		Public
			function _getKey(/*Object*/ kwArgs,/*IDBRequest*/ request ) {
				assertIndex(kwArgs.index);
				return retrieveIndexValue( kwArgs.index, kwArgs.key );
			}

			assertIndex(this);
			assertKey(key);

			var request = new IDBRequest( this, _getKey, {index: this, key: key} );
			return this.objectStore.transaction._queue(request);
		};

		this.openCursor = function (/*any?*/ range, /*DOMString?*/ direction) {
			// summary:
			//		Open a cursor. A Cursors is a transient mechanism used to iterate over
			//		multiple records in a database. Storage operations are performed on
			//		the underlying index and store. The cursor comprises a range of records
			//		in the index
			// range:
			//		The key range to use as the cursor's range.
			// direction:
			//		The cursor's required direction.
			// returns:
			//		An IDBRequest object.
			// exceptions:
			//		DataError
			//		InvalidStateError
			//		TransactionInactiveError
			//		TypeError
			// example:
			//		| var request = index.openCursor();
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

			assertIndex(this);
			if (range) {
				if (Keys.isValidKey(range)) {
					range = IDBKeyRange.only( range );
				}
				assertKey(range);
			}
			var cursor  = new Cursor( this, range, direction, false );
			var request = new IDBRequest( this, cursor._iterate, null, cursor);
			return this.objectStore.transaction._queue(request);
		};

		this.openKeyCursor = function (/*any*/ range, /*DOMString*/ direction) {
			// summary:
			//		Open a key cursor. A Cursors is a transient mechanism used to iterate
			//		over multiple records in an index. (Note: a key cursor does NOT allow
			//		any storage operation such update or delete).
			// range:
			//		The key range to use as the cursor's range.
			// direction:
			//		The cursor's required direction.
			// returns:
			//		An IDBRequest object.
			// exceptions:
			//		DataError
			//		InvalidStateError
			//		TransactionInactiveError
			//		TypeError
			// tag:
			//		Public
			var range = range || null;

			assertIndex(this);
			if (range) {
				if (Keys.isValidKey(range)) {
					range = IDBKeyRange.only( range );
				}
				assertKey(range);
			}
			var cursor  = new Cursor( this, range, direction, true );
			var request = new IDBRequest( this, cursor._iterate, null, cursor);
			return this.objectStore.transaction._queue(request);
		};

	} /* end IDBIndex */

	return IDBIndex;

});
