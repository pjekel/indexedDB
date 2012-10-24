//
// Copyright (c) 2012, Peter Jekel
// All rights reserved.
//
//	The indexedDB implementation is released under to following two licenses:
//
//	1 - The "New" BSD License			 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//
define([], function() {

// module:
//
//	http://www.w3.org/TR/DOM-Level-3-Events/

	var moduleName = "indexedDB/EventDefaults";

	var eventActions = {};

	function ActionList () {
		this.before = [];
		this.after  = [];
	}

	function addAction (/*String*/ aspect, /*String*/ type, /*Function*/ action,
												/*context*/ scope /*[, arg1[, arg2[, ...]]]*/ )  {
		// summary:
		//		Associate a default action with an event type. The default action can be
		//		triggered either 'before' or 'after' the event is dispatched depending
		//		on the aspect parameter.
		// aspect:
		//		Identifies when the default action is called, that is, either 'before'
		//		or 'after' the event is dispatched.
		// type:
		//		Specifies the event type for which a default action is being registered.
		// action:
		//		The function called as the default action for the event type. The action
		//		is called as:
		//
		//				action( event [, arg1[, arg2[, ...]]]);
		//
		//		the optional arguments is the variable list of arguments following the
		//		scope parameter.
		// scope:
		//		The scope to use when calling the default action. When specified the
		//		'this' object for the action routine will be the scope.
		// tag:
		//		Private

		if (typeof type === "string") {
			if (typeof action === "function") {
				var optinalArgs = Array.prototype.slice.call(arguments,4);
				var actionList  = eventActions[type] || new ActionList();
				var actionDef   = { action: action, scope: scope, args: optinalArgs };

				actionList[aspect].push(actionDef);
				eventActions[type] = actionList;
			} else {
				throw new Error( "Parameter 'action' is not a callable object." );
			}
		} else {
			throw new Error( "Parameter 'type' is missing or not a string." );
		}
	}

	return {

		after: function (/*String*/ type, /*Function*/ action, /*context*/ scope ) {
			// summary:
			// tag:
			//		Public
			var args = Array.prototype.slice.call(arguments, 0);
			args.unshift("after");
			addAction.apply( this, args );
		},

		before: function (/*String*/ type, /*Function*/ action, /*context*/ scope ) {
			// summary:
			// tag:
			//		Public
			var args = Array.prototype.slice.call(arguments, 0);
			args.unshift("before");
			addAction.apply( this, args );
		},

		trigger: function (event, aspect) {
			// summary:
			//		Trigger all registered default actions associated with a specific event
			//		type. If an action callback invokes event.preventDefault() all remaining
			//		action callbacks will be skipped.
			// event:
			//		The event for which the default action(s) are triggered. The event itself
			//		is passed to the action callback as the first argument.
			// aspect:
			//		The aspect determines which action type is triggered, 'before' or 'after'.
			// tag:
			//		Public

			var actionList = eventActions[event.type];
			var actionArgs;

			if (actionList) {
				actionList[aspect].some( function (action) {
					try {
						actionArgs = action.args;
						actionArgs.unshift(event);
						action.action.apply( (action.scope || event.target), actionArgs );
					} catch(err) {
						event.error = err;
					}
					return event.defaultPrevented;
				});
			}
		}
	}

});
