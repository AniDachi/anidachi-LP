import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { PopupWatchHistoryClient } from "./popup-watch-history";
import { WATCH_BROWSE_FRESH_MS } from "./watch-history-browse-cache";
import type { WatchHistoryMessage } from "./watch-history-client";

type BrowseMessage = Extract<
	WatchHistoryMessage,
	{
		command:
			| "browse"
			| "browse-title-episodes"
			| "browse-sessions"
			| "browse-options";
	}
>;
type Parser<T> = {
	safeParse(value: unknown): { success: true; data: T } | { success: false };
};
export const PopupWatchBrowseRecovery = createContext<
	((manual: boolean) => Promise<boolean>) | null
>(null);

// Pages belong to a rendered owner and complete query. Filtered DTOs never enter
// the canonical storage cache. Background reads replay only user-opened pages.
export function usePopupWatchBrowse<T>({
	client,
	message,
	parser,
	meta,
	cursor,
	refresh,
	forceRefresh = refresh,
	initialPage,
	enabled = true,
	generation,
	discard = false,
}: {
	client: PopupWatchHistoryClient;
	message: BrowseMessage;
	parser: Parser<T>;
	meta: (data: T) => { ownerUserId: string; accountGeneration: number };
	cursor: (data: T) => string | null;
	refresh: number;
	forceRefresh?: number;
	initialPage?: T;
	enabled?: boolean;
	generation?: number;
	discard?: boolean;
}) {
	const recover = useContext(PopupWatchBrowseRecovery);
	const key = JSON.stringify([message, generation, discard]);
	const seed = useMemo(() => {
		if (discard || !initialPage) return undefined;
		const parsed = parser.safeParse(initialPage);
		return parsed.success &&
			meta(parsed.data).ownerUserId === message.expectedOwnerUserId &&
			(generation === undefined ||
				meta(parsed.data).accountGeneration === generation)
			? parsed.data
			: undefined;
		// The complete query key fences previews supplied by the owning title page.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [initialPage, key]);
	const [state, setState] = useState<{
		key: string;
		pages: T[];
		loading: boolean;
		error: string | null;
		errorStatus: string | null;
	}>({ key, pages: [], loading: false, error: null, errorStatus: null });
	const latest = useRef({ key, client, generation });
	latest.current = { key, client, generation };
	const sequence = useRef(0);
	const pageCount = useRef(1);
	const queryDepths = useRef(new Map<string, number>());
	const activeKey = useRef(key);
	if (activeKey.current !== key) {
		activeKey.current = key;
		pageCount.current = queryDepths.current.get(key) ?? 1;
	}
	const [retry, setRetry] = useState(0);
	const previousRefresh = useRef({ forceRefresh, retry });
	const load = useCallback(
		async (nextCursor?: string, force = false) => {
			const requestKey = key;
			const token = ++sequence.current;
			const current = () =>
				sequence.current === token &&
				latest.current.key === requestKey &&
				latest.current.client === client &&
				latest.current.generation === generation;
			const retainedCount = pageCount.current;
			const firstPages = !nextCursor && seed ? [seed] : [];
			const firstCursor =
				nextCursor ?? (seed ? (cursor(seed) ?? undefined) : undefined);
			const readCount = nextCursor
				? 1
				: seed && !firstCursor
					? 0
					: retainedCount - firstPages.length;
			const rememberDepth = (count: number) => {
				pageCount.current = Math.max(1, count);
				queryDepths.current.delete(key);
				queryDepths.current.set(key, pageCount.current);
				if (queryDepths.current.size > 16)
					queryDepths.current.delete(queryDepths.current.keys().next().value!);
			};
			setState((previous) => ({
				key,
				pages:
					previous.key === key && previous.pages.length
						? previous.pages
						: firstPages,
				loading: true,
				error: null,
				errorStatus: null,
			}));
			// Exact-query previews come from the same server snapshot as their title.
			// Refresh the parent once, not every open child as another network request.
			if (!readCount) {
				rememberDepth(firstPages.length);
				setState({
					key,
					pages: firstPages,
					loading: false,
					error: null,
					errorStatus: null,
				});
				return;
			}
			// The background validates owner/session/generation/invalidation even for
			// cache reads. Never substitute canonical unfiltered items for query matches.
			if (client.loadBrowseCached) {
				const cachedPages: T[] = [...firstPages];
				let cachedCursor = firstCursor;
				let fresh = true;
				const seen = new Set<string>();
				for (let index = 0; index < readCount; index++) {
					const cached = await client
						.loadBrowseCached({
							...message,
							input: {
								...(message.input as Record<string, unknown>),
								...(cachedCursor ? { cursor: cachedCursor } : {}),
							},
						} as BrowseMessage)
						.catch(() => null);
					if (!current()) return;
					const parsed = cached?.ok ? parser.safeParse(cached.data) : null;
					if (
						!cached?.ok ||
						cached.cachedAt === undefined ||
						!parsed?.success ||
						meta(parsed.data).ownerUserId !== message.expectedOwnerUserId ||
						(generation !== undefined &&
							meta(parsed.data).accountGeneration !== generation)
					) {
						fresh = false;
						break;
					}
					fresh &&= Date.now() - cached.cachedAt < WATCH_BROWSE_FRESH_MS;
					cachedPages.push(parsed.data);
					cachedCursor = cursor(parsed.data) ?? undefined;
					if (!cachedCursor || seen.has(cachedCursor)) break;
					seen.add(cachedCursor);
				}
				if (cachedPages.length) {
					setState((previous) => {
						const pages =
							nextCursor && previous.key === key
								? [...previous.pages, ...cachedPages]
								: previous.key === key &&
										previous.pages.length > cachedPages.length &&
										!fresh
									? previous.pages
									: cachedPages;
						rememberDepth(pages.length);
						return {
							key,
							pages,
							loading: !fresh || force,
							error: null,
							errorStatus: null,
						};
					});
					if (fresh && !force) return;
				}
			}
			const pages: T[] = [...firstPages];
			let continuation = firstCursor;
			// A refresh preserves the user's explicitly loaded depth. Stop at the end,
			// an error, or a repeated cursor; never walk unseen account history.
			const seen = new Set<string>();
			for (let index = 0; index < readCount; index++) {
				let response;
				try {
					response = await client.request({
						...message,
						input: {
							...(message.input as Record<string, unknown>),
							...(continuation ? { cursor: continuation } : {}),
						},
					} as BrowseMessage);
				} catch {
					response = { ok: false, status: "retryable" } as const;
				}
				if (!current()) return;
				const parsed = response.ok ? parser.safeParse(response.data) : null;
				if (
					!parsed?.success ||
					meta(parsed.data).ownerUserId !== message.expectedOwnerUserId ||
					(generation !== undefined &&
						meta(parsed.data).accountGeneration !== generation)
				) {
					setState((previous) => ({
						...previous,
						pages:
							!response.ok &&
							[
								"unauthenticated",
								"rejected",
								"generation-mismatch",
								"deleted-history",
							].includes(response.status)
								? []
								: previous.pages,
						loading: false,
						errorStatus: !response.ok
							? response.status
							: parsed?.success &&
									meta(parsed.data).ownerUserId ===
										message.expectedOwnerUserId &&
									meta(parsed.data).accountGeneration !== generation
								? "generation-mismatch"
								: "invalid-response",
						error:
							!response.ok && response.status === "storage-full"
								? "Browser storage is full."
								: "Could not refresh watch history. Please retry.",
					}));
					return;
				}
				pages.push(parsed.data);
				continuation = cursor(parsed.data) ?? undefined;
				if (!continuation || seen.has(continuation)) break;
				seen.add(continuation);
			}
			if (!current()) return;
			setState((previous) => {
				const merged =
					nextCursor && previous.key === key
						? [...previous.pages.slice(0, retainedCount), ...pages]
						: pages;
				rememberDepth(merged.length);
				return {
					key,
					pages: merged,
					loading: false,
					error: null,
					errorStatus: null,
				};
			});
			// The serialized message is the dependency; metadata readers and schemas are
			// module constants. Playback object identity must not restart network reads.
			// eslint-disable-next-line react-hooks/exhaustive-deps
		},
		[key, client, generation, seed],
	);
	useEffect(() => {
		if (discard) {
			queryDepths.current.clear();
			pageCount.current = 1;
			setState({
				key,
				pages: [],
				loading: false,
				error: null,
				errorStatus: null,
			});
		} else if (enabled) {
			const changed =
				previousRefresh.current.forceRefresh !== forceRefresh ||
				previousRefresh.current.retry !== retry;
			previousRefresh.current = { forceRefresh, retry };
			void load(undefined, changed);
		}
		return () => {
			sequence.current += 1;
		};
	}, [enabled, discard, key, load, refresh, forceRefresh, retry]);
	const visible =
		state.key === key
			? state
			: {
					key,
					pages: seed ? [seed] : [],
					loading: enabled && !discard,
					error: null,
					errorStatus: null,
				};
	const lastPage = visible.pages.at(-1);
	const nextCursor = lastPage ? cursor(lastPage) : null;
	useEffect(() => {
		if (visible.errorStatus === "generation-mismatch" && recover)
			void recover(false);
	}, [visible.errorStatus, recover]);
	return {
		...visible,
		nextCursor,
		reload: () => {
			if (visible.errorStatus === "generation-mismatch" && recover)
				void recover(true);
			else setRetry((value) => value + 1);
		},
		loadMore: () => {
			if (!discard && nextCursor && !visible.loading) void load(nextCursor);
		},
	};
}
