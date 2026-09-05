// A disposable read cache, never the canonical history/outbox. Session storage
// survives popup and service-worker teardown but not a browser/extension restart.
export const WATCH_BROWSE_FRESH_MS = 30_000;
export const WATCH_BROWSE_MAX_AGE_MS = 5 * 60_000;
const STORAGE_KEY = "watchHistoryBrowseCacheV1";
const MAX_ENTRIES = 32;
const MAX_BYTES = 1_000_000;
type Entry = { key: string; cachedAt: number; data: unknown };
export type BrowseCacheStorage = {
	read(): Promise<unknown>;
	write(entries: Entry[]): Promise<void>;
};

const browserStorage: BrowseCacheStorage = {
	read: async () =>
		typeof chrome === "undefined" || !chrome.storage?.session
			? []
			: (await chrome.storage.session.get(STORAGE_KEY))[STORAGE_KEY],
	write: async (entries) => {
		if (typeof chrome !== "undefined" && chrome.storage?.session)
			await chrome.storage.session.set({ [STORAGE_KEY]: entries });
	},
};

export function createWatchHistoryBrowseCache(
	adapter: BrowseCacheStorage = browserStorage,
) {
	let entries = new Map<string, Entry>();
	let initialized: Promise<void> | undefined;
	let writes = Promise.resolve();
	const valid = (entry: Entry, now: number) =>
		Number.isFinite(entry.cachedAt) &&
		entry.cachedAt <= now &&
		now - entry.cachedAt < WATCH_BROWSE_MAX_AGE_MS;
	function prune() {
		const now = Date.now();
		entries = new Map([...entries].filter(([, entry]) => valid(entry, now)));
		while (
			entries.size > MAX_ENTRIES ||
			new TextEncoder().encode(JSON.stringify([...entries.values()]))
				.byteLength > MAX_BYTES
		) {
			const first = entries.keys().next().value;
			if (first === undefined) break;
			entries.delete(first);
		}
	}
	async function initialize() {
		initialized ??= (async () => {
			const saved = await adapter.read().catch(() => null);
			if (!Array.isArray(saved)) return;
			for (const entry of saved.slice(-MAX_ENTRIES)) {
				if (
					entry &&
					typeof entry.key === "string" &&
					/^[a-f0-9]{64}$/.test(entry.key) &&
					valid(entry, Date.now())
				)
					entries.set(entry.key, entry);
			}
			prune();
		})();
		await initialized;
	}
	return {
		async read(key: string) {
			await initialize();
			const entry = entries.get(key);
			if (!entry || !valid(entry, Date.now())) {
				entries.delete(key);
				return null;
			}
			entries.delete(key);
			entries.set(key, entry);
			return { cachedAt: entry.cachedAt, data: structuredClone(entry.data) };
		},
		async write(key: string, data: unknown) {
			await initialize();
			entries.delete(key);
			entries.set(key, {
				key,
				cachedAt: Date.now(),
				data: structuredClone(data),
			});
			prune();
			// One background writer; serialize snapshots so slow storage cannot undo a
			// newer response. Quota/unavailable cache must never fail a successful read.
			writes = writes
				.then(() => adapter.write([...entries.values()]))
				.catch(() => undefined);
			await writes;
		},
	};
}

export async function watchBrowseCacheKey(scope: unknown[]) {
	// Bind to the exact auth session without storing credentials in cache keys.
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(JSON.stringify(scope)),
	);
	return [...new Uint8Array(digest)]
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}
