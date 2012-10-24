//
// Copyright (c) 2012, Peter Jekel
// All rights reserved.
//
//	The indexedDB implementation is released under to following two licenses:
//
//	1 - The "New" BSD License			 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//
define([], function(){

// module:

	function Record(key, value) {
		// summary:
		this.key   = key;
		this.value = value;

		this.destroy = function () {
			this.value = null;
			this.key   = null;
			this._destroyed = true;
		}
	}
	return Record;
});
