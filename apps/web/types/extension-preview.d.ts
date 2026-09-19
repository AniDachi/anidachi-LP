// The imported extension logo checks for this optional API before falling back
// to /Anidachi_logo.png. This declaration supplies types, not a browser runtime.
declare const chrome:
	| {
			runtime?: { getURL?: (path: string) => string };
	  }
	| undefined;
