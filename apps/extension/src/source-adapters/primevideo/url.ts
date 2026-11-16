/** Browser addresses are provider evidence, never the persisted room identity. */
export const PRIME_VIDEO_HOSTS = [
	"www.primevideo.com",
	"www.amazon.com",
	"www.amazon.co.uk",
	"www.amazon.de",
	"www.amazon.co.jp",
	"www.amazon.ca",
	"www.amazon.in",
	"www.amazon.com.mx",
] as const;
export const PRIME_CONTENT_MATCHES = PRIME_VIDEO_HOSTS.flatMap((host) =>
	host === "www.primevideo.com"
		? [`https://${host}/*`]
		: [
				`https://${host}/gp/video/*`,
				`https://${host}/*/gp/video/*`,
				`https://${host}/dp/*`,
				`https://${host}/*/dp/*`,
			],
);
export function hasPrimeBrowserHost(value: string): boolean {
	try {
		return (PRIME_VIDEO_HOSTS as readonly string[]).includes(
			new URL(value).hostname,
		);
	} catch {
		return false;
	}
}
export type PrimeRoute = { token: string; url: URL };
const isToken = (value: string) =>
	/^(?:[A-Z0-9]{26}|[A-Z0-9]{10}|amzn1\.dv\.gti\.[a-z0-9-]{1,100})$/.test(
		value,
	);
export function parsePrimePageUrl(value: string): PrimeRoute | null {
	if (value.length > 8192 || /[\\\s\x00-\x1f\x7f]/.test(value)) return null;
	// Inspect raw authority/path before URL normalization can erase ports or traversal.
	const raw = /^https:\/\/([^/?#]+)([^?#]*)/.exec(value);
	if (
		!raw ||
		!/^[a-z.]+$/.test(raw[1]!) ||
		/%(?:2e|2f|5c|25)|(?:^|\/)\.{1,2}(?:\/|$)/i.test(raw[2]!)
	)
		return null;
	try {
		const url = new URL(value);
		if (!hasPrimeBrowserHost(value) || url.username || url.password || url.port)
			return null;
		if (
			[...url.searchParams.keys()].some((key) =>
				/^(?:asin|gti|compactgti|titleid|episodeid|contentid)$/i.test(key),
			)
		)
			return null;
		let path = decodeURIComponent(url.pathname)
			.replace(/\/ref=[^/]*$/, "")
			.replace(/\/$/, "");
		path = path
			.replace(/^\/region\/[a-z0-9-]{2,16}(?=\/)/, "")
			.replace(
				/^(?:\/-\/[a-z]{2,3}(?:[_-][A-Z]{2})?|\/[a-z]{2,3}[_-][A-Z]{2})(?=\/)/,
				"",
			);
		const parts = path.split("/").slice(1);
		let rest: string[];
		if (url.hostname === "www.primevideo.com") {
			if (parts[0] !== "detail") return null;
			rest = parts.slice(1);
		} else if (
			parts[0] === "gp" &&
			parts[1] === "video" &&
			parts[2] === "detail"
		)
			rest = parts.slice(3);
		else if (parts[0] === "dp") rest = parts.slice(1);
		else if (parts.length === 3 && parts[1] === "dp" && !isToken(parts[0]!))
			rest = parts.slice(2);
		else return null;
		if (rest.length < 1 || rest.length > 2 || !isToken(rest.at(-1)!))
			return null;
		if (
			rest.length === 2 &&
			(isToken(rest[0]!) || !/^[\p{L}\p{N}_-]{1,200}$/u.test(rest[0]!))
		)
			return null;
		return { token: rest.at(-1)!, url };
	} catch {
		return null;
	}
}
/** Same-origin observed links only. No redirect, guessed alias or query identity. */
export function primeObservedLink(
	value: unknown,
	origin: string,
): string | null {
	if (
		typeof value !== "string" ||
		value.length > 2048 ||
		value.startsWith("//")
	)
		return null;
	try {
		const base = new URL(origin);
		if (
			base.origin !== origin ||
			!hasPrimeBrowserHost(origin) ||
			!/^https:\/\/[a-z.]+$/.test(origin)
		)
			return null;
		const absolute = value.startsWith("/") ? `${origin}${value}` : value;
		const parsed = parsePrimePageUrl(absolute);
		if (!parsed || parsed.url.origin !== origin) return null;
		return `${origin}${parsed.url.pathname.replace(/\/ref=[^/]*$/, "").replace(/\/$/, "")}`;
	} catch {
		return null;
	}
}
export function primeRouteMatches(
	token: string,
	record: {
		id: string;
		compact: string;
		linkToken: string;
		aliases?: string[];
	},
): boolean {
	return (
		token === record.id ||
		token === record.compact ||
		token === record.linkToken ||
		!!record.aliases?.includes(token)
	);
}
