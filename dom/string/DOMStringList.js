//
// Copyright (c) 2012, Peter Jekel
// All rights reserved.
//
//	The indexedDB implementation is released under to following two licenses:
//
//	1 - The "New" BSD License			 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//
define ([], function () {
	"use strict";

	function argsToItems() {
		// summary:
		//		Convert the arguments list into an array of strings. The arguments
		//		in the arguments list can be almost any type.
		// tag:
		//		Private
		var args = Array.prototype.slice.call(arguments);
		var items = [];

		args.forEach( function( argument ) {
			if (typeof argument === "string" || argument instanceof String) {
				items.push( argument );
			} else if (typeof argument === "number" || argument instanceof Number) {
				items.push( argument.toString() );
			} else if (typeof argument === "boolean" || argument instanceof Boolean) {
				items.push( argument.toString() );
			} else if (argument instanceof Array) {
				items = items.concat( argsToItems.apply( this, argument ));
			} else if (argument instanceof DOMStringList) {
				items = items.concat( argsToItems.apply( this, Array.prototype.slice.call(argument) ));
			} else {
				throw TypeError("Invalid parameter type");
			}
		});
		return items;
	}

	// Requires JavaScript 1.8.5
	function DOMStringList() {
		// summary:
		//		Implements the DOMStringList
		//		http://www.w3.org/TR/DOM-Level-3-Core/core.html#DOMStringList
		// tag:
		//		Public
		var items  = [];

		this.length = 0;

		if (arguments.length > 0) {
			items = argsToItems.apply(this, arguments );
			if (items.length > 0) {
				items.forEach( function( item, idx ) {
					Object.defineProperty( this, idx, {	value: item, enumerable: true, writable: false	});
				}, this);
			}
			this.length = items.length;
			items = [];
		}

		//=========================================================================
		// Private helper functions

		Object.defineProperty( this, "toArray", {
			value:	function () {return Array.prototype.slice.call(this);},
			enumerable: false
		});

		Object.defineProperty( this, "toString", {
			value:	function () {return Array.prototype.toString.call(items);},
			enumerable: false
		});

		Object.defineProperty( this, "sort", {
			value:	function () {return new DOMStringList( this.toArray().sort() );},
			enumerable: false
		});

		Object.defineProperty( this, "diff", {
			value: 	function(str) {
								if (!(str instanceof DOMStringList)) {
									str = new DOMStringList(str1);
								}
								var i, diff = [];
								for(i=0; i<str.length; i++) {
									if (!this.contains(str.item(i))) {
										diff.push(str.item(i));
									}
								}
								return new DOMStringList(diff);
							},
			enumerable: false
		});

		//=========================================================================
		// Public properties and methods

		Object.defineProperty( this, "length", {
			writable: false,
			enumerable: true
		});

		this.contains = function(/*String*/ string ) {
			// summary:
			//		Returns true if a given string is part of the DOMStringList otherwise
			//		false
			// tag:
			//		Public
			if (this.toArray().indexOf(string) != -1) {
				return true;
			}
			return false;
		}

		this.item = function(/*Number*/ index) {
			// summary:
			//	Returns the indexth item in the collection. If index is greater than
			//	or equal to the number of DOMStrings in the list, this returns null.
			// tag:
			//		Public
			if (index >= 0 && index <= this.length -1) {
				return this[index];
			}
			return null;
		}

	}

	return DOMStringList;
});
