define(["./Promise", "./PromiseA"], function (Promise, PromiseA) {
	"use strict";

	function PromiseList (/*Promise[]*/ promises) {
		// summary:
		// promises:
		// returns:
		//		A new promise.
		// tag:
		//		Public
		var promise = new PromiseA();
		var list = [];

		function resolved () {
			// summary:
			// tag:
			//		Private
			if (list) {
				if (list.every( function (aPromise){
							return (aPromise.resolved);
						})) {
					promise.resolve();
					list = undefined;
				}
			}
		}

		function rejected () {
			// summary:
			// tag:
			//		Private
			promise.reject();
			list = undefined;
		}

		if (promises instanceof Array) {
			list = promises.slice(0);
			promises.forEach( function (aPromise, idx) {
				if (aPromise instanceof Promise) {
					aPromise.then( resolved, rejected );
				} else {
					list[idx] = undefined;
				}
			});
//			resolved();
		} else {
			promise.resolve();
		}
		return promise;
	}
	return PromiseList;
});