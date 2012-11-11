define(["dojo/_base/lang",
				"dojo/Deferred",
				"dojo/Evented",
				"dojo/when"
			 ], function (lang, Deferred, Evented, when) {

	var EventedStore = function (/*Store*/ store) {

		var orgMethods = {};
		var mutex      = null;

		store = lang.delegate(store, new Evented());
		store.__evented = true;

		function addHandler( method, action ) {
			if (store[method] && typeof store[method] === "function") {
				orgMethods[method] = store[method];
				store[method] = action;
			}
		}

		function lock( action ) {
			when( mutex, function () {
				mutex = new Deferred();
				action();
			});
		}

		function unlock() {
			mutex.resolve();
		}

		addHandler( "add", function(object, options) {
			var result = orgMethods["add"].apply(store, arguments);
			when( result, function(id) {
				if (id) {
					store.emit("onNew", {item: object});
				}
			});
		});

		addHandler( "put", function(object, options) {
			var args = arguments;
			lock( function() {
				when( store.get( store.getIdentity(object) ), function (storeItem) {
					var orgItem = storeItem ? lang.clone(storeItem) : null;
					var result  = orgMethods["put"].apply(store, args);
					when( result, function(id) {
						unlock();
						if (id) {
							if (orgItem) {
								store.emit("onChange", {item: object, oldItem: orgItem});
							} else {
								store.emit("onNew", {item: object});
							}
						}
					});
				}, function (event) {
						unlock();
				});
			});
		});

		addHandler( "remove", function(id, options) {
			var args = arguments;
			lock( function() {
				when( store.get( store.getIdentity(id) ), function (storeItem) {
					var orgItem = storeItem ? lang.clone(storeItem) : null;
					var result  = orgMethods["remove"].apply(store, args);
					when( result, function() {
						unlock();
						if (orgItem) {
							store.emit("onDelete", {item: orgItem});
						}
					});
				}, function (event) {
						unlock();
				});
			});
		});

		return store;

	};
	return EventedStore;
});
