define([], function () {
"use strict";

	function Promise () {
		// summary:
		//		Abstract Promise. All other promises, that is PromiseA and PromiseF
		//		are derived from this class.
		//  tag:
		//		Abstract interface

		this.then = function (resolved, rejected, progressed) {
			console.error("Abstract only.");
			throw new Error("Abstract only.");
		};

		this.resolve = function (val) {
			console.error("Abstract only.");
			throw new Error("Abstract only.");
		};

		this.reject = function (ex) {
			console.error("Abstract only.");
			throw new Error("Abstract only.");
		};
	}
	return Promise;
});