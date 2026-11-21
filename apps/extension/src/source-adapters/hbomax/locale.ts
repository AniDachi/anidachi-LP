/** HBO can start with a language tag and add the profile's region as its player initializes. */
export function resolveHboLocale(expected: string, actual: string): string | null {
	try {
		const a = new Intl.Locale(expected), b = new Intl.Locale(actual);
		if (a.language !== b.language || a.maximize().script !== b.maximize().script ||
			(a.region && b.region && a.region !== b.region)) return null;
		return a.region ? expected : actual;
	} catch { return null; }
}
