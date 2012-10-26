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
				"../error/DOMError",
				"./EventDefault",
				"./Event"
			], function (lang, DOMError, EventDefault, Event) {
"use strict";
	// module:
	//		indexedDB/EventTarget
	//
	//	http://www.w3.org/TR/dom/		(DOM4)
	//	http://www.w3.org/TR/DOM-Level-3-Events/

	// Requires JavaScript 1.8.5
	var defineProperty = Object.defineProperty;

	var moduleName = "indexedDB/EventTarget";

	var PROPERTY = "parentNode";
	var NONE            = 0,
			CAPTURING_PHASE = 1,
			AT_TARGET       = 2,
			BUBBLING_PHASE  = 3;

	var BEFORE = 0,
			AFTER  = 1;

	function validatePath(/*EventTarget[]*/ path, /*EventTarget*/ target ) {
		// summary:
		//		Validate the propagation path. This function is called whenever a specific
		//		path is specified when dispatching an event. Each target in the path must
		//		be an instance of EventTarget. If the path is the event target itself or
		//		an empty array the event is only fired at the target.
		// path:
		//		Event target or an array of event targets.
		// target:
		//		The Event target.
		// tag:
		//		private
		var path = (path instanceof Array) ? path : [path];
		var validPath = path.filter( function(evtTarget) {
											return ( (evtTarget instanceof EventTarget) && evtTarget != target);
										});
		return validPath;
	}

	function propagate(/*EventTarget[]*/ path, /*Number*/ eventPhase, /*Event*/ event ) {
		// summary:
		// path:
		//		The propagation path which is an array of event targets.
		// eventPhase:
		//		Propagation phase. The eventPhase is either CAPTURING_PHASE, AT_TARGET or
		//		BUBBLING_PHASE
		// event:
		//		Event to be dispatched.
		// tag:
		//		Private
		event.eventPhase = eventPhase;
		path.some( function (currentTarget) {
			if (currentTarget instanceof EventTarget) {
				var listeners = currentTarget._getEventListener(event.type);
				if (listeners) {
					event.currentTarget = currentTarget;
					listeners.some( function (listener) {
						if ((eventPhase == CAPTURING_PHASE && !listener.useCapture) ||
								(eventPhase == BUBBLING_PHASE && listener.useCapture)) {
							return;
						}
						// Make sure the event propagation is not interrupted and that any
						// exceptions thrown inside a handler are caught here.
						try {
							listener.handleEvent.call( currentTarget, event );
						} catch(err) {
							console.error( err );
							event.error = err;
						}
						return event.stopImmediate;
					});
				}
			}
			return event.stopped;
		});
		return !event.stopped;
	}

	var EventListener = function (handleEvent, useCapture) {
		// summary:
		//		Create a simple local EventListener object.
		//		http://www.w3.org/TR/DOM-Level-3-Events/#interface-EventListener
		// handleEvent:
		//		The method to be called whenever an event occurs of the event type for
		//		which the EventListener interface was registered.
		// useCapture:
		//		If true, the method handleEvent is triggered in the capture and target
		//		phases only, i.e., the event listener will not be triggered during the
		//		bubbling phase.
		// tag:
		//		Private
		this.handleEvent = handleEvent;
		this.useCapture  = !!useCapture;
	}

	function EventTarget() {
		// summary:
		//		Implements the DOM Level 3 and DOM4 EvenTarget interface.
		//		http://www.w3.org/TR/dom/#interface-eventtarget
		// tag:
		//		Public

		var eventTypes = {};

		defineProperty( this, "parentNode", {	enumerable: false, 	writable: true });

		this._getEventListener = function (/*String*/ type ) {
			// summary:
			//		Return the list of event listeners for a given event type.
			// type:
			return lang.clone(eventTypes[type]);
		}
		defineProperty( this, "_getEventListener", {enumerable: false});

		this.addEventListener = function (/*String*/ type, /*EventListener*/ listener, /*Boolean?*/ useCapture) {
			// summary:
			//		Registers an event listener, depending on the useCapture parameter,
			//		on the capture phase of the DOM event flow or its target and bubbling
			//		phases.
			// type:
			//		Specifies the Event.type associated with the event for which the user
			//		is registering.
			// listener:
			//		The listener parameter must be either an object that implements the
			//		EventListener interface, or a function.
			// useCapture:
			//		If true, useCapture indicates that the user wishes to add the event
			//		listener for the capture and target phases only, i.e., this event
			//		listener will not be triggered during the bubbling phase. If false,
			//		the event listener must only be triggered during the target and bubbling
			//		phases.
			// tag:
			//		Public
			if (typeof type === "string" && (listener && lang.isFunction(listener.handleEvent || listener))) {
				// Remove any existing entry as only one per listener is allowed.
				this.removeEventListener( type, listener, useCapture );
				var handleEvent = listener.handleEvent || listener;
				var listenerObj = new EventListener( handleEvent, useCapture  );
				var listeners   = eventTypes[type];
				var target      = this;
				if (listeners) {
					listeners.push(listenerObj);
				} else {
					eventTypes[type] = [listenerObj];
				}
				// Return a dojo style 'remove' object.
				return { remove:
										function() {
											target.removeEventListener(type, listener, useCapture);
										}
								};
			}
		}

		this.on = function (/*String*/ type, /*EventListener*/ listener) {
			// summary:
			//		Registers an event listener. This method is to provide support for
			//		the dojo/on module but can also be use as an alias for addEventListener.
			//		However, this method only registers event listeners for the bubble phase.
			// type:
			//		Specifies the Event.type associated with the event for which the user
			//		is registering. Type is either a string or a list of comma separated
			//		types.
			// listener:
			//		The listener parameter must be either an object that implements the
			//		EventListener interface, or a function.
			// tag:
			//		Public
			if (type && listener) {
				// Check if the type parameter is a comma separated string.
				var types = type.split(/\s*,\s*/);
				if (types.length > 1) {
					var handles = [];
					types.forEach( function (type) {
						handles.push(this.addEventListener( type, listener, false ));
					}, this);
					handles.remove = function(){
						for(var i = 0; i < handles.length; i++){
							handles[i].remove();
						}
					};
					return handles;
				}
				return this.addEventListener( type, listener, false );
			}
		}

		this.removeEventListener = function (/*String*/ type, /*EventListener|Function*/ listener,
																					/*Boolean?*/ useCapture) {
			// summary:
			//		Removes an event listener. Calling removeEventListener with arguments
			//		which do not identify any currently registered EventListener on the
			//		EventTarget has no effect.
			// type:
			//		Specifies the Event.type for which the user registered the event listener.
			// listener:
			//		The EventListener to be removed.
			// useCapture:
			//		Specifies whether the EventListener being removed was registered for
			//		the capture phase or not. If a listener was registered twice, once
			//		for the capture and target phases and once for the target and bubbling
			//		phases, each must be removed separately. Removal of an event listener
			//		registered for the capture and target phases does not affect the same
			//		event listener registered for the target and bubbling phases, and vice
			//		versa.
			// tag:
			//		Public
			if (typeof type === "string" && (listener && lang.isFunction(listener.handleEvent || listener))) {
				var handleEvent = listener.handleEvent || listener;
				var listeners   = eventTypes[type];
				var useCapture  = !!useCapture;
				if (listeners) {
					listeners.some( function (listenerObj, index) {
						if (listenerObj.handleEvent === handleEvent && listenerObj.useCapture === useCapture) {
							listeners.splice(index, 1);
							return true;
						}
					});
					if (listeners.length == 0) {
						delete eventTypes[type];
					}
				}
			}
		}

		this.dispatchEvent = function (/*Event*/ event, /*EventTarget[]?*/ propagationPath) {
			// summary:
			//		Dispatches an event into the implementation's event model. If no path
			//		was specified it will be compiled using the existing hierarchy.
			// event:
			//		The event to be dispatched.
			// propagationPath:
			//		The event propagation path. If omitted, the propagtion path is the
			//		list of all ancestors of the event target. (See PROPERTY).
			// tag:
			//		Public

			if (event instanceof Event) {
				if (event.eventPhase === NONE && event.type) {
					var parent = this[PROPERTY];
					var result = false;
					var path   = [];

					if (propagationPath) {
						path = validatePath( propagationPath, this );
					} else {
						while (parent) {
							path.unshift(parent);
							parent = parent[PROPERTY];
						}
					}
					event.target = this;

					// Trigger any default actions required BEFORE dispatching
					if (!event.defaultPrevented) {
						EventDefault.trigger(event, "before");
					}

					if (!event.stopped) {
						if (propagate(path, CAPTURING_PHASE, event)) {
							if (propagate([this], AT_TARGET, event) && event.bubbles) {
								propagate(path.reverse(), BUBBLING_PHASE, event);
							}
						}
					}
					// Trigger any default actions required AFTER dispatching
					if (!event.defaultPrevented) {
						EventDefault.trigger(event, "after");
					} else {
						result = true;
					}
					// Reset the event allowing it to be re-dispatched.
					event.currentTarget = null;
					event.eventPhase    = NONE;
					event.initEvent();

				} else {
					throw new DOMError( "InvalidStateError" );
				}
			} else {
				throw new TypeError( moduleName+"::dispatchEvent(): Invalid event.");
			}
			return result;
		}

//		this.ownerDocument = document;

	} /* end EventTarget() */

	return EventTarget;
});
