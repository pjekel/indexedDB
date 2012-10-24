//
// Copyright (c) 2012, Peter Jekel
// All rights reserved.
//
//	The indexedDB implementation is released under to following two licenses:
//
//	1 - The "New" BSD License			 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//
define(["dojo/promise/all",
				"./dom/error/DOMException",
				"./dom/event/Event",
				"./dom/event/EventTarget",
				"./dom/string/DOMStringList",
				"./IDBObjectStore",
				"./IDBIndex",
				"./Loader",
				"./util/url"
			 ], function (PromiseAll, DOMException, Event, EventTarget, DOMStringList,
										 IDBObjectStore, IDBIndex, Loader, url) {

	// Requires JavaScript 1.8.5
	var defineProperty = Object.defineProperty;
	var freezeObject   = Object.freeze;
	var objectType     = Object.prototype.toString;

	function Database (/*String*/ name, /*Object?*/ databaseOptions) {
		// summary:
		//		Implements a simple in memory database. (e.g. a collection of object
		//		stores).
		// name:
		//		Database name.
		// databaseOptions:
		//		JavaScript key/value pairs object.
		//		Array of store definitions. If specified the stores are loaded when the
		//		database is created. A store definition is a simple JavaScript object
		//		with two properties: name and storeOptions (See Loader.js for details).
		//		For example:
		//
		//			{ name: "myStore", storeOptions: { keyPath:"name", data: myLocalData} };
		//			{ name: "myStore", storeOptions: { keyPath:"name", url:"storeData.json"} };
		// tag:
		//		Public

		var dbPath       = url.resolve( name + "/" );
		var database     = this;
		var dbStores;
		var dbURL;
		var errorCount   = 0;

		var objectStores = {};
		var indexByStore = {};

		var errorCallback;
		var loadCallback;
		var errorHndl;
		var loadHndl;

		EventTarget.call(this);

		this.deletePending = false;
		this.ready         = false;
		this.origin        = url.getOrigin( name );
		this.name          = name;
		this.description   = "";
		this.version       = 0;
		this._isDatabase   = true;

		defineProperty( this, "objectStores", {
			get: function() {return objectStores;},
			enumerable: true
		});

		defineProperty( this, "indexByStore", {
			get: function() {return indexByStore;},
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

		defineProperty( this, "onload", {
			get:	function() {return loadCallback;},
			set:	function(callback) {
							if (typeof callback === "function") {
								if (loadHndl) {
									loadHndl.remove();
								}
								loadHndl = this.addEventListener("load", callback);
								loadCallback = callback;
							}
						},
			enumerable: true
		});

		//=========================================================================

		function fireLoad () {
			// summary:
			//		Fire the database 'load' event but only if no error events have been
			//		dispatched  previously.
			// tag:
			//		Private
			if (!errorCount) {
				setTimeout( function() {
					database.dispatchEvent( new Event( "load" ));
				}, 0 );
			}
		}

		function isValidStore (storeDef) {
			// summary:
			//		Validate a store definition.
			// storeDef:
			// tag:
			//		Private
			if (storeDef.url || storeDef.data) {
				if (storeDef.url && !url.isRelative(storeDef.url, true)) {
					throw new DOMException( "InvalidAccessError", "Store URL must be a relative reference" );
				}
				return true;
			}
		}

		function loadStores(/*Array*/ remoteStores ) {
			// summary:
			//		Load the store(s) from a URL or an in memory dataset.
			// remoteStores:
			//		Array of JavaScript objects. Each object is a store definition. If
			//		specified the stores are loaded when the database is created.
			//		A store definition is a simple JavaScript object with the following
			//		properties:
			//			name:
			//					String, Name of the object store.
			//			storeOptions:
			//					Object,
			//			indexes:
			//					Array of JavaScript objects. Each object is an index definition.
			//			url:
			//					URL identifying the Remote location to load the store data from.
			//			data:
			//
			//		examples:
			//
			//			{ name: "myStore", storeOptions: {keyPath:"name"}, data: myLocalData };
			//
			//			{ name: "Simpsons", storeOptions: {keyPath:"name"}, url:"./Simpsons.json",
			//					indexes: [
			//						{name:"parents", keyPath:"parent", indexOptions: {multiEntry:true}},
			//						{name:"family", keyPath:"lastName", indexOptions: {multiEntry:false}}
			//					]
			//			};
			// tag:
			//		Private
			var promiseList  = [];
			var self = database;

			if (remoteStores) {
				remoteStores.forEach( function (remoteStore) {
					if (isValidStore( remoteStore )) {
						var storeOptions = remoteStore.storeOptions;
						var store    = self.createStore( remoteStore.name, storeOptions );
						var indexes  = remoteStore.indexes || remoteStore.indices || [];
						var storeURL = url.resolve( remoteStore.url, dbPath );
						var unique   = storeOptions.unique !== undefined ? !!storeOptions.unique : true;
						var promise  = Loader.store( store, {
															url: storeURL || null,
															data: storeOptions.data || null,
															dataType: storeOptions.dataType || "json",
															unique: unique
													 });

						promise.then(
							function () {
								indexes.forEach( function (index) {
									try {
										self.createIndex( store, index.name, index.keyPath, index.indexOptions );
									} catch (err) {
										var event = new Event( "error", {source: err.source, error: err});
										self.dispatchEvent(event);
									}
								});
							},
							function (event) {
								self.dispatchEvent(event);
							}
						);
						promiseList.push(promise);
					}
				});
			}
			var dbLoaded = new PromiseAll(promiseList);
			dbLoaded.then( fireLoad );
		}

		//=========================================================================
		// Public methods.

		this.createStore = function (/*DOMString*/ name, /*optionalParameters*/ objectStoreParameters) {
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
			// tag:
			//		Public
			if (typeof name === "string") {
				if (!objectStores[name]) {
					var store = new IDBObjectStore( this, name, objectStoreParameters );
					if (store) {
						objectStores[name] = store;
						return store;
					}
				} else {
					throw new DOMException("ConstraintError", "Object store with name ["+name+"] already exists.")
				}
			}
		};

		this.createIndex = function( store, indexName, /*any*/ keyPath, optionalParameters ) {
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

			function indexStore( index, store ) {
				// summary:
				//		Index all existing records in the store. If the object store already
				//		contains data which violates the index constraints, we must NOT throw
				// 		an exception here, instead queue an operation to abort the "versionchange"
				//		transaction which was used for the createIndex call.
				//		(see the transaction._commit() method for additional details).
				// index:
				//		The IDBIndex in which the keys are stored.
				// store:
				//		The IDBObjectStore to index.
				// tag:
				//		Private
				var refRecords  = store._records;
				var store = store;

				try {
					refRecords.forEach( function (record) {
						index._addStoreRecord(record);
					});
				} catch(err) {
					// Queue an operation to abort the versionchange transaction if there
					// is one otherwise stick the index as the source on the exception and
					// re-throw it.
					err.source = index;
					index._clear();
					if (store.transaction) {
						setTimeout( function() {
							store.transaction.abort(err);
						}, 0);
					} else {
						throw err;
					}
				}
			}

			var storeName = store.name;
			var dbStore   = objectStores[storeName];

			if (dbStore) {
				var indexes = indexByStore[storeName] || {};
				if (!indexes[indexName]) {
					var index   = new IDBIndex( dbStore, indexName, keyPath, optionalParameters );
					if (index) {
						var indexNames = dbStore.indexNames.toArray();
						indexNames.push(indexName);
						dbStore.indexNames = new DOMStringList( indexNames );
						indexes[indexName] = index;
						indexByStore[storeName] = indexes;

						indexStore( index, dbStore );
						return index;
					}
				} else {
					throw new DOMException("ConstraintError", "Index with name ["+name+"] already exists" );
				}
			}
		}

		this.deleteDatabase = function () {
			// summary:
			//		Delete the database.
			// tag:
			//		Public
			this.deletePending = true;
			this.ready = false;

			var storeNames = Object.keys( objectStores );
			storeNames.forEach( this.deleteStore, this );
			this._destoyed = true;
		}

		this.deleteIndex = function (/*String*/ storeName, /*String*/ indexName ) {
			// summary:
			//		Delete an index.
			// storeName:
			//		Store name whose index is to be deleted.
			// indexName:
			//		Index name.
			// tag:
			//		Public
			var store = objectStores[storeName];
			var index;

			if (store && !store._destroyed) {
				var indexes = indexByStore[storeName] || {};
				if( index = indexes[indexName] ) {
					delete indexes[indexName];
					index._destroy();

					var indexNames = Object.keys(indexes);
					store.indexNames = new DOMStringList( indexNames );
				} else {
					throw new DOMException("NotFoundError");
				}
			} else {
				// TODO: database is corrupted, store MUST exist.
			}
		}

		this.deleteStore = function (storeName) {
			// summary:
			//		Delete a store
			// storeName:
			//		Store name.
			// tag:
			//		Public
			var store = objectStores[storeName];
			if (store) {
				if (!store._destroyed) {
					var indexes    = indexByStore[storeName] || {};
					var indexNames = Object.keys(indexes);

					try {
						store._beingDestroyed = true;
						indexNames.forEach( function (indexName) {
							this.deleteIndex(storeName, indexName);
						}, this);
					} catch(err) {
						console.error(err);
					} finally {
						delete indexByStore[storeName];
						delete objectStores[storeName];
						delete store._beingDestroyed;
						store._destroy();
					}
				}
			} else {
				throw new DOMException("NotFoundError")
			}
		};

		this.getStoreNames = function () {
			// summary:
			//		Get the list of object store names in the database.
			// returns:
			//		DOMStringList sorted in ascending order.
			// tag:
			//		Public
			var storeNames = Object.keys( objectStores ).sort();
			return new DOMStringList( storeNames );
		}

		this.getIndexByStore = function (storeName) {
			// summary:
			//		Get the indexes for a given object store.
			// storeName:
			//		Store name for which to get the index(es).
			// returns:
			//		JavaScript key value pair object: { keyValuePair+ }
			// tag:
			//		Public
			return indexByStore[storeName] || {};
		}

		this.getStores = function (/*(String|String[])?*/ names) {
			// summary:
			// names:
			// returns:
			//		JavaScript key value pair object: { keyValuePair+ }
			// tag:
			//		Public
			var stores = {};
			if (names) {
				if (typeof names === "string")  {
					stores[names] = objectStores[names];
				} else 	if (names instanceof Array) {
					names.forEach( function (name) {
						stores[name] = objectStores[name];
					});
				}
			} else {
				// Return a copy of all objectStores...
				var storeNames = Object.keys( objectStores ).sort();
				return this.getStores(storeNames);
			}
			return stores;
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
		}

		this.signalReady = function () {
			// summary:
			//		Fire a 'ready' signal at the database but only once. This method is
			//		called by IDBFactory when a versionchange transaction completes.
			//		(See also versionChange() for additional details).
			// tag:
			//		Public
			if (!this.ready) {
				this.dispatchEvent( new Event("ready") );
			}
			this.ready = true;
		}

		this.versionChange = function () {
			// summary:
			//		Clear the database ready state. When a database connection wants to
			//		initiate a versionchange transaction it calls this method so no new
			//		connections are allowed until the transaction completes.
			//
			// NOTE:
			//		Both this	method and signalReady() are used to alleviate a potential
			//		race condition when the database is opened in repid succession each
			//		open request with a different database version.	This race condition
			//		is currently called-out as an issue in the indexedDB standard.
			//		For additional information see:
			//
			//			http://www.w3.org/TR/IndexedDB/#versionchange--transaction-steps
			// tag:
			//		Public
			this.ready = false;
		}

		//=========================================================================

		if (databaseOptions) {
			if (objectType.call(databaseOptions) === "[object Object]") {
				if (dbStores = databaseOptions.stores) {
					dbStores = ((dbStores instanceof Array) ? dbStores : [dbStores]);
				} else if (dbURL = databaseOptions.url) {
					dbURL = url.resolve( dbURL, dbPath );
				}
			} else {
				throw DOMException("InvalidAccessError", "Invalid databaseOptions parameter");
			}
		}
		// Add a local 'error' event handler which merely counts the number of error
		// events that are dispatched. An error count greater than zero will prevent
		// the 'load' event from being dispatched.
		this.addEventListener( "error", function () {errorCount++;} );

		if (dbStores) {
			loadStores( dbStores );
		} else if (dbURL) {
			var result = Loader.metaData( this, dbURL );
			result.then( function (metaData) {
				this.description = metaData.description || "";
				if (dbStores = metaData.stores) {
					loadStores( dbStores );
				}
			},
			function (event) {
				database.dispatchEvent(event);
			});
		} else {
			fireLoad();
		}
	}

	// Inherit from EventTarget
	Database.prototype = new EventTarget;
	Database.prototype.constructor = Database;

	return Database;
});
