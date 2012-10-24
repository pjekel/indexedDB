//
// Copyright (c) 2012, Peter Jekel
// All rights reserved.
//
//	The indexedDB implementation is released under to following two licenses:
//
//	1 - The "New" BSD License			 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//
define(["dojo/_base/array",
				"dojo/_base/lang"
			 ], function(array, lang) {
	"use strict";

// module:
//		database/util/keys
//

	// Requires JavaScript 1.8.5
	var defineProperty = Object.defineProperty;

	var moduleName = "indexedDB/util/Keys";
	var keys = {};

	function location(/*IDBIndex|IDBObjectStore*/ source, ls, eq, gt, np ) {
		// summary:
		//		Record location object
		// description:
		//		A location object holds indexing (location) information for a given
		//		record key. The default location object looks like:
		//
		//		location dictionary = {
		//			position = 0;
		//			record = null;
		//			count = 0;
		//			ls = -1;
		//			eq = -1;
		//			gt = 0;
		//		};
		//
		//		position:
		//			Each record has a 'key' and 'value' property as in: {key, value}.
		//			In case of an index record the value represents the primary(s) key
		//			in the referenced object store. The value property of an index is
		//			implemented as an array allowing for multiple store records with
		//			the same index key. For example, an index record based on peoples
		//			last name could look like:
		//
		//				{ key: "simpson", value:["Abe", "Bart", "Homer", "Lisa"] };
		//
		//			When iterating an index cursor the position property identifies the
		//			current location (index) of the value property.
		//		record:
		//			Record reference. Depending on the source this is either an index
		//			or object store record. Typically the first record that matched a
		//			key search otherwise null.
		//		count:
		//			Number of record that matched a key or key range search.
		//		ls:
		//			The index of the last instance of a record whose key is less then
		//			the key searched for. (typically eq-1 if a match was found).
		//		eq:
		//			Index of the record with an exact key match. If no match is found
		//			eq equals -1.
		//		gt:
		//			The index of the first record whose key is greater then the key
		//			searched for.
		//
		// source:
		//		The location source which is either an IDBIndex or IDBOjectStore.
		//
		// tag:
		//		private
		var source = source;

		this.ls = (ls != undefined ? ls : -1);
		this.eq = (eq != undefined ? eq : -1);
		this.gt = (gt != undefined ? gt :  0);

		this.record = (source._records && this.eq != -1) ? source._records[this.eq] : null;
		this.count  = this.gt > 0 ? this.gt - (this.ls + 1) : 0;
		this.position = np || 0;

		this.next = function (/*any?*/ key, /*Boolean?*/ unique) {
			// summary:
			//		Get the next record relative to the current location.
			// key:
			//		The next key to position this cursor at.
			// unique:
			//		If true records with duplicate keys are skipped.
			// returns:
			//		A location object.
			// tag:
			//		Private
			var eq = this.gt;

			if (key) {
				var keyLoc = keys.search(source, key);
				var keyIdx = keyLoc.eq != -1 ? keyLoc.eq : keyLoc.ls + 1;
				if (keyIdx < eq) {
					return new location( source, eq - 1, -1, 0 );
				} else {
					eq = keyIdx;
				}
			} else {
				if (!unique && (source._isIndex && !source.unique)) {
					var storeKeys = source._records[this.eq].value;
					if (this.position < storeKeys.length - 1) {
						return new location( source, this.ls, this.eq, this.gt, this.position + 1 );
					}
					this.position = 0;
				}
			}
			if (eq < source._records.length) {
				return new location( source, eq - 1, eq, eq+1 );
			}
			return new location( source, eq - 1, -1, eq );
		};

		this.previous = function (/*any?*/ key, /*Boolean?*/ unique) {
			// summary:
			//		Get the previous record relative to the current location.
			// key:
			//		The next key to position this cursor at.
			// unique:
			//		If true no records with duplicate keys are returned.
			// returns:
			//		A location object.
			// tag:
			//		Private
			var eq = this.ls;
			var np = 0;

			if (key) {
				var keyLoc = keys.search(source, key);
				var keyIdx = keyLoc.eq != -1 ? keyLoc.eq : keyLoc.gt - 1;
				if (keyIdx > eq) {
					return new location( source, eq - 1, -1, 0 );
				} else {
					eq = keyIdx;
				}
			} else {
				if (!unique && (source._isIndex && !source.unique)) {
					var storeKeys = source._records[this.eq].value;
					if (this.position > 0) {
						return new location( source, this.ls, this.eq, this.gt, this.position - 1 );
					}
				}
			}
			if (eq >= 0) {
				var np =  0;
				if (!unique && source._isIndex) {
					var storeKeys = source._records[eq].value;
					np = storeKeys.length - 1;
				}
				return new location( source, eq - 1, eq, eq+1, np );
			}
			return new location( source, eq - 1, -1, eq );
		};

	}

	keys.compare = function ( key1, key2 ) {
		// summary:
		//		This method compares two keys. The method returns 1 if the first key
		//		is greater than the second, -1 if the first is less than the second,
		//		and 0 if the first is equal to the second. By definition the following
		//		condition is always true:
		//
		//			Array > String > Date > Number
		//
		// key1:
		//		First valid indexedDB key.
		// key2:
		//		Second valid indexedDB key.
		// returns:
		//		-1, 0 or 1
		// tag:
		//		Public.

		// TODO: May have to revisit null versus undefined...
		var keyA = key1 || null;
		var keyB = key2 || null;

		if (keyA && keyB) {
			if (keyA instanceof Array || keyB instanceof Array) {
				if (!(keyA instanceof Array)) return -1;
				if (!(keyB instanceof Array)) return 1;
				// TODO: implement full array comparison.
				return keys.compare( keyA.toString(), keyB.toString() );
			}
			if (typeof keyA === typeof keyB) {
				if (keyA < keyB) return -1;
				if (keyA > keyB) return 1;
				return 0;
			} else if (typeof keyA == "string" || keyA instanceof String) {
				return 1;
			} else if (typeof keyB == "string" || keyB instanceof String) {
				return -1;
			} else if (keyA instanceof Date) {
				return 1;
			} else if (keyB instanceof Date) {
				return -1;
			}
			return keys.compare( keyA.toString(), keyB.toString() );
		}
		if (!keyA && !keyB) return 0;
		if (!keyA) return -1;
		return 1;
	};

	keys.boundary = function (/*IDBIndex|IDBObjectStore*/ source, /*any*/ key, /*String*/ boundary, /*Boolean*/ open ) {
		// summary:
		//		Determine the upper or lower boundary of an ordered list of records
		//		sharing the same key.
		// source:
		//		The source to search which is either an IDBIndex or IDBOjectStore.
		// key:
		//		Key for which the boundary is to be determined.
		// boundary:
		//		'lower' or 'upper'
		// open:
		//		Indicates if the key itself is to be included or excluded when setting
		//		the boundary. If open is set to false matching key records will be
		//		included otherwise they are excluded.
		// returns:
		//		Record index. If boundary equals 'lower' the index identifies the
		//		lower boundary or first record otherwise it is the upper boundary or
		//		last record.
		// tag:
		//		Public
		var recordList = source._records;
		var result, i;

		if (key) {
			var entry = keys.search(source, key);
			var first = entry.eq >= 0 ? entry.eq : entry.gt;

			for(i=first; i<recordList.length; i++) {
				result = keys.compare( key, recordList[i].key );
				switch (boundary) {
					case "lower":
						if (result == 0 && !open) {
							return i;
						}
						if (result < 0) {
							return i;
						}
						continue;

					case "upper":
						if (result == 0 && open) {
								return i-1;
						}
						if (result < 0) {
							return i-1;
						}
						continue;
				}
			}
			return recordList.length - 1;
		} else {
			switch (boundary) {
				case "lower":
					return 0;
				case "upper":
					return recordList.length - 1;
			}
		}
	};

	keys.getRange = function (/*IDBIndex|IDBObjectStore*/ source, /*IDBKeyRange*/ keyRange) {
		// summary:
		//		Get all records within a given key range.
		// recordList:
		//		Array of records in ascending order by key.
		// keyRange:
		//		An IDBKeyRange.
		// returns:
		//		A location object. (see  keys.search() for details).
		// tag:
		//		Public
		if (keyRange && (source._records && source._records.length)) {
			var first = keys.boundary( source, keyRange.lower, "lower", keyRange.lowerOpen);
			var last  = keys.boundary( source, keyRange.upper, "upper", keyRange.upperOpen);

			return new location( source, 										// source
														first - 1, 									// ls
														first, 											// eq
														(first < 0 ? 0 : last + 1)	// gt
													);
		}
		return new location(source);
	};

	keys.indexKeyValue = function (/*String|String[]*/  keyPath, /*Object*/ value ) {
		// summary:
		//		Extract the index key value from an object. If the index key is an array
		//		any invalid keys and duplicate elements are removed
		// keyPath:
		//		A key path is a DOMString that defines how to extract a key from a value.
		//		A valid key path is either the empty string, a JavaScript identifier, or
		//		multiple JavaScript identifiers separated by periods. (Note that spaces
		//		are not allowed within a key path.)
		// value:
		//		Object to extract the key value from.
		// returns:
		//		Any.
		// tag:
		//		Public
		var keyValue = keys.keyValue( keyPath, value );
		if (keyValue instanceof Array) {
			var unique = {};
			keyValue = keyValue.filter(function(item, idx) {
				if (!unique[item]) {
					unique[item] = true;
					return true;
				}
			});
			return keyValue.length ? keyValue : undefined;
		} else {
			if (keyValue !== null && keyValue !== undefined) {
				return keyValue;
			}
		}
	};

	keys.inRange = function (/*any*/ key, /*IDBKeyRange*/ keyRange) {
		// summary:
		//		Validate if key is within a key range. A key is considered to be in range
		//		if both the following conditions are fulfilled:
		//
		//		• The key range lower value is undefined or less than key. It may also
		//			be equal to key if lowerOpen is false.
		//		• The key range upper value is undefined or greater than key. It may
		//			also be equal to key if upperOpen is false.
		//
		// key:
		//		Key to be evaluated.
		// keyRange:
		//		An IDBKeyRange.
		// returns:
		//		Boolean, true if key is in range otherwise false.
		// tag:
		//		Public

		if (keys.isValidKey(key)) {
			var lower = keys.compare(keyRange.lower, key);
			var upper = keys.compare(keyRange.upper, key);

			if ( ((keyRange.lower == undefined || lower < 0) || (lower == 0 && !keyRange.lowerOpen)) &&
					 ((keyRange.upper == undefined || upper > 0) || (upper == 0 && !keyRange.upperOpen)) ) {
				return true;
			}
		}
		return false;
	}

	keys.isValidKey = function (/*any*/ key) {
		// summary:
		//		Valid if key is a valid indexedDB key
		// key:
		//		Key to be validated.
		// returns:
		//		Boolean, true if a valid key otherwise false.
		// tag
		//		Public
		if (key) {
			if (key instanceof Array) {
				// NOTE: We use dojo/array.every here because the native array.every
				//			 skips sparse array entries which we explicitly need to check
				//			 for...
				return array.every(key, function(item) { return keys.isValidKey(item); });
			}
			return (typeof key === "string" ||
							 typeof key === "number" ||
							 key instanceof Date);
		}
		return false;
	};

	keys.keyValue = function (/*String|String[]*/ keyPath,/*object*/ object ) {
		// summary:
		//		Extract the (primary) key value from an object using a key path.
		// keyPath:
		//		A key path is a DOMString that defines how to extract a key from a value.
		//		A valid key path is either the empty string, a JavaScript identifier, or
		//		multiple Javascript identifiers separated by periods. (Note that spaces
		//		are not allowed within a key path.)
		// object:
		//		Object to extract the key value from.
		// returns:
		//		Any.
		// tag:
		//		Public
		var keyValue;

		if (keyPath && keyPath !== "") {
			if (keyPath instanceof Array) {
				var values = [];
				// No sparse array allowed.
				if( array.every(keyPath, function(path, idx) {
						// Ignore any non-numeric properties.
						if (typeof idx == "number") {
							keyValue = keys.keyValue(path, object);
							if (keyValue === undefined) {
								return false;
							}
							values.push(keyValue);
						}
						return true;
					})) {
					return values;
				}
			} else {
				if (keys.isValidKey(keyPath)) {
					keyValue = lang.getObject(keyPath, false, object);
					if (keyValue !== null && keyValue !== undefined) {
						return keyValue;
					}
				}
			}
		} else {
			return object;
		}
	};

	keys.search = function (/*IDBIndex|IDBObjectStore*/ source, /*any*/ key ) {
		// summary:
		//		Search in an ordered list of records all records that share key and
		//		return a location object.
		// records:
		//		List of records in ascending order by key.
		// key:
		//		Key identifying the record(s).
		// returns:
		//		A location object.
		// tag:
		//		Public
		var records = source._records;

		if (records && records.length) {
			var lb = 0, ub = records.length;		// Set boundaries
			var idx, rc;

			do {
				idx = lb + Math.floor((ub-lb)/2);
				rc  = keys.compare( key, records[idx].key )
				switch (rc) {
					case 0:
						return new location( source, idx-1, idx, idx+1 );
					case 1:
						lb = idx + 1;
						break;
					case -1:
						ub = idx;
						break;
				}
			} while (lb < ub);
			return new location( source, (rc < 0 ? idx-1 : idx), -1, (rc < 0 ? idx : idx + 1));
		}
		return new location(source);
	};

	keys.setValue = function ( keyPath, keyValue, object ) {
		// summary:
		// keyPath:
		// keyValue:
		// object:
		// tag:
		//		Public
		lang.setObject( keyPath, keyValue, object );
	};

	return keys;
});