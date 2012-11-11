define(["dojo/_base/declare",
				"dojo/_base/lang",
				"dojo/Deferred",
				"dojo/has",
				"dojo/store/util/SimpleQueryEngine",
				"dojo/store/util/QueryResults",
				"indexedDB/util/Keys"
			 ], function (declare, lang, Deferred, has, SimpleQueryEngine, QueryResults, Keys) {

	// Requires JavaScript 1.8.5
	var defineProperty = Object.defineProperty;
	var moduleName = "indexedStore/store/Store";

	var indexedDBStore = declare(null, {
		// summary:
		//		The indexedDBStore layers a /dojo/store API on top of an actual W3C
		//		indexedDB object store (IDBObjectStore).

		//==============================
		// Parameters to constructor

		database: null,
		name: null,

		// End Parameters to constructor
		//==============================

		parentIndex: "parent",
		parentAttr: "parent",
		keyPath: "id",
		indexes: null,

		// queryEngine: Function
		//		Defines the query engine to use for querying the data store
		queryEngine: SimpleQueryEngine,

		constructor: function (/*IDBDatabase*/ database, /*String*/ name, /*Object*/options) {
			// summary:
			// tag:
			//		Public

			this.database = database;
			this.name = name;

			for(var i in options){
				this[i] = options[i];
			}

			if (name) {
				if (has("indexedDB") && database) {
					var storeNames = database.objectStoreNames;
					if (storeNames && storeNames.contains) {
						if (storeNames.contains(name)) {
							var transaction = database.transaction(name);
							var objectStore = transaction.objectStore(name);
							try {
								var index = objectStore.index(this.parentIndex);
								this.parentAttr = index.keyPath;
							} catch(err) {
								this.parentIndex = null;
							}
							// Capture some store info.
							this.indexes = objectStore.indexNames;
							this.keyPath = objectStore.keyPath;

						} else {
							throw new Error( moduleName+"::constructor(): Store name ["+name+"] not in database");
						}
					} else {
						throw new Error( moduleName+"::constructor(): Database is not an IDBDatabase");
					}
				} else {	// No database
				}
			} else {
				throw new Error( moduleName+"::constructor(): name parameter required");
			}
			defineProperty( this, "database", {writable: false});
			defineProperty( this, "indexes", {writable: false});
		},

		_execDbRequest: function(/*String*/ method /*==== vargs ====*/) {
			// summary:
			// method:
			// vargs:
			//		Variable list of arguments.
			// tag:
			//		Private
			var transMode = IDBTransaction.READ_ONLY;
			var deferred  = new Deferred();

			switch (method) {
				case "add": case "put": case "delete":
					transMode = IDBTransaction.READ_WRITE;
					break;
			}
			try {
				var transaction = this.database.transaction(this.name, transMode);
				var objectStore = transaction.objectStore(this.name);

				var method  = objectStore[method];
				var args    = Array.prototype.slice.call(arguments, 1);
				var request = method.apply( objectStore, args );

				request.onsuccess = function (event) {
					deferred.resolve( this.result );
				}
				request.onerror = function (event) {
					deferred.reject( this.error );
				}
			} catch(err) {
				deferred.reject( err );
			}
			return deferred.promise;
		},

		add: function (object, options) {
			// summary:
			// returns:
			//		A /dojo/promise/Promise
			// tag:
			//		Public
			var key = options ? options.key || options.id : null;
			return this._execDbRequest( "add", object, key );
		},

		get: function (key) {
			// summary:
			// returns:
			//		A /dojo/promise/Promise
			// tag:
			//		Public
			return this._execDbRequest( "get", key );
		},

		getChildren: function (parent, options) {
			// summary:
			// returns:
			//		A /dojo/promise/Promise
			// tag:
			//		Public
			var deferred = new Deferred();
			var children = [];
			var query = {};
			var self = this;
			var key;

			if (key = this.getIdentity(parent)) {
				if (this.parentIndex && this.parentAttr) {
					try {
						var transaction = this.database.transaction(this.name, IDBTransaction.READ_ONLY);
						transaction.oncomplete = function (event) {
							deferred.resolve( children );
						};
						transaction.onabort = function (event) {
							deferred.reject(event.target.error);
						};
						var objectStore = transaction.objectStore(this.name);
						var index = objectStore.index(this.parentIndex);
						var request = index.openCursor(key);
						request.onsuccess = function (event) {
							var cursor = this.result;
							if (cursor) {
//								children.push( lang.clone(cursor.value) );
								children.push( cursor.value );
								cursor.continue();
							}
						};
						request.onerror = function (event) {
							deferred.reject(this.error);
						}
					} catch (error) {
						deferred.reject(error);
					}
				} else {
					// No parent index.
					query[this.parentAttr] = key;
					return self.query( query, options );
				}
			} else {
				throw new Error( "Parent object has no valid key" );
			}
			return QueryResults(deferred.promise);
		},

		getIdentity: function (object) {
			// summary:
			// returns:
			//		A string
			// tag:
			//		Public
			if (Object.prototype.toString.call(object) !== "[object Object]") {
				throw new Error( moduleName+"::getIndentity(): invalid object specified");
			}
			return Keys.keyValue( this.keyPath, object );
		},

		put: function (object, options) {
			// summary:
			// returns:
			//		A /dojo/promise/Promise
			// tag:
			//		Public
			var key, overwrite = true;
			if (options) {
				overwrite = options.overwrite != undefined ? options.overwrite : true;
				key       = options.key || options.id || null;
			}
			return this._execDbRequest( overwrite ? "put" : "add", object, key );
		},

		query: function (query, options) {
			var deferred = new Deferred();
			var transaction;
			var records = [];
			var self = this;

			transaction = this.database.transaction(this.name, IDBTransaction.READ_ONLY);
			transaction.oncomplete = function (event) {
				var execQuery = self.queryEngine(query, options);
				deferred.resolve( execQuery( records ) );
			}
			var objectStore = transaction.objectStore(this.name);
			var request = objectStore.openCursor();
			request.onsuccess = function (event) {
				var cursor = this.result;
				if (cursor) {
					records.push(cursor.value);
					cursor.continue();
				}
			};
			request.onerror = function (event) {
				deferred.reject(this.error);
			}
			// Decorate the result so it can become observable.
			return QueryResults(deferred.promise);
		},

		remove: function (key) {
			// summary:
			// returns:
			//		A /dojo/promise/Promise
			// tag:
			//		Public
			return this._execDbRequest("delete", key);
		}

	});

	return indexedDBStore;
});
