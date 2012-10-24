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
	"use strict";

	var	moduleName = "indexedDB/util/url";

	// Requires JavaScript 1.8.5
	var defineProperty = Object.defineProperty;
	var freezeObject   = Object.freeze;

	var urlRegExp = new RegExp( "^(([^:\/?#]+):)?" +                       // scheme
		                       "(\/\/(([^@]*)@)?([^\/:?#]*))?(:([0-9]*))?" +  // authority
		                       "(([^?#]*)" +                                  // path
		                       "((\\?([^#]*))?" +                             // query
		                       "(#(.*))?)?)"                                  // fragment
												 );

	var _url = {};

	var Location = function () {
		// summary:
		//		Create a WorkerLocation instance.
		//
		// 		(See http://www.w3.org/TR/html5/  Chapter 2.6 URLs)
		//		(See http://www.w3.org/TR/workers/#workerlocation
		// tag:
		//		Private
		this.protocol   = "";
		this.hostname   = "";
		this.port       = "";
		this.pathname   = "";
		this.search     = "";
		this.hash       = "";

		defineProperty( this, "host", {
				get: function() {
							return this.hostname + (this.port ? (":" + this.port) : "");
						},
				configurable: false,
				enumerable: true
			});

		defineProperty( this, "href", {
				get: function () {
							return (this.protocol ? this.protocol : "") +
											(this.host ? ("//" + this.host) : "") +
											this.pathname + this.search + this.hash;
						 },
				configurable: false,
				enumerable: true
			});

		this.toString = function() {return this.href;}
		defineProperty( this, "toString", {	enumerable: false	});
	}

	_url.compare = function (/*String*/ urlA, /*String*/ urlB, /*String?*/ baseURL ) {
		// summary:
		//		Compare two URLs. Both URLs are first resolved and normalized using the
		//		optional base URL.  The URL normalization includes: case normalization,
		//		Scheme-Based and Percent-Encoding normalization.
		// urlA:
		//		First URL
		// urlB:
		//		Second URL
		// baseURL:
		//		Optional base URL to be used to resolve both URLs in case the URLs are
		//		relative references.
		// returns:
		//		-1, 0 or 1
		// tag:
		var locA = _url.resolve( urlA, baseURL, true );
		var locB = _url.resolve( urlB, baseURL, true );
		if (locA < locB) {
			return -1;
		} else if (locA > locB) {
			return  1;
		}
		return 0;
	}

	_url.getBaseLocation = function (/*String?*/ url, /*Boolean?*/ useDefaults ) {
		// summary:
		// url:
		// useDefaults:
		// tag:
		//		Public
		var parent   = this.ownerDocument || window.document || document;
		var location = url ? _url.parse(url) : parent.location;
		var baseLoc  = new Location();
		var segments, property;

		if (location) {
			for (var prop in baseLoc) {
				// When running is strict mode check if object property is writable.
				property = Object.getOwnPropertyDescriptor(baseLoc, prop);
				if (property.writable || property.set) {
					baseLoc[prop] = location[prop] || "";
				}
			}
			if (!baseLoc.protocol) {
				if (useDefaults) {
					if (!baseLoc.host) {
						if (baseLoc.pathname.match(/^localhost(\/|$)/i)) {
							baseLoc.pathname = baseLoc.pathname.match(/^localhost(\/.*|$)/i)[1];
							baseLoc.hostname = "localhost";
						}
					}
					baseLoc.protocol = "http:";
				} else {
					throw new TypeError("Base URI must be absolute.");
				}
			}
			// Drop the last segment
			segments = baseLoc.pathname.split("/");
			segments.pop();
			baseLoc.pathname = segments.join("/") + "/";
		}
		return baseLoc;
	}

	_url.getLocation = function (/*String?*/  url, /*Boolean?*/ useDefaults) {
		// summary:
		//		Returns a read-only WorkerLocation object. The scheme, hostname and
		//		pathname are normalized in accordance to rfc3986.
		//		(See http://www.w3.org/TR/workers/ for additional info).
		// url:
		//		A URL string. If the URL is omitted the base URL for the document is
		//		returned if available.
		// useDefaults:
		//		Indicates if default values are to be applied if URL components are
		//		missing. For example, if the scheme or host is omitted 'http' and
		//		'localhost' are used respectively.
		// returns:
		//		WorkerLocation object.
		// tag:
		//		Public
		var absoluteURL = _url.resolve( url, null, useDefaults );
		var location    = _url.parse( absoluteURL );

		freezeObject( location );		// Make object read-only
		return location;
	}

	_url.getOrigin = function (/*String?*/ url, /*Boolean?*/ useDefaults) {
		// summary:
		//		Returns the origin of a URL. The origin is composed of the scheme,
		//		hostname and port
		// url:
		//		A URL string. If the URL is omitted the origin of the document is
		//		returned if available.
		// useDefaults:
		//		Indicates if default values are to be applied if URL components are
		//		missing.
		// returns:
		//		Origin string
		// tag:
		//		Public
		var location = this.getLocation(url, useDefaults);
		var origin   = location.protocol + "//" + location.host;
		return origin;
	}

	_url.isRelative = function (/*String*/url, /*Boolean*/ pathOnly ) {
		// summary:
		//		Evaluate if a given URL is a relative reference (e.g. not absolute).
		// url:
		//		URL to evaluate.
		// pathOnly:
		//		If true, only the path portion of a URL is allowed.
		// tag:
		//		Public
		var location = _url.parse(url);
		return !(location.protocol || (pathOnly && (location.hostname || location.port)));
	}

	_url.parse = function(/*String*/ url ) {
		// summary:
		//		Parse a URL and return a location object with the URL decomposition
		//		IDL attributes. (See http://www.w3.org/TR/html5/  Chapter 2.6 URLs)
		//		Note: No normalization is performed on any of the URL components.
		// tag:
		//		Public
		var url = url || "";
		var component = url.match( urlRegExp );
		var location  = new Location();

		// Note: The ':', '?' and '#' characters are not part of the rfc3986 <scheme>,
		//			 <query> or <fragment> productions. However, HTML5 ($2.6.6) states they
		//			 must be included in the location properties.

		location.protocol   = component[1] || "";
		location.hostname   = component[6] || "";
		location.port       = component[8] || "";
		location.pathname   = component[10] || "";
		location.search     = component[12] || "";
		location.hash       = component[14] || "";

		return location;
	}

	_url.resolve = function (/*String*/ url, /*String?*/ baseURL, /*Boolean?*/ useDefaults ) {
		// summary:
		//		RFC3986 $5.2.2 Transform References
		// url:
		//		The URL to be resolved. If the URL is a relative reference it is resolved
		//		using the base URL.
		// baseURL:
		//		Base URL used to resolve the URL. Technically the base URL must be an
		//		absolute URL, that is, it must at least have a scheme.  However, when
		//		parameter useDefaults is true the base URL can also be relative.
		// useDefaults:
		//		Indicates if default values are to be applied if base URL components are
		//		missing.
		// tag:
		function removeDotSegments(/*String*/ pathname ) {
			// summary:
			//		Remove any invalid or extraneous dot-segments prior to forming the
			//		target URI.(See rfc3986 $5.2.4 Remove Dot Segments).
			var newPath = pathname || "";
			if (newPath.match(/\.|\/\//)) {
				var segments = pathname.split("/");
				var suffix   = segments[segments.length-1] ? "" : "/";
				var prefix   = segments[0] ? "" : "/";
				var newSegm  = [];

				for (var i = 0; i < segments.length; i++) {
					if (segments[i] != "." && segments[i] != "") {
						if (segments[i] ==  "..") {
							newSegm.pop();
						} else {
							newSegm.push(segments[i]);
						}
					}
				}
				newPath = prefix + newSegm.join("/") + suffix;
			}
			return newPath
		}

		function normalize(/*Location*/ location) {
			// summary:
			//		Perform three levels of URL normalization.  First decode percent
			//		encoded unreserved characters, second character case and finally
			//		scheme based normalization is applied.
			// location:
			//		Location object whose properties need normalization.
			// tag:
			//		Private
			function decodeUnreserved( property ) {
				// Percent-Encoding Normalization (rfc3986 $6.2.2.2)
				return property.replace(/\%([0-9,a-f][0-9,a-f])/gi, function(match, p1) {
					var ascii = parseInt(p1, 16);
					// Decode any percent encoded unreserved characters.
					switch (ascii) {
						case 0x2D:
						case 0x2E:
						case 0x5F:
						case 0x7E:
							return String.fromCharCode(ascii);
						default:
							if( (ascii >= 0x41 && ascii <= 0x5A) || (ascii >= 0x61 && ascii <= 0x7A)) {
								return String.fromCharCode(ascii);
							}
							break;
					}
					return match.toUpperCase();
				});
			}
			// Percent-Encoding Normalization (rfc3986 $6.2.2.2)
			location.protocol = decodeUnreserved( location.protocol );
			location.hostname = decodeUnreserved( location.hostname );
			location.pathname = decodeUnreserved( location.pathname );

			// Case Normalization (rfc3986 $6.2.2.1)
			location.protocol = location.protocol.toLowerCase();
			location.hostname = location.hostname.toLowerCase();

			// Scheme-Based Normalization (rfc3986 $6.2.3)
			switch (location.protocol) {
				case "http:":
					location.hostname = location.hostname || "localhost";
					location.pathname = location.pathname || "/";
					location.port     = (location.port == 80) ? "" : location.port;
					break;
			}
		}

		var baseLoc = _url.getBaseLocation(/*String*/ baseURL, /*Boolean?*/ useDefaults );
		var urlLoc  = _url.parse( url );

		// Check if the URL is just 'localhost'
		if (!urlLoc.host) {
			if (urlLoc.pathname.match(/^localhost(\/|$)/i)) {
				urlLoc.pathname = urlLoc.pathname.match(/^localhost(\/.*|$)/i)[1];
				urlLoc.hostname = "localhost";
			}
		}

		// Transform References.
		if (!urlLoc.protocol) {
			if (!urlLoc.host) {
				if (!urlLoc.pathname) {
					urlLoc.pathname = baseLoc.pathname;
					if (!urlLoc.search) {
						urlLoc.search = baseLoc.search;
					}
				} else {
					if (!urlLoc.pathname.match(/^\//)) {
						// Merge base and url paths dropping the last segment of the base path.
						var baseSegm = baseLoc.pathname.split("/");
						baseSegm.pop();
						urlLoc.pathname = baseSegm.join("/") + "/" + urlLoc.pathname;
					}
				}
				urlLoc.hostname = baseLoc.hostname;
				urlLoc.port     = baseLoc.port;
			}
			urlLoc.protocol = baseLoc.protocol;
		}
		urlLoc.pathname = removeDotSegments( urlLoc.pathname );
		normalize(urlLoc);

		return urlLoc.href;
	}

	return _url;
});
