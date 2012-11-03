//
// Copyright (c) 2012, Peter Jekel
// All rights reserved.
//
//	The indexedDB implementation is released under to following two licenses:
//
//	1 - The "New" BSD License			 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//
define(["./dom/event/EventTarget",
				"./dom/event/Event",
				"./Database",
				"./IDBDatabase",
				"./IDBTransaction"
			], function (EventTarget, Event, Database, Connection, Transaction){
	"use strict";

	var moduleName = "indexedDB/IDBWorker";
	var IDLE = 0,
			PENDING = 1,
			ACTIVE = 2,
			REPEAT = 3,
			DONE = 4;

	// Requires JavaScript 1.8.5
	var defineProperty = Object.defineProperty;
	var freezeObject = Object.freeze;

	function IDBWorker () {
		// summary:
		//		Implements the Worker which is the IDBtransaction manager. A transaction
		//		is submitted to the worker using the postMessage() method of the worker.
		//		The worker response can be recieved by establishing a 'onmessage' event
		//		handler. (Note, the indexedDB worker is created by IDBEnvironment).
		//		(See: http://www.w3.org/TR/workers/).
		// example:
		//	|		myWorker = new IDBWorker();
		//	|		myWorker.onmessage = function (event) {
		//	|						...
		//	|		};
		//
		//		Alternatively:
		//
		//	|		myWorker = new IDBWorker();
		//	|		myWorker.addEventListener("message", function (event) {
		//	|						...
		//	|		};
		//
		// tag:
		//		Public

		var transactions = [];			// List of all transactions.
		var activeTrans  = [];			// List of active transactions.
		var IDBWorker    = this;

		var messageCallback;
		var messageHndl;

		EventTarget.call(this);			// Inherit from EventTarget

		defineProperty( this, "onmessage", {
			get:	function() {return messageCallback || undefined;},
			set:	function(callback) {
							if (typeof callback === "function") {
								if (messageHndl) {
									messageHndl.remove();
								}
								messageHndl = this.addEventListener("message", callback);
								messageCallback = callback;
							}
						},
			configurable: false,
			enumerable: true
		});

		defineProperty( this, "active", {get: function() {return activeTrans;}, enumerable:true});
		//=======================================================================

		function execute( transaction ) {
			// summary:
			//		Initiate the execution of a transaction.   Calling this method does
			//		not quarentee the transaction is actually started, it may be queued
			//		due to constraints on the current execution environment.
			// transaction:
			//		Transaction to execute.
			// tag:
			//		Private
			if (transaction instanceof Transaction) {
				if ( !(transaction._done || transaction._aborted) ) {

					// Add eventlisteners so we can cleanup on completion or abort.
					// Because an abort event could arrive before the transaction is
					// started the event handlers are added here.

					transaction.addEventListener("done", onDone);
					transactions.push(transaction);
					transaction._state = PENDING;
					startTransactions( [transaction] );
				}
				return transaction;
			} else {
				throw new TypeError("Invalid transaction");
			}
		}

		function onDone(event) {
			// summary:
			//		Local transaction 'done' event handler. Whenever a transaction is
			//		done, that is, finished or aborted, this event handler is called.
			//		The transaction is remove from all internal lists and the result
			//		is posted.
			// event:
			//		DOM style event.
			// tag:
			//		Private
			var transaction  = event.target;
			var database     = transaction.db._database;

			function removeFromList( list, transaction ) {
				// summary:
				//		Remove a transaction from a list (array) of transactions.
				// list:
				//		List of transactions.
				// transaction:
				//		Transaction to remove.
				// tag:
				//		Private
				var idx = list.indexOf(transaction);
				if (idx != -1) {
					list.splice(idx,1);
				}
			}

			removeFromList(activeTrans, transaction);
			removeFromList(transactions, transaction);

			transaction.removeEventListener("done", onDone );
			postMessage( transaction, transaction.error );
			// Start the next transaction(s) if any.
			startTransactions( IDBWorker.getTransactions( database ) );
		}

		function postMessage( result, error ) {
			// summary:
			//		Post the result. The result and/or error are packaged in a DOM style
			//		event with two additional properties: 'data' and 'error'
			//
			//		interface messageEvent : Event {
			//			attribute data  any;
			//			attribute error DOMError;
			//		}
			//
			//		(See: http://www.w3.org/TR/workers/)
			// result:
			// error:
			// tag:
			//		Private
			var event = new Event("message", {data: result, error: error});
			IDBWorker.dispatchEvent( event );
		}

		function startTransactions(/*Transaction[]*/ transList ) {
			// summary:
			//		Start transaction(s). The list of transactions is searched for all
			//		idle transactions if any. Of those transactions the one's that do
			//		not violate the indexedDB transaction constraints are started.
			// transList:
			//		List of transactions to search.
			// tag:
			//		Private

			// TODO: Make sure we give ample time to read-write transactions even if we are
			//			 flooded with read-only transactions...

			transList.forEach( function(transaction) {
				if (transaction._state != ACTIVE) {
					if( !violateConstraint( transaction )) {
						activeTrans.push(transaction);
						transaction._start();
					}
				}
			});
		}

		function violateConstraint( transaction ) {
			// summary:
			//		Evaluate if a transaction would violate any of the indexedDB transaction
			//		constraints given the currently active transactions.
			// transaction:
			//		Transaction to evaluate.
			// returns:
			//		True or false.
			// tag:
			//		Private

			function overlap(tranList, transaction) {
				// summary:
				//		Evaluate if the scope of a transaction overlaps with any of the
				//		transactions in the give transaction list.
				// transaction:
				//		Transaction to evaluate.
				// returns:
				//		True or false.
				// tag:
				//		Private
				var storeName;

				return tranList.some(function(trans) {
					for (storeName in transaction._scope) {
						if (storeName in trans._scope) {
							return true;
						}
					}
				});
			}

			// List of active transaction for a given database.
			var activeByDB = activeTrans.filter( function(trans) {
													if (trans.db._database == transaction.db._database) {
														return ( !(trans._done || trans._aborted) );
													}
												});
			var vcTrans = activeByDB.some( function(trans) {
											return (trans.mode == IDBTransaction.VERSION_CHANGE);
										});
			if (!vcTrans && activeByDB.length > 0) {
				switch (transaction.mode) {
					case IDBTransaction.READ_ONLY:
						// Read-only transactions can run concurrent
						var rwTrans = activeByDB.filter( function(trans) {
														 return (trans.mode != IDBTransaction.READ_ONLY);
													 });
						return overlap(rwTrans, transaction);
					case IDBTransaction.READ_WRITE:
						// A read-write transaction can only start if there is no other active
						// transaction or if its scope does not overlap other transactions.
						return overlap(activeByDB, transaction);
					case IDBTransaction.VERSION_CHANGE:
						return true;
				}
			}
			return vcTrans;
		}

		//=======================================================================

		this.getVCTransaction = function (/*Database*/ database ) {
			// summary:
			//		Test if there is any active 'versionchange' transaction running for a
			//		given database. If true, the VC transaction is returned.
			// database:
			//		Database
			// returns:
			//		An IDBTransaction with mode VERSION_CHANGE or null
			// tag:
			//		Public
			var vcTrans = this.getTransactions(database, IDBTransaction.VERSION_CHANGE, true);
			if (vcTrans.length) {
				return vcTrans[0];
			}
			return null;
		}

		this.getTransactions = function(/*IDBDatabase|Database?*/ database, /*String?*/ mode, /*Boolean?*/ active ) {
			// summary:
			//		Returns a list of transactions for a given database or connection,
			//		mode and state.
			// database:
			//		Database or IDBDatabase (connection)
			// mode:
			//		Transaction mode.
			// active:
			// tag:
			//		Public
			if( (database instanceof Database) || (database instanceof Connection)) {
				var transList = transactions.slice(0);
				if (database) {
					var isDatabase = (database instanceof Database);
					transList = transList.filter( function(tran) {
												if ( !(tran._done || tran._aborted) ) {
													return (isDatabase ? (tran.db._database == database) : (tran.db == database));
												}
											});
				}
				if (mode) {
					transList = transList.filter( function(tran) {
												return (tran.mode == mode && !(tran._done || tran._aborted));
											});
				}
				if (active != undefined) {
					transList = transList.filter( function(tran) {
												return ((active && tran._state == ACTIVE) || (!active && tran._state != ACTIVE));
											});
				}
				return freezeObject(transList);
			} else {
				throw new TypeError("Invalid database");
			}
		}

		this.postMessage = function (/*any*/ data, /*Boolean*/ sync) {
			// summary:
			//		Implements the Web Worker postMessage interface. A message is submitted
			//		to the worker using the postMessage() method.
			// data:
			//		Data to process, in this case a IDBTransaction.
			// sync:
			// tag:
			//		Public
			var data = data;

			if (!sync) {
				setTimeout( function() {
					execute(data);
				}, 0 );
			} else {
				execute(data);
			}
		}

	};

	// Inherit from EventTarget
	IDBWorker.prototype = new EventTarget();
	IDBWorker.prototype.constructor = IDBWorker;

	return IDBWorker;

});
