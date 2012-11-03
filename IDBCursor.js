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
				"./IDBKeyRange",
				"./IDBRequest",
				"./util/Keys"
			], function(lang, DOMException, KeyRange, IDBRequest, Keys){
	"use strict";

// module:

	var moduleName = "indexedDB/IDBCursor"

	// Requires JavaScript 1.8.5
	var defineProperty = Object.defineProperty;

	function IDBCursor (/*Store|Index*/ source,/*KeyRange*/ range, /*String*/ direction,
											 /*Boolean?*/ keyCursor) {
		// summary:
		//		Implements the IDBCursor interface (http://www.w3.org/TR/IndexedDB/#cursor).
		//		Cursors are a transient mechanism used to iterate over multiple records
		//		in a database. Storage operations are performed on the underlying index
		//		or an object store.
		// source:
		//		The cursor's source, that is, store or index, on which this cursor will
		//		operate.
		// range:
		//		The key range to use as the cursor's range.
		// direction:
		//		The cursor's required direction.
		// keyCursor:
		//		Indicates if this is a key cursor. (default is false)
		// tag:
		//		Public

		if (arguments.length == 0) {
			this.NEXT_NO_DUPLICATE = "nextunique";
			this.PREV_NO_DUPLICATE = "prevunique";
			this.NEXT = "next";
			this.PREV = "prev";
			return;
		}

		var isKeyCursor = !!keyCursor;
		var direction   = direction || "next";
		var source      = source;
		var gotValue    = false;
		var primaryKey;
		var currentKey;
		var currentVal;

		var locator;

		var transaction;
		var keyRange;
		var request;
		var store;
		var self = this;

		defineProperty( this, "primaryKey", {get: function () { return primaryKey; },	enumerable: true});
		defineProperty( this, "direction", {get: function () { return direction; },	enumerable: true});
		defineProperty( this, "source", {get: function () { return source; }, enumerable: true});
		defineProperty( this, "key", {get: function () { return currentKey; },	enumerable: true});

		// Implement IDBCursorWithValue
		if (!isKeyCursor) {
			defineProperty( this, "value", {get: function () { return currentVal; }, enumerable: true});
		}

		if (source._isStore || source._isIndex) {
			if (source._isIndex) {
				store = source.objectStore;
			} else {
				store = source;
			}

			switch (direction) {
				case "next":
				case "nextunique":
				case "prev":
				case "prevunique":
					break;
				default:
					throw new TypeError(moduleName+"(): Invalid cursor direction.");
			}

			keyRange = range || IDBKeyRange.only();
			if (!(keyRange instanceof KeyRange)) {
				keyRange = IDBKeyRange.only(range);
			}

		} else {
			throw new TypeError(moduleName+"(): Invalid source.");
		}

		//=========================================================================

		function assertSource(/*IDBIndex|IDBObjectStore*/ source ) {
			// summary:
			//		Test if the cursor's store or index is still in a valid state.
			// source:
			//		The index or store to assert.
			// exception:
			//		InvalidStateError
			// tag:
			//		Private
			if (source._destroyed || source._beingDestroyed) {
				throw new DOMException("InvalidStateError");
			}
		}

		function iterateCursor(/*IDBCursor*/ cursor, /*any*/ key ) {
			// summary:
			//		Iterate the cursor
			// cursor:
			//		Cursor to iterate
			// tag:
			//		Private
			var records = source._records;
			var keyLoc;

			if (!locator) {
				var range = keyLoc = Keys.getRange( source, keyRange );
				if (range.count) {
					var first = range.ls + 1;
					var last  = range.gt - 1;

					switch (direction) {
						case "next":
						case "nextunique":
							keyLoc = Keys.search( source, records[first].key );
							break;
						case "prev":
							keyLoc = Keys.search( source, records[last].key );
							if (source._isIndex && !source.unique) {
								var storeKeys = keyLoc.record.value;
								keyLoc.position = storeKeys.length - 1;
							}
							break;
						case "prevunique":
							keyLoc = Keys.search( source, records[last].key );
							break;
					}
				}
			}
			else /* cursor is loaded */
			{
				switch (direction) {
					case "next":
						keyLoc = locator.next(key);
						break;
					case "nextunique":
						keyLoc = locator.next(key, true);
						break;
					case "prev":
						keyLoc = locator.previous(key);
						break;
					case "prevunique":
						keyLoc = locator.previous(key, true);
						break;
				}
			}
			locator = keyLoc;

			var position = locator.position;
			var record   = locator.record;

			if (record && Keys.inRange( record.key, keyRange)) {
				currentKey = primaryKey = record.key;
				currentVal = record.value;

				if (source._isIndex) {
					primaryKey = record.value[position];
					if (!isKeyCursor) {
						var refRecord  = Keys.search( source.objectStore, primaryKey ).record;
						currentVal = refRecord.value;
					}
				}
			} else {
				currentVal = currentKey = primaryKey = undefined;
				gotValue = false;
				return null;
			}
			gotValue = true;
			return cursor;
		}

		function _iterateCursor(/*Object*/ args, /*IDBRequest*/ request ) {
			// summary:
			// args:
			//		A JavaScript 'key:value' pairs object.
			// request:
			//		A IDBRequest
			// tag:
			//		Private
			var result, count = args.count;
			assertSource( source );
			do {
				result = iterateCursor( args.cursor, args.key );
			} while (--count > 0 && result);
			return result;
		}

		//=========================================================================
		// Private cursor methods.

		this._iterate = function () {
			// summary:
			// tag:
			//		Private
			if (!locator && store.transaction && store.transaction._request) {
				transaction = store.transaction;
				request     = transaction._request;
				return iterateCursor( this );
			} else {
				throw new DOMException( "InvalidStateError");
			}
		}
		defineProperty( this, "_iterate", {	enumerable: false	});

		//=========================================================================
		// Public Cursor methods.

		this.advance = function (/*number*/ count) {
			// summary:
			//		Advance the cursor count number of times forward.
			// count:
			//		The number of advances forward the cursor should make.
			// tag:
			//		Public
			if (gotValue) {
				if (count && (typeof count == "number" && count > 0)) {
					request._recycle( _iterateCursor, { cursor: this, key: null, count: count }, this);
					gotValue = false;
				} else {
					throw new TypeError("Invalid count parameter" );
				}
			} else {
				throw new DOMException("InvalidStateError");
			}
		}

		// WARNING: THE DOJO BUILD SYSTEM WILL FAIL ON 'this.continue'
		this.continue = function (/*any?*/ key) {
			// summary:
			//		Advance the cursor once in the direction set for the cursor or to the
			//		key if specified.
			// key:
			//		The next key to position this cursor at
			// tag:
			//		Public
			if (key && !Keys.isValidKey(key)) {
				throw new DOMException("DataError");
			}
			if (gotValue) {
				request._recycle( _iterateCursor, { cursor: this, key: key, count: 1 }, this);
				gotValue = false;
			} else {
				throw new DOMException("InvalidStateError");
			}
		}

		// WARNING: THE DOJO BUILD SYSTEM WILL FAIL ON 'this.delete'
		this.delete = function () {
			// summary:
			//		Delete the record with the cursor's current primary key from the store.
			// returns:
			//		An IDBRequest.
			// exception:
			//		InvalidStateError
			//		ReadOnlyError
			//		TransactionInactiveError
			// tag:
			//		Public
			if (transaction.mode != IDBTransaction.READ_ONLY) {
				if (gotValue && !isKeyCursor) {
					var deleteReq = new IDBRequest( store, store._deleteRecord, {store: store, key: primaryKey} );
					transaction._queue( deleteReq );
					return deleteReq;
				} else {
					throw new DOMException("InvalidStateError");
				}
			} else {
				throw new DOMException("ReadOnlyError");
			}
		}

		this.update = function (/*object*/ value) {
			// summary:
			//		Update the value of the store record whose key matches the cursor's
			//		current primary key. If the updated value results in an different
			//		key for the record a DOMException of type DataError is thrown. This
			//		effectively means the caller is not allowed to change the primary
			//		key of the store record.
			// value:
			//		The new value to store.
			// returns:
			//		An IDBRequest.
			// exception:
			//		DataCloneError
			//		DataError
			//		InvalidStateError
			//		ReadOnlyError
			//		TransactionInactiveError
			// tag:
			//		Public
			if (transaction.mode != IDBTransaction.READ_ONLY) {
				if (gotValue && !isKeyCursor) {
					var keyValue = Keys.keyValue( store.keyPath, value );
					if (!Keys.compare(primaryKey, keyValue)) {
						var updateReq = new IDBRequest( store, store._storeRecord, {
																		store: store,
																		value: lang.clone(value),
																		key: primaryKey,
																		noOverwrite: false
																});
						transaction._queue( updateReq );
						return updateReq;
					} else {
						throw new DOMException("DataError");
					}
				} else {
					throw new DOMException("InvalidStateError");
				}
			} else {
				throw new DOMException("ReadOnlyError");
			}
		}

	}	/* end IDBCursor() */

	return IDBCursor;
});
