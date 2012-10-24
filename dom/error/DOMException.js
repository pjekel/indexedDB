//
// Copyright (c) 2012, Peter Jekel
// All rights reserved.
//
//	The indexedDB implementation is released under to following two licenses:
//
//	1 - The "New" BSD License			 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L13)
//	2 - The Academic Free License	 (http://trac.dojotoolkit.org/browser/dojo/trunk/LICENSE#L43)
//
define([],function(){

	var ERROR_NAMES = {
		"AbortError" 									: { text: "The operation was aborted.", code: 20 },
		"DataCloneError" 							: { text: "The object can not be cloned.", code: 25 },
		"HierarchyRequestError" 			: { text: "The operation would yield an incorrect node tree.", code: 3 },
		"IndexSizeError" 							: { text: "The index is not in the allowed range.", code: 1 },
		"InvalidAccessError" 					: { text: "The object does not support the operation or argument.", code: 15 },
		"InvalidCharacterError" 			: { text: "The string contains invalid characters.", code: 5 },
		"InvalidModificationError" 		: { text: "The object can not be modified in this way.", code: 13 },
		"InvalidNodeTypeError" 				: { text: "The supplied node is incorrect or has an incorrect ancestor for this operation.", code: 24 },
		"InvalidStateError" 					: { text: "The object is in an invalid state.", code: 11 },
		"NamespaceError" 							: { text: "The operation is not allowed by Namespaces in XML. [XMLNS]", code: 14 },
		"NetworkError" 								: { text: "A network error occurred.", code: 19 },
		"NoModificationAllowedError"	: { text: "The object can not be modified.", code: 7 },
		"NotFoundError" 							: { text: "The object can not be found here.", code: 8 },
		"NotSupportedError" 					: { text: "The operation is not supported.", code: 9 },
		"QuotaExceededError" 					: { text: "The quota has been exceeded.", code: 22 },
		"SecurityError" 							: { text: "The operation is insecure.", code: 18 },
		"SyntaxError" 								: { text: "The string did not match the expected pattern.", code: 12 },
		"TypeMismatchError" 					: { text: "The type of the object does not match the expected type.", code: 17 },
		"TimeoutError" 								: { text: "The operation timed out.", code: 23 },
		"URLMismatchError"	 					: { text: "The given URL does not match another URL.", code: 21 },
		"WrongDocumentError"	 				: { text: "The object is in the wrong document.", code: 4 },

		// The following are a set of indexedDB extensions

		"ConstraintError" 						: { text: "A mutation operation in the transaction failed because a constraint was not satisfied.", code: 0 },
		"DataError" 									: { text: "Data provided to an operation does not meet requirements.", code: 0 },
		"ReadOnlyError" 							: { text: "The mutating operation was attempted in a 'readonly' transaction.", code: 0 },
		"TransactionInactiveError" 		: { text: "A request was placed against a transaction which is currently not active, code: 0 }, or which is finished.", code: 0 },
		"UnknownError" 								: { text: "The operation failed for reasons unrelated to the database itself and not covered by any other errors.", code: 0},
		"VersionError" 								: { text: "An attempt was made to open a database using a lower version than the existing version.", code: 0}
	};

	function DOMException (type, message) {
		if (type != undefined) {
			var err = Error.call(this, message);
			if (type in ERROR_NAMES) {
				if (!message) {
					err.message = ERROR_NAMES[type].text;
				}
				err.code = ERROR_NAMES[type].code;
			} else {
				err.code = 0;
			}
			err.name = type || "DOMError";
			return err;
		}
	}

	DOMException.prototype = new Error();
	DOMException.prototype.constructor = DOMException;

	return DOMException;
});
