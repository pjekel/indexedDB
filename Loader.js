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
				"dojo/Deferred",
				"dojo/request/xhr",
				"./dom/event/Event",
				"./IDBObjectStore",
				"./util/Keys"
			 ], function (lang, Deferred, xhr, Event, IDBObjectStore, Keys) {
	"use strict";

	var loaderOptions = {url: null, data: null, dataType: "json"};

	function correctException( error ) {
		// summary:
		//		Work-around for a dojo 1.8.x XHR bug. Whenever a XHR requests fails the
		//		server response is still processed by the handleAs handler resulting in
		//		in an incorrect error name (SyntaxError) and message.
		// Note:
		//		Bug filed as: http://bugs.dojotoolkit.org/ticket/16223
		// tag:
		//		Private
		if (error.response) {
			switch (error.response.status) {
				case 404:
					error.message = error.response.url;
					error.name    = "NotFoundError";
			}
		}
	}

	function loadFromData(/*Object|Array*/ dataset, /*Object*/params) {
		// summary:
		//		Load the store with an in memory dataset.
		// dataset:
		//		Array of JavaScript objects or a legacy ItemFileReadStore object.
		//		If the data is a legacy data object no conversion will take place
		//		and a warning is displayed.
		// store:
		//		The IDBObjectStore for which the data is being loaded.
		// ldrDef:
		//		A Deferred (promise) associated with the overall load process.
		// tag:
		//		Private
		var dataArray = dataset;
		var deferred  = params.deferred;
		var objStore  = params.store;
		var unique    = params.unique;
		var keyPath;

		if (Object.prototype.toString.call(dataset) === "[object Object]") {
			// Try a legacy dojo/data/ItemFileReadStore style dataset.
			if (dataset.items) {
				keyPath = dataset.identifier || objStore.keyPath;
				if (!unique || !keyPath) {
					objStore.autoIncrement = true;
					objStore.keyPath       = null;
				}
				console.warn("Legacy ItemFileReadStore data format is deprecated.");
				dataArray = dataset.items;
			} else {
				// TODO: What if it's not a dojo/data/ItemFileReadStore style object...
			}
		}
		var result = {store: objStore, status:200, message:"OK"};
		var value;

		if (dataArray instanceof Array) {
			try {
				dataArray.forEach( function(object) {
					value = object;
					objStore._storeRecord( {store: objStore, value: object, noOverwrite: unique} );
				});
				deferred.resolve(result);
			} catch(err) {
				// Something is wrong with the data, clear the objStore and reject the load
				// request.  The object that violated the objStore constraints is stored on
				// the event as the 'data' property.  The most likely reason for failure
				// are errors related to the key path or lack thereof.
				var event = new Event( "error", {source: objStore, error: err, data: value});
				objStore._clearRecords( objStore );
				deferred.reject(event);
			}
		} else {
			var event = new Event( "error", {source: objStore, error: new TypeError("Invalid dataset"), status: 0});
			deferred.reject(event);
		}
	}

	function loadFromURL(/*string*/ url, /*Object*/ params ) {
		// summary:
		//		Load the store data from the location identified by the URL. A XHR GET
		//		request is issued and on successful completion an attempt is made to
		//		add the data to the object store.
		// url:
		//		The URL of the remote JSON file to be loaded.
		// dataType:
		//		Identifies the type of data to be loaded. The default is 'json'
		// store:
		//		The IDBObjectStore for which the data is being loaded.
		// ldrDef:
		//		A Deferred (promise) associated with the overall load process.
		// tag:
		//		Private
		var result = xhr(url, {method:"GET", handleAs: params.dataType, preventCache: true, failOK: true});
		result.then(
			function(data) {			// xhr success
				loadFromData( data, params );
			},
			function(err) {			// xhr failed
				correctException(err);
				var event = new Event( "error", { source: params.store, error: err, status: err.response.status });
				params.deferred.reject(event);
			});
	}

	var Loader = {

		metaData: function (/*Database*/ database, /*String*/ url ) {
			// summary:
			//		Load the database meta data file. A meta data file contains the store
			//		and index definitions for the database.
			// database:
			//		Database for which to load the meta data file.
			// url:
			//		URL of the meta data file.
			// returns:
			//		A promise.
			// tag:
			//		Private
			var ldrDef = new Deferred();
			var result = xhr(url, {method:"GET", handleAs: "json", preventCache: true});
			result.then(
				function (data) {
					ldrDef.resolve(data);
				},
				function (err) {
					correctException(err);
					var event = new Event( "error", {source: database, error: err, status: err.response.status});
					ldrDef.reject(event);
				}
			);
			return ldrDef.promise;
		},

		store: function (/*IDBObjectStore*/ store, optionalParameters ) {
			// summary:
			//		The store Loader implements a remote store loader with a simple API.
			//		The optionalParameters arguments supports two properties to identify
			//		the data to be loaded.  In order to keep the loader module as simple
			//		as possible no object store control logic is included. As a result the
			//		loader must only be called by the database module when creating a new
			//		database. (see database.js).  The loader returns a promise which will
			//		resolve as soon as the data is loaded or rejected if loading failed.
			// store:
			//		The IDBObjectStore for which the data is being loaded.
			// optionalParameters:
			//		url:
			//				The URL of the remote JSON file to be loaded.
			//		data:
			//				An in memory JavaScript object or array. If both the url and data
			//				properties are specified the data property takes precedence.
			//		dataType:
			//				Identifies the type of data to be loaded. For example 'json'
			// returns:
			//		A promise.
			// tag:
			//		Private
			var ldrDef = new Deferred();
			var result;

			if (store instanceof IDBObjectStore) {
				var storeOptions = lang.mixin( loaderOptions, optionalParameters || {});
				var source = storeOptions.data || storeOptions.url || null;
				var params = { deferred: ldrDef, dataType: storeOptions.dataType, unique: storeOptions.unique,
											 store: store };

				if (source) {
					if (storeOptions.url) {
						loadFromURL( source, params );
					} else {
						loadFromData( source, params );
					}
				} else {
					// Loader called without a data source, resolve deferred immediately.
					result = {store: store, status:200};
					ldrDef.resolve( result );
				}
			} else {
				// Not a valid store instance.
				var event = new Event( "DataError", {source: store, error: new TypeError("Invalid object store"),
																							status: 400});
				ldrDef.reject( event );
			}
			return ldrDef.promise;
		}
	} /* end Loader() */

	return Loader;

});