//
// WARNING:
//
//		The dojo build system WILL fail with errors due to certain function names
//		required by the W3C indexedDB interface standard, those functions are:
//
//			IDBObjectStore.delete()
//			IDBCursor.delete()
//			IDBCursor.continue()
//
//		If an indexedDB build is required you MUST change those function names, this
//		however will result in a non-compliant indexedDB interface implementation.

var testResourceRe = /^indexedDB\/tests\//;
var copyOnly = function(filename, mid) {
	var list = {
		"indexedDB/build/indexedDB.profile":1,
		"indexedDB/build/indexedDB.build":1,
		"indexedDB/build/package.json":1
	};
	return (mid in list);
};

var profile = {

	releaseDir: "../release",
	basePath : "..",
	action: "release",
	cssOptimize: "comments",
	optimize: "closure",
	layerOptimize: "closure",
	selectorEngine: "acme",
	mini: true,

	layers: {
		"dojo/dojo": {
				include: [
					"dojo/dojo",
					"dojo/_base/array",
					"dojo/_base/lang",
					"dojo/request/xhr"
				],
				customBase: true,
				boot: true
		},
		"indexedDB/main": {
				include: [
					"indexedDB/dom/error/DOMError",
					"indexedDB/dom/error/DOMException",
					"indexedDB/dom/event/Event",
					"indexedDB/dom/event/EventDefault",
					"indexedDB/dom/event/EventTarget",
					"indexedDB/dom/string/DOMStringList",
					"indexedDB/promise/Promise",
					"indexedDB/promise/PromiseA",
					"indexedDB/promise/PromiseF",
					"indexedDB/promise/PromiseList",
					"indexedDB/util/Keys",
					"indexedDB/util/url",
					"indexedDB/IDBCursor",
					"indexedDB/IDBDatabase",
					"indexedDB/IDBEnvironment",
					"indexedDB/IDBFactory",
					"indexedDB/IDBIndex",
					"indexedDB/IDBKeyRange",
					"indexedDB/IDBObjectStore",
					"indexedDB/IDBOpenRequest",
					"indexedDB/IDBRequest",
					"indexedDB/IDBTransaction",
					"indexedDB/IDBWorker",
					"indexedDB/Database",
					"indexedDB/Loader",
					"indexedDB/Record"
				]
		}
	},

	resourceTags: {
		test: function(filename, mid){
			var result = testResourceRe.test(mid);
			return testResourceRe.test(mid) || mid == "indexedDB/tests" || mid == "indexedDB/demos";
		},

		amd: function(filename, mid) {
			return !testResourceRe.test(mid) && !copyOnly(filename, mid) && /\.js$/.test(filename);
		},

		copyOnly: function(filename, mid) {
			return copyOnly(filename, mid);
		},

		miniExclude: function(filename, mid){
			var result = testResourceRe.test(mid) || /^indexedDB\/demos\//.test(mid);
			return result;
		}
	}
};
