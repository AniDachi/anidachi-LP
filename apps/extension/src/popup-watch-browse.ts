import {
	createContext,
	useContext,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import type { PopupWatchHistoryClient } from "./popup-watch-history";
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
	enabled?: boolean;
	generation?: number;
	discard?: boolean;
}) {
	const recover = useContext(PopupWatchBrowseRecovery);
	const key = JSON.stringify([message, generation, discard]);
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
	const activeKey = useRef(key);
	if (activeKey.current !== key) {
		activeKey.current = key;
		pageCount.current = 1;
	}
	const [retry, setRetry] = useState(0);
	const load = useCallback(
		async (nextCursor?: string) => {
			const requestKey = key;
			const token = ++sequence.current;
			const current = () =>
				sequence.current === token &&
				latest.current.key === requestKey &&
				latest.current.client === client &&
				latest.current.generation === generation;
			const retainedCount = pageCount.current;
			setState((previous) => ({
				key,
				pages: previous.key === key ? previous.pages : [],
				loading: true,
				error: null,
				errorStatus: null,
			}));
			const pages: T[] = [];
			let continuation = nextCursor;
			// A refresh preserves the user's explicitly loaded depth. Stop at the end,
			// an error, or a repeated cursor; never walk unseen account history.
			const seen = new Set<string>();
			for (let index = 0; index < (nextCursor ? 1 : retainedCount); index++) {
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
						? [...previous.pages, ...pages]
						: pages;
				pageCount.current = Math.max(1, merged.length);
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
		[key, client, generation],
	);
	useEffect(() => {
		if (discard) {
			pageCount.current = 1;
			setState({
				key,
				pages: [],
				loading: false,
				error: null,
				errorStatus: null,
			});
		} else if (enabled) void load();
		return () => {
			sequence.current += 1;
		};
	}, [enabled, discard, key, load, refresh, retry]);
	const visible =
		state.key === key
			? state
			: {
					key,
					pages: [],
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
