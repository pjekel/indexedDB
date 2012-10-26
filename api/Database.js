//
// Copyright (c) 2012, Peter Jekel
// All rights reserved.
//
//	The indexedDB implementation is released under to following two licenses:
//
//	1 - The "New" BSD License			 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//
define(["indexedDB/dom/event/Event",
				"indexedDB/dom/event/EventTarget",
				"indexedDB/dom/string/DOMStringList",
				"indexedDB/IDBObjectStore",
				"indexedDB/IDBIndex"
			 ], function (Event, EventTarget, DOMStringList, IDBObjectStore, IDBIndex ) {

	var optionalDatabaseParameters = {
		stores: [],
		url: null
	};

	var optionalStoreParameters = {
		keyPath: null,
		autoIncrement: false
	};

	var optionalIndexParameters = {
		unique: false,
		multiEntry: false
	};

	function Database (/*String*/ name, /*Object?*/ databaseOptions) {
		// summary:
		//		Implements a simple in memory database. (e.g. a collection of object
		//		stores).
		// name:
		//		Database name.
		// databaseOptions:
		//		JavaScript object. If databaseOptions is omitted all stores and indexes
		//		need to be created and populated using the indexedDB API.
		//
		//			{ stores: [
		//					{ url:"./Simpsons.json", name:"characters", storeOptions:{keyPath:"name"},
		//						indexes: [
		//							{ name:"parents", keyPath:"parent", indexOptions:{multiEntry:true}}
		//						]
		//					}
		//				]
		//			};
		// tag:
		//		Private

		var errorCount = 0;
		var self       = this;

		EventTarget.call(this);		// Inherit from EventTarget

		this.deletePending = false;
		this.ready         = false;
		this.name          = name;
		this.version       = 0;

		//=========================================================================

		function fireLoad () {
			// summary:
			//		Fire the database 'load' event but only if no error events have been
			//		dispatched  previously.
			// tag:
			//		Private
			if (!errorCount) {
				setTimeout( function() {
					self.dispatchEvent( new Event( "load" ));
					self.ready = true;
				}, 0 );
			}
		}

		//=========================================================================
		// Public methods.

		this.createStore = function (/*DOMString*/ name, /*optionalStoreParameters*/ optionalParameters) {
			// summary:
			//		Create an object store.
			// name:
			//		The name of a new object store.
			// objectStoreParameters:
			//		The options object whose attributes are optional parameters to this
			//		function. keyPath specifies the key path of the new object store.
			//		If the attribute is null, no key path is specified and thus keys are
			//		out-of-line. autoIncrement specifies whether the object store created
			//		should have a key generator. Examples:
			//
			//			{ keyPath: "name", autoIncrement: false };
			//			{ keyPath: "id", autoIncrement: true };
			//			{ autoIncrement: true };
			// returns:
			//		A IDBObjectStore or null
			// tag:
			//		Public

			throw new Error( "Abstract interface definition only." );
		};

		this.createIndex = function (/*IDBObjectStore*/ store, indexName, /*any*/ keyPath,
																	/*optionalIndexParameters*/ optionalParameters ) {
			// summary:
			//		Create an IDBIndex. If the store associated with the index already
			//		contains data it is automatically indexed.
			// store:
			//		A IDBObjectStore for which the index is created.
			// indexName:
			//		The name of a new index
			// keyPath:
			//		The key path used by the new index.
			// optionalParameters:
			//		The options object whose attributes are optional parameters to this
			//		function. unique specifies whether the index's unique flag is set.
			//		multiEntry specifies whether the index's multiEntry flag is set.
			// returns:
			//		An IDBIndex
			// exceptions:
			//		ConstraintError
			//		InvalidStateError
			// tag:
			//		Public
			throw new Error( "Abstract interface definition only." );
		};

		this.deleteDatabase = function () {
			// summary:
			//		Delete the database.
			// tag:
			//		Public
			this.deletePending = true;
			this.ready = false;

			throw new Error( "Abstract interface definition only." );
		};

		this.deleteIndex = function (/*String*/ storeName, /*String*/ indexName ) {
			// summary:
			//		Delete an index.
			// storeName:
			//		Store name whose index is to be deleted.
			// indexName:
			//		Index name.
			// tag:
			//		Public
			throw new Error( "Abstract interface definition only." );
		};

		this.deleteStore = function (/*String*/ storeName) {
			// summary:
			//		Delete a store
			// storeName:
			//		Store name.
			// tag:
			//		Public
			throw new Error( "Abstract interface definition only." );
		};

		this.getStoreNames = function () {
			// summary:
			//		Get the list of object store names in the database.
			// returns:
			//		DOMStringList sorted in ascending order.
			// tag:
			//		Public
			throw new Error( "Abstract interface definition only." );
		};

		this.getIndexByStore = function (/*String*/ storeName) {
			// summary:
			//		Get the indexes for a given object store.
			// storeName:
			//		Store name for which to get the index(es).
			// returns:
			//		JavaScript key value pair object: { keyValuePair+ }
			// tag:
			//		Public
			throw new Error( "Abstract interface definition only." );
		};

		this.getStores = function (/*(String|String[])?*/ names) {
			// summary:
			// names:
			// returns:
			//		JavaScript key value pair object: { keyValuePair+ }
			// tag:
			//		Public
			throw new Error( "Abstract interface definition only." );
		};

		this.setVersion = function (/*Number*/ newVersion) {
			// summary:
			//		Set the new version of the database.
			//  newVersion:
			// 		Version number
			// tag:
			//		Public
			this.version = newVersion;
			return this.version;
		};

		fireLoad();		// Signal the database is loaded..

	} /* end Database() */

	// Inherit from EventTarget
	Database.prototype = new EventTarget();
	Database.prototype.constructor = Database;

	return Database;
});
