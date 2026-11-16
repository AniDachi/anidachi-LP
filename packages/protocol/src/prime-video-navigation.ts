import { z } from "zod";
import {
	PrimeVideoProviderIdSchema,
	primeVideoSourceUrl,
} from "./prime-video-identity";
/** Browser addresses are provider evidence, never the persisted room identity. */
export const PRIME_VIDEO_DOMAIN_ROOTS = [
	"primevideo.com",
	"amazon.com",
	"amazon.co.uk",
	"amazon.de",
	"amazon.co.jp",
	"amazon.ca",
	"amazon.in",
	"amazon.com.mx",
] as const;
export const PRIME_CONTENT_MATCHES = PRIME_VIDEO_DOMAIN_ROOTS.flatMap((host) =>
	host === "primevideo.com"
		? [`https://*.${host}/*`]
		: [
				`https://*.${host}/gp/video/*`,
				`https://*.${host}/*/gp/video/*`,
				`https://*.${host}/dp/*`,
				`https://*.${host}/*/dp/*`,
			],
);
/** Bound DNS labels before checking a dot-separated official domain suffix. */
export function primeDomainFamily(hostname: string) {
	const host = hostname.toLowerCase();
	if (
		host.length > 253 ||
		!host
			.split(".")
			.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
	)
		return undefined;
	return PRIME_VIDEO_DOMAIN_ROOTS.find(
		(root) => host === root || host.endsWith(`.${root}`),
	);
}
export function hasPrimeBrowserHost(value: string): boolean {
	try {
		// Classification intentionally includes known-family non-source pages, so
		// they cannot fall through to the generic HTML5 adapter.
		return !!primeDomainFamily(new URL(value).hostname);
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
		!primeDomainFamily(raw[1]!) ||
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
		if (primeDomainFamily(url.hostname) === "primevideo.com") {
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
			!/^https:\/\/[^/?#]+$/.test(origin) ||
			!primeDomainFamily(origin.slice("https://".length))
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

export const PrimeMarketplaceSchema = z.enum(PRIME_VIDEO_DOMAIN_ROOTS);
export type PrimeMarketplace = z.infer<typeof PrimeMarketplaceSchema>;
export const PrimeNavigationSchema = z
	.strictObject({
		contentId: PrimeVideoProviderIdSchema,
		routes: z
			.array(
				z.strictObject({
					url: z
						.string()
						.max(2048)
						.refine((value) => {
							const route = parsePrimePageUrl(value);
							return (
								!!route &&
								!route.url.search &&
								!route.url.hash &&
								primeObservedLink(value, route.url.origin) === value
							);
						}),
					observedAt: z.iso.datetime({ offset: true }),
				}),
			)
			.min(1)
			.max(8),
	})
	.superRefine((value, ctx) => {
		if (
			value.routes.some((route) => {
				const parsed = parsePrimePageUrl(route.url);
				return parsed?.token.length === 26 && parsed.token !== value.contentId;
			})
		)
			ctx.addIssue({
				code: "custom",
				message: "Compact navigation route must match content",
			});
		const families = value.routes.map((route) => {
			try {
				return primeDomainFamily(new URL(route.url).hostname);
			} catch {
				return undefined;
			}
		});
		if (
			new Set(families).size !== families.length ||
			new TextEncoder().encode(JSON.stringify(value)).length > 16384
		)
			ctx.addIssue({
				code: "custom",
				message: "Duplicate marketplace or oversized navigation",
			});
	});
export type PrimeNavigation = z.infer<typeof PrimeNavigationSchema>;
export function primeNavigationMatches(
	navigation: PrimeNavigation | undefined,
	sourceUrl: string,
	provider?: string,
): boolean {
	return (
		!navigation ||
		((provider === undefined || provider === "primevideo") &&
			sourceUrl === primeVideoSourceUrl(navigation.contentId))
	);
}
export type PrimeLaunchResolution =
	| { status: "ready"; url: string }
	| {
			status: "choice-required" | "regional-route-unknown";
			choices: { url: string; marketplace: PrimeMarketplace }[];
	  };
/** Navigation only: a selected destination never establishes playback identity. */
export function resolvePrimeLaunch(input: {
	contentId: string;
	navigation?: PrimeNavigation;
	marketplace?: PrimeMarketplace;
	currentVerifiedOrigin?: string;
}): PrimeLaunchResolution {
	const id = PrimeVideoProviderIdSchema.parse(input.contentId);
	const navigation = input.navigation
		? PrimeNavigationSchema.parse(input.navigation)
		: undefined;
	if (navigation && navigation.contentId !== id)
		throw new Error("Prime navigation identity mismatch");
	const canonical = primeVideoSourceUrl(id);
	const choices = [
		...(navigation?.routes ?? []).map((route) => ({
			url: route.url,
			marketplace: primeDomainFamily(new URL(route.url).hostname)!,
		})),
		{ url: canonical, marketplace: "primevideo.com" as const },
	];
	const market =
		input.marketplace ??
		(input.currentVerifiedOrigin
			? primeDomainFamily(new URL(input.currentVerifiedOrigin).hostname)
			: undefined);
	if (market === "primevideo.com") return { status: "ready", url: canonical };
	if (market) {
		const exact = choices.find((choice) => choice.marketplace === market);
		return exact
			? { status: "ready", url: exact.url }
			: { status: "regional-route-unknown", choices };
	}
	return choices.some((choice) => choice.marketplace !== "primevideo.com")
		? { status: "choice-required", choices }
		: { status: "ready", url: canonical };
}
/** Explicit legacy projection; old strict readers must never receive new keys. */
export function stripPrimeNavigation<T>(value: T): T {
	if (Array.isArray(value)) return value.map(stripPrimeNavigation) as T;
	if (value && typeof value === "object")
		return Object.fromEntries(
			Object.entries(value)
				.filter(([key]) => key !== "primeNavigation")
				.map(([key, child]) => [key, stripPrimeNavigation(child)]),
		) as T;
	return value;
}
export function samePrimeNavigation(
	left: PrimeNavigation | undefined,
	right: PrimeNavigation | undefined,
): boolean {
	const key = (v: PrimeNavigation | undefined) =>
		v ? JSON.stringify([v.contentId, v.routes.map((r) => r.url).sort()]) : "";
	return key(left) === key(right);
}
/** Validate every flattened read source without widening canonical identity. */
export function primeNavigationTreeMatches(value: unknown): boolean {
	const queue: unknown[] = [value];
	let count = 0;
	while (queue.length) {
		if (++count > 100000) return false;
		const row = queue.pop();
		if (!row || typeof row !== "object") continue;
		if (Array.isArray(row)) {
			queue.push(...row);
			continue;
		}
		const record = row as Record<string, unknown>;
		if (record.primeNavigation !== undefined) {
			const parsed = PrimeNavigationSchema.safeParse(record.primeNavigation);
			if (
				!parsed.success ||
				typeof record.sourceUrl !== "string" ||
				!primeNavigationMatches(
					parsed.data,
					record.sourceUrl,
					typeof record.provider === "string" ? record.provider : undefined,
				)
			)
				return false;
		}
		queue.push(...Object.values(record));
	}
	return true;
}
