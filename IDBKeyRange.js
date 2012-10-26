//
// Copyright (c) 2012, Peter Jekel
// All rights reserved.
//
//	The indexedDB implementation is released under to following two licenses:
//
//	1 - The "New" BSD License			 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//
define([], function() {

// module:
//		/store/KeyRange

	var moduleName = "indexedDB/IDBKeysRange";

	var defineProperty = Object.defineProperty;
	var freezeObject   = Object.freeze;

	function IDBKeyRange (lower, upper, lowerOpen, upperOpen) {
		// summary:
		//		Implements the IDBKeyRange interface.
		// lower:
		//		The lower bound value.
		// upper:
		//		The upper bound value.
		// lowerOpen:
		//		Set to false if the lower-bound should be included in the key range.
		//		Set to true if the lower-bound value should be excluded from the key
		//		range. Defaults to false (lower-bound value is included).
		// upperOpen:
		//		Set to false if the upper-bound should be included in the key range.
		//		Set to true if the upper-bound value should be excluded from the key
		//		range. Defaults to false (upper-bound value is included).
		// tag:
		//		Public
		if (arguments.length > 0) {
			this.lower = lower
			this.lowerOpen = lowerOpen || false;
			this.upper = upper;
			this.upperOpen = upperOpen || false;

			freezeObject(this);
			return;
		}

		this.only = function (/*any*/ value ) {
			// summary:
			//		Creates and returns a new key range with both lower and upper set
			//		to value and both lowerOpen and upperOpen set to false.
			// value:
			//		The only value.
			// tag:
			//		Public
			return new IDBKeyRange(/*any*/ value,/*any*/ value, false, false );
		};

		this.lowerBound = function (/*any*/ lower,/*Boolean*/ open ) {
			// summary:
			//		Creates and returns a new key range with lower set to lower, lowerOpen
			//		set to open, upper set to undefined and and upperOpen set to true.
			// lower:
			//		The lower bound value.
			// open:
			//		Set to false if the lower-bound should be included in the key range.
			//		Set to true if the lower-bound value should be excluded from the key
			//		range. Defaults to false (lower-bound value is included).
			// tag:
			//		Public
			if (lower) {
					return new IDBKeyRange( lower, undefined, !!open, false );
			} else {
				throw new Error(moduleName+"::lowerBound(): lower key value required.");
			}
		};

		this.upperBound = function (/*any*/ upper,/*Boolean*/ open ) {
			// summary:
			//		Creates and returns a new key range with lower set to undefined,
			//		lowerOpen set to true, upper set to upper and and upperOpen set
			//		to open.
			// upper:
			//		The upper bound value.
			// open:
			//		Set to false if the upper-bound should be included in the key range.
			//		Set to true if the upper-bound value should be excluded from the key
			//		range. Defaults to false (upper-bound value is included).
			// tag:
			//		Public
			if (upper) {
					return new IDBKeyRange( undefined, upper, false, !!open );
			} else {
				throw new Error(moduleName+"::upperBound(): upper key value required.");
			}
		};

		this.bound = function (/*any*/ lower,/*any*/ upper,/*Boolean*/ lowerOpen,/*Boolean*/ upperOpen ) {
			// summary:
			//		Creates and returns a new key range with lower set to lower, lowerOpen
			//		set to lowerOpen, upper set to upper and upperOpen set to upperOpen.
			// lower:
			//		The lower bound value.
			// upper:
			//		The upper bound value.
			// lowerOpen:
			//		Set to false if the lower-bound should be included in the key range.
			//		Set to true if the lower-bound value should be excluded from the key
			//		range. Defaults to false (lower-bound value is included).
			// upperOpen:
			//		Set to false if the upper-bound should be included in the key range.
			//		Set to true if the upper-bound value should be excluded from the key
			//		range. Defaults to false (upper-bound value is included).
			// tag:
			//		Public
			if (lower && upper) {
					return new IDBKeyRange( lower, upper, !!lowerOpen, !!upperOpen );
			} else {
				throw new Error(moduleName+"::bound(): lower and upper key values required.");
			}
		};
		freezeObject(this);
	}

	return IDBKeyRange;
});