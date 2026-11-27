import {
	PRIME_CATALOG_PAGE_BYTES,
	readPrimeHydrationJson,
} from "./catalog-page";
import { object, primePublicRecord, type PublicRecord } from "./metadata";
import { createPrimePageReader } from "./page-reader";
import { parsePrimePageUrl, primeObservedLink } from "./url";

export function readRetailSeasonAnchor(
	html: string,
	url: string,
): PublicRecord | null {
	const route = parsePrimePageUrl(url);
	const raw = readPrimeHydrationJson(html);
	if (!route || !raw) return null;
	const { origin } = route.url;
	const body = object(
		object(object(object(JSON.parse(raw)).init).preparations).body,
	);
	let anchor: PublicRecord | null = null;
	for (const section of [body.atf, body.btf]) {
		const state = object(object(section).state);
		if (state.pageTitleId !== route.token) return null;
		const self = object(state.self)[route.token];
		if (!self) continue;
		const record = primePublicRecord(self, route.token, origin);
		if (
			record?.type !== "season" ||
			record.sequence !== 1 ||
			record.linkUrl !== url ||
			(anchor && (record.id !== anchor.id || record.compact !== anchor.compact))
		)
			return null;
		anchor = record;
	}
	return anchor;
}

/** One bounded read per active first-season link. Failed reads can recover.
 * The next SDK snapshot rechecks the current roster before using the result. */
export function createRetailSeasonAnchor() {
	let entry: {
		url: string;
		controller: AbortController;
		record: PublicRecord | null;
		retryAt: number;
	} | null = null;
	return {
		read(url: string): PublicRecord | null {
			if (entry?.url === url && Date.now() < entry.retryAt) return entry.record;
			if (primeObservedLink(url, location.origin) !== url) return null;
			entry?.controller.abort();
			const controller = new AbortController();
			const current = {
				url,
				controller,
				record: null as PublicRecord | null,
				retryAt: Infinity,
			};
			entry = current;
			const timer = setTimeout(() => controller.abort(), 10000);
			const read = createPrimePageReader(
				controller.signal,
				() => !controller.signal.aborted,
				PRIME_CATALOG_PAGE_BYTES,
			);
			void read(url, "text/html")
				.then((html) => {
					current.record = readRetailSeasonAnchor(html, url);
				})
				.catch(() => {})
				.finally(() => {
					clearTimeout(timer);
					if (!current.record) current.retryAt = Date.now() + 60000;
				});
			return null;
		},
		stop() {
			entry?.controller.abort();
			entry = null;
		},
	};
}
