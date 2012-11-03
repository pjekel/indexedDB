//
// Copyright (c) 2012, Peter Jekel
// All rights reserved.
//
//	The indexedDB implementation is released under to following two licenses:
//
//	1 - The "New" BSD License			 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//
define(["dojo/has"], function (has) {
	"use strict";

	// Requires JavaScript 1.8.5
	var defineProperty = Object.defineProperty;
	var freezeObject = Object.freeze;

	function setEnvironment( transaction, cursor, keyRange, worker ) {
		// summary:
		//		Declare all required IDB interfaces global.
		// transaction:
		//		Implementation of the IDBTransaction interface.
		// cursor:
		//		Implementation of the IDBCursor interface.
		// keyRange:
		//		Implementation of the IDBKeyRange interface.
		// worker:
		//		Transaction mamager (indexedDB for dojo only).
		// tag:
		//		Private
		window.IDBTransaction = transaction;
		window.IDBKeyRange    = keyRange;
		window.IDBCursor      = cursor;

		if (worker) {
			window.IDBWorker 			= worker;
		}
	}

	var IDBEnvironment = {
		// summary:
		//		The IDBEnvironment object is a dojo loader plugin. The loader determines
		//		if native indexedDB support is available or not. If not, the appropriate
		//		modules are automatically loaded making the required indexedDB interfaces
		//		available. In addition, the loader offers the option to overwrite native
		//		indexedDB support by specifying the 'enforce' flag.
		//
		// example:
		//		|		require(["indexedDB/IDBEnvironment!enforce"],
		//		|			function (indexedDB) {
		//		|							...
		//		|		});
		//
		// NOTE:
		//		Because this module is a dojo loader plugin you MUST specify the exclamation
		//		mark at the end of the module id, as show above, regardless if the 'enforce'
		//		flags is specified or not, like:
		//
		//		|		require(["indexedDB/IDBEnvironment!"],
		//		|			function (indexedDB) {
		//		|							...
		//		|		});
		//
		// tag:
		//		Public

		load: function (/*String*/ id, /*Function*/ require, /*Function*/ callback) {
			// summary:
			//		Dojo AMD loader entry point. This method is called by the Dojo AMD
			//		loader and tests if native indexedDB support is available in the
			//		browser.
			// id:
			//		The string to the right of the exclamation mark (!).
			// require:
			//		AMD require method.
			// callback:
			//		Dojo AMD Loader callback function. The callback is called with the
			//		global instance of indexedDB as it argument.

			var indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB;
			if (indexedDB && id !== "enforce") {
				// Test if this is by any chance an older indexedDB implementation.
				var db = window.IDBDatabase || window.webkitIDBDatabase || window.mozIDBDatabase || window.msIDBDatabase;
				try {
					if (db.prototype.setVersion) {
						console.warn("Legacy native indexedDB (setVersion) is not supported.");
						indexedDB = null;		// Force indexedDB for dojo..
					}
				} catch(err) {
					// db apparently is not what we expected it to be, now what....
				}
			}
			if (!indexedDB || id === "enforce") {
				console.info( "Loading dojo indexedDB...");
				// Load all required IDB interfaces/dependencies.
				require (["indexedDB/IDBCursor",
									"indexedDB/IDBFactory",
									"indexedDB/IDBKeyRange",
									"indexedDB/IDBTransaction",
									"indexedDB/IDBWorker"
								 ], function (IDBCursor, IDBFactory, IDBKeyRange, IDBTransaction, IDBWorker) {

					setEnvironment( freezeObject(new IDBTransaction()),
													freezeObject(new IDBCursor()),
													freezeObject(new IDBKeyRange()),
													freezeObject(new IDBWorker())
												);
//					window.indexedDB = indexedDB = freezeObject(new IDBFactory());
					indexedDB = freezeObject(new IDBFactory());

					callback( indexedDB );
				});
			} else {
				if (window.webkitIndexedDB) {
					setEnvironment( webkitIDBTransaction, webkitIDBCursor, webkitIDBKeyRange, null );
				}
				console.info( "Using native indexedDB support...");
				callback( indexedDB );	// Return native indexedDB (IDBFactory)
			}
			has.add("indexedDB", true);
		}

	} /* end IDBEnvironment */

	// Just in case somebody forgets the exclamation mark after all :)
	defineProperty( IDBEnvironment, "load", {enumerable: false});

	return IDBEnvironment;

});
