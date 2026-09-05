import {
	WatchHistoryBrowseResponseSchema,
	WatchHistoryBrowseTitleEpisodesResponseSchema,
	WatchHistoryBrowseSessionsResponseSchema,
	WatchHistoryRoomRecreationResponseSchema,
	WatchHistoryResponseSchema,
	type WatchHistoryBrowseResponse,
	type WatchHistoryBrowseTitleEpisodesResponse,
	type WatchHistoryBrowseSessionsResponse,
	type WatchHistoryBrowseQuery,
	type WatchHistoryItem,
	type WatchHistorySession,
	type WatchProgressEvent,
} from "@anidachi/protocol";
import { Check, ChevronDown, RefreshCw, Search, X } from "lucide-react";
import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { WEB_HTTP_BASE } from "./constants";
import {
	PopupWatchBrowseRecovery,
	usePopupWatchBrowse,
} from "./popup-watch-browse";
import {
	PopupWatchFilters,
	emptyHistoryConditions,
	type PopupHistoryConditions,
} from "./popup-watch-filters";
import { createWatchHistoryDateRange } from "./watch-history-browse";
import {
	defaultPopupWatchHistoryClient,
	requestPopupWatchHistory,
	isSameHistoryRevision,
	reconcileHistoryLayout,
	groupWatchHistoryItems,
	projectPendingWatchHistoryItems,
	pendingWatchHistoryEpisode,
	latestPendingByEpisode,
	pendingEpisodeKey,
	pendingTitleKey,
	reconcilePopupPendingEvents,
	ProviderLogo,
	watchHistoryOverallProgress,
	formatProgressPercent,
	formatClock,
	withRoomHash,
	type PopupWatchHistoryClient,
	type PopupWatchHistorySnapshot,
	type PopupHistoryLayout,
} from "./popup-watch-history";

const titleMeta = (page: WatchHistoryBrowseResponse) => page.history.meta;
const titleCursor = (page: WatchHistoryBrowseResponse) =>
	page.history.nextCursor;
const detailMeta = (page: WatchHistoryBrowseTitleEpisodesResponse) =>
	page.detail.meta;
const detailCursor = (page: WatchHistoryBrowseTitleEpisodesResponse) =>
	page.detail.nextCursor;
const sessionMeta = (page: WatchHistoryBrowseSessionsResponse) => page.meta;
const sessionCursor = (page: WatchHistoryBrowseSessionsResponse) =>
	page.nextCursor;
type Episode = WatchHistoryItem["seasons"][number]["episodes"][number];
type Disclosure = {
	isOpen(key: string, initial: boolean): boolean;
	toggle(key: string, initial: boolean): void;
};
function mergeBy<T>(values: T[], key: (item: T) => string) {
	return [...new Map(values.map((value) => [key(value), value])).values()];
}
function watchedDate(value: string, time = false) {
	return new Date(value).toLocaleString(undefined, {
		dateStyle: "medium",
		...(time ? { timeStyle: "short" as const } : {}),
	});
}

export function PopupWatchHistoryPanel({
	ownerUserId,
	client = defaultPopupWatchHistoryClient,
	onTitleCountChange,
	refreshSignal = 0,
}: {
	ownerUserId: string | null;
	client?: PopupWatchHistoryClient;
	onTitleCountChange?: (count: number) => void;
	refreshSignal?: number;
}) {
	// A new owner/client gets fresh view state before any effect can settle.
	return ownerUserId ? (
		<WatchDrawer
			key={ownerUserId}
			ownerUserId={ownerUserId}
			client={client}
			onTitleCountChange={onTitleCountChange}
			refreshSignal={refreshSignal}
		/>
	) : (
		<div className="popup-empty">Sign in to sync watch history.</div>
	);
}

function WatchDrawer({
	ownerUserId,
	client,
	onTitleCountChange,
	refreshSignal,
}: {
	ownerUserId: string;
	client: PopupWatchHistoryClient;
	onTitleCountChange?: (count: number) => void;
	refreshSignal: number;
}) {
	const [snapshot, setSnapshot] = useState<PopupWatchHistorySnapshot | null>(
		null,
	);
	const [cacheReady, setCacheReady] = useState(false);
	const [mode, setMode] = useState<"mine" | "together">("mine");
	const [search, setSearch] = useState("");
	const searchEpoch = useRef(0);
	const changeSearch = (value: string) => {
		if (value.trim() !== search.trim()) searchEpoch.current++;
		setSearch(value);
	};
	const [conditions, setConditions] = useState<PopupHistoryConditions>(
		emptyHistoryConditions,
	);
	const [refresh, setRefresh] = useState(0);
	const [invalidation, setInvalidation] = useState(0);
	const [now, setNow] = useState(() => new Date());
	const [busy, setBusy] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);
	const [recovering, setRecovering] = useState(false);
	const [recoveryError, setRecoveryError] = useState<string | null>(null);
	const recoveryAttempts = useRef(new Set<number | undefined>());
	const recoveryFlight = useRef<Promise<boolean> | null>(null);
	const currentClient = useRef(client);
	currentClient.current = client;
	const [oldOwnerPending, setOldOwnerPending] = useState(false);
	const [layout, setLayout] = useState<PopupHistoryLayout | null>(null);
	const [branches, setBranches] = useState<
		Record<string, Record<string, boolean>>
	>({});
	const actionGeneration = useRef(0);
	const snapshotRef = useRef(snapshot);
	snapshotRef.current = snapshot;
	const searchRef = useRef<HTMLInputElement>(null);
	const refreshVersion = refresh + refreshSignal;
	useEffect(() => {
		setNow(new Date());
	}, [refreshVersion]);
	useEffect(() => {
		const token = ++actionGeneration.current;
		recoveryAttempts.current.clear();
		recoveryFlight.current = null;
		setRecovering(false);
		setRecoveryError(null);
		let disposed = false;
		const accept = (value: PopupWatchHistorySnapshot | null) => {
			if (disposed || !value || value.history.meta.ownerUserId !== ownerUserId)
				return;
			setSnapshot((previous) =>
				previous && previous.accountGeneration === value.accountGeneration
					? {
							...value,
							pendingEvents: reconcilePopupPendingEvents(
								previous.pendingEvents,
								value,
							),
						}
					: value,
			);
		};
		void client
			.loadCached(ownerUserId)
			.then((value) => {
				if (!snapshotRef.current) accept(value);
			})
			.catch(() => undefined)
			.finally(() => {
				if (!disposed) setCacheReady(true);
			});
		void requestPopupWatchHistory(client, {
			type: "ANIDACHI_WATCH_HISTORY_V3",
			command: "other-owner-pending",
		}).then((result) => {
			if (!disposed && result.ok)
				setOldOwnerPending(result.hasPendingWork === true);
		});
		const unsubscribe = client.subscribe?.(ownerUserId, (value, result) => {
			if (disposed) return;
			const previous = snapshotRef.current;
			accept(value);
			// Playback-only observations update known matches in place. Canonical
			// acknowledgement or generation replacement invalidates this query once.
			if (
				result ||
				(value &&
					previous &&
					!isSameHistoryRevision(previous.history, value.history))
			)
				setInvalidation((version) => version + 1);
		});
		return () => {
			disposed = true;
			unsubscribe?.();
			if (actionGeneration.current === token) actionGeneration.current++;
		};
	}, [client, ownerUserId]);
	const recoverCanonical = useCallback(() => {
		if (recoveryFlight.current) return recoveryFlight.current;
		const token = actionGeneration.current;
		const startedGeneration = snapshotRef.current?.accountGeneration;
		const current = () =>
			actionGeneration.current === token && currentClient.current === client;
		setRecovering(true);
		setRecoveryError(null);
		const flight = (async () => {
			try {
				// Only the existing canonical read may advance storage generation. Browse
				// DTOs stay view-local; the background read retains its auth/write fences.
				const result = await requestPopupWatchHistory(client, {
					type: "ANIDACHI_WATCH_HISTORY_V3",
					command: "list",
					limit: 100,
				});
				if (!current()) return false;
				const parsed = result.ok
					? WatchHistoryResponseSchema.safeParse(result.data)
					: null;
				if (
					!parsed?.success ||
					parsed.data.meta.ownerUserId !== ownerUserId ||
					parsed.data.meta.accountGeneration < (startedGeneration ?? 0)
				)
					throw new Error("canonical recovery");
				const history = parsed.data;
				if (startedGeneration === undefined)
					recoveryAttempts.current.add(history.meta.accountGeneration);
				const cached = await client.loadCached(ownerUserId);
				if (
					!current() ||
					(snapshotRef.current?.accountGeneration ?? 0) >
						history.meta.accountGeneration ||
					(cached?.history.meta.ownerUserId === ownerUserId &&
						cached.accountGeneration > history.meta.accountGeneration)
				)
					return false;
				setSnapshot((previous) => {
					if (
						(previous?.accountGeneration ?? 0) > history.meta.accountGeneration
					)
						return previous;
					if (
						cached?.history.meta.ownerUserId === ownerUserId &&
						cached.accountGeneration === history.meta.accountGeneration &&
						Date.parse(cached.history.generatedAt) >=
							Date.parse(history.generatedAt)
					)
						return cached;
					const sameGeneration =
						previous?.accountGeneration === history.meta.accountGeneration;
					return {
						history,
						accountGeneration: history.meta.accountGeneration,
						preferences: previous?.preferences ?? {
							youtubeHistoryEnabled: false,
						},
						pendingEvents: sameGeneration ? previous.pendingEvents : [],
						localObservation: sameGeneration ? previous.localObservation : null,
						capturePaused: sameGeneration ? previous.capturePaused : false,
					};
				});
				setRefresh((value) => value + 1);
				return true;
			} catch {
				if (current())
					setRecoveryError("Could not refresh watch history. Please retry.");
				return false;
			} finally {
				if (current()) {
					recoveryFlight.current = null;
					setRecovering(false);
				}
			}
		})();
		recoveryFlight.current = flight;
		return flight;
	}, [client, ownerUserId]);
	const recoverAfterMismatch = useCallback(
		(manual: boolean) => {
			const generation = snapshotRef.current?.accountGeneration;
			if (!manual && recoveryAttempts.current.has(generation))
				return Promise.resolve(false);
			// All streams share one attempt fence and flight, including child-only
			// mismatches. Failed recovery needs explicit Retry, not another auto loop.
			recoveryAttempts.current.add(generation);
			return recoverCanonical();
		},
		[recoverCanonical],
	);

	const dates = useMemo(
		() =>
			createWatchHistoryDateRange({
				preset: conditions.period,
				now,
				fromDate: conditions.fromDate,
				throughDate: conditions.throughDate,
			}),
		[conditions.period, conditions.fromDate, conditions.throughDate, now],
	);
	const input: WatchHistoryBrowseQuery = {
		mode: mode === "mine" ? "solo" : "shared",
		limit: 20,
		...(search.trim() ? { search: search.trim() } : {}),
		...(mode === "together" && conditions.group
			? { groupId: conditions.group.id }
			: {}),
		...(mode === "together" && conditions.participant
			? { participantUserId: conditions.participant.id }
			: {}),
		...(dates.ok && dates.range ? dates.range : {}),
	};
	const queryKey = JSON.stringify([
		input,
		dates.ok,
		snapshot?.accountGeneration,
		search.trim() ? searchEpoch.current : 0,
	]);
	const browsing = usePopupWatchBrowse({
		client,
		message: {
			type: "ANIDACHI_WATCH_HISTORY_V3",
			command: "browse",
			expectedOwnerUserId: ownerUserId,
			input,
		},
		parser: WatchHistoryBrowseResponseSchema,
		meta: titleMeta,
		cursor: titleCursor,
		refresh: refreshVersion + invalidation,
		enabled: dates.ok && cacheReady && !recovering,
		generation: snapshot?.accountGeneration,
	});
	useEffect(() => {
		if (browsing.errorStatus === "generation-mismatch")
			void recoverAfterMismatch(false);
	}, [browsing.errorStatus, recoverAfterMismatch]);
	const titleItems = dates.ok
		? mergeBy(
				browsing.pages.flatMap((page) => page.history.items),
				(item) => pendingTitleKey(item.provider, item.titleKey),
			)
		: [];
	const matches = new Map(
		browsing.pages
			.flatMap((page) => page.matches)
			.map((match) => [pendingTitleKey(match.provider, match.titleKey), match]),
	);
	const pending = useMemo(() => {
		const events = (snapshot?.pendingEvents ?? []).filter((event) =>
			mode === "mine" ? !event.sharedRoom : Boolean(event.sharedRoom),
		);
		const result = latestPendingByEpisode(events);
		if (snapshot?.localObservation?.mode === mode) {
			const event = snapshot.localObservation.event;
			result.set(
				pendingEpisodeKey(event.provider, event.titleKey, event.episodeKey),
				event,
			);
		}
		return result;
	}, [snapshot, mode]);
	const allowPending =
		mode === "mine" && !search.trim() && conditions.period === "all-time";
	const canonical = new Map(
		snapshot?.history.items.map((item) => [
			pendingTitleKey(item.provider, item.titleKey),
			item,
		]) ?? [],
	);
	const known = titleItems.map((item) => {
		const local = canonical.get(pendingTitleKey(item.provider, item.titleKey));
		const responseTime = browsing.pages.find((page) =>
			page.history.items.some(
				(value) =>
					value.provider === item.provider && value.titleKey === item.titleKey,
			),
		)?.history.generatedAt;
		const localIsCurrent =
			snapshot &&
			responseTime &&
			Date.parse(snapshot.history.generatedAt) >= Date.parse(responseTime);
		return local
			? {
					...item,
					artworkUrl: localIsCurrent
						? (local.artworkUrl ?? item.artworkUrl)
						: (item.artworkUrl ?? local.artworkUrl),
					// Regional exactness can be invalidated locally before a GET recovers.
					// A newer canonical browse response can restore that exactness.
					...(localIsCurrent && local.catalogState !== "complete"
						? {
								catalogState: local.catalogState,
								aggregate: local.aggregate,
								seasons: item.seasons.map((season) => ({
									...season,
									aggregate: local.seasons.find(
										(value) => value.seasonKey === season.seasonKey,
									)?.aggregate ?? {
										completedEpisodes: 0,
										availableEpisodes: null,
										progress: null,
									},
								})),
							}
						: {}),
				}
			: item;
	});
	const projected = allowPending
		? projectPendingWatchHistoryItems(
				known,
				pending,
				snapshot?.localObservation?.event ?? null,
			)
		: known;
	// Projection supplies pending identity/artwork only; existing aggregate/counts
	// and eligibility stay server-owned under every condition.
	const items = projected.map((item) => {
		const durable = known.find(
			(value) =>
				value.provider === item.provider && value.titleKey === item.titleKey,
		);
		return durable
			? {
					...item,
					aggregate: durable.aggregate,
					observedEpisodeCount: durable.observedEpisodeCount,
					completedEpisodeCount: durable.completedEpisodeCount,
				}
			: item;
	});
	const nextLayout = reconcileHistoryLayout(layout, items, queryKey);
	if (nextLayout !== layout) setLayout(nextLayout);
	const ranks = new Map(nextLayout.titleKeys.map((key, index) => [key, index]));
	items.sort(
		(a, b) =>
			(ranks.get(pendingTitleKey(a.provider, a.titleKey)) ?? 0) -
			(ranks.get(pendingTitleKey(b.provider, b.titleKey)) ?? 0),
	);
	const disclosure: Disclosure = {
		isOpen: (key, initial) =>
			branches[queryKey]?.[key] ??
			(search.trim() ? true : (nextLayout.defaults[key] ?? initial)),
		toggle: (key, initial) =>
			setBranches((previous) => ({
				...previous,
				[queryKey]: {
					...previous[queryKey],
					[key]: !(
						previous[queryKey]?.[key] ??
						(search.trim() ? true : (nextLayout.defaults[key] ?? initial))
					),
				},
			})),
	};
	const total = browsing.pages[0]?.history.totalTitleCount ?? 0;
	useEffect(() => {
		onTitleCountChange?.(total);
	}, [total, onTitleCountChange]);
	const runAction = async (key: string, work: () => Promise<void>) => {
		if (busy) return;
		const token = actionGeneration.current;
		setBusy(key);
		setActionError(null);
		try {
			await work();
		} catch {
			if (actionGeneration.current === token)
				setActionError("Could not complete this action. Please retry.");
		}
		if (actionGeneration.current === token) setBusy(null);
	};
	const openUrl = (url: string) =>
		void runAction("open", () => client.openUrl(url));
	const createRoom = (session: WatchHistorySession, sourceUrl: string) =>
		void runAction(`room:${session.id}`, async () => {
			const token = actionGeneration.current;
			const result = await requestPopupWatchHistory(client, {
				type: "ANIDACHI_WATCH_HISTORY_V3",
				command: "create-room",
				sessionId: session.id,
				clientRequestId: crypto.randomUUID(),
			});
			if (actionGeneration.current !== token) return;
			const parsed = result.ok
				? WatchHistoryRoomRecreationResponseSchema.safeParse(result.data)
				: null;
			if (!parsed?.success) throw new Error("room");
			await client.openUrl(withRoomHash(sourceUrl, parsed.data.roomId));
		});
	const refreshHistory = () =>
		void runAction("refresh", async () => {
			const token = actionGeneration.current;
			if (snapshot?.capturePaused) {
				const result = await requestPopupWatchHistory(client, {
					type: "ANIDACHI_WATCH_HISTORY_V3",
					command: "recover-storage",
				});
				if (actionGeneration.current !== token) return;
				if (!result.ok) throw new Error("storage");
				setSnapshot((previous) =>
					previous ? { ...previous, capturePaused: false } : previous,
				);
			}
			if (browsing.errorStatus === "generation-mismatch" || recoveryError) {
				await recoverAfterMismatch(true);
				return;
			}
			if (browsing.error) {
				browsing.reload();
				return;
			}
			setNow(new Date());
			setRefresh((value) => value + 1);
		});
	const error = actionError ?? recoveryError ?? browsing.error;
	const content = (
		<section className="popup-watch-screen" aria-label="Watch History">
			<div className="popup-watch-controls">
				<div
					className="popup-watch-mode-switch"
					role="group"
					aria-label="Watch history mode"
				>
					{(["mine", "together"] as const).map((value) => (
						<button
							type="button"
							aria-pressed={mode === value}
							key={value}
							onClick={() => {
								if (value === mode) return;
								setMode(value);
								if (value === "mine")
									setConditions((current) => ({
										...current,
										group: null,
										participant: null,
									}));
							}}
						>
							{value === "mine" ? "Mine" : "Together"}
						</button>
					))}
				</div>
				<div className="popup-watch-search">
					<Search aria-hidden="true" size={13} />
					<input
						aria-label="Search watch history"
						type="search"
						placeholder="Search"
						maxLength={200}
						ref={searchRef}
						value={search}
						onChange={(event) => changeSearch(event.currentTarget.value)}
					/>
					{search ? (
						<button
							aria-label="Clear watch history search"
							type="button"
							onClick={() => {
								changeSearch("");
								searchRef.current?.focus();
							}}
						>
							<X size={12} />
						</button>
					) : null}
				</div>
				<PopupWatchFilters
					client={client}
					ownerUserId={ownerUserId}
					together={mode === "together"}
					conditions={conditions}
					onChange={setConditions}
					search={search}
					clearSearch={() => changeSearch("")}
					refresh={refreshVersion + invalidation}
					generation={snapshot?.accountGeneration}
					dateError={!dates.ok}
				/>
			</div>
			<div className="popup-watch-status">
				<span role="status">
					{recovering
						? "Recovering watch history..."
						: browsing.loading
							? browsing.pages.length
								? "Updating..."
								: "Loading watch history..."
							: ""}
				</span>
				<button
					aria-label={
						error || snapshot?.capturePaused
							? "Retry watch history"
							: "Refresh watch history"
					}
					className="popup-watch-refresh"
					disabled={recovering || browsing.loading || Boolean(busy)}
					type="button"
					onClick={refreshHistory}
				>
					<RefreshCw aria-hidden="true" size={12} />
					{error || snapshot?.capturePaused ? "Retry" : "Refresh"}
				</button>
			</div>
			{snapshot?.capturePaused ? (
				<div className="popup-social-empty" data-tone="error">
					Watch History is paused because browser storage is full.
				</div>
			) : null}
			{oldOwnerPending ? (
				<div className="popup-social-empty" data-tone="warning">
					<span>Pending history from another account</span>
					<button
						aria-label="Discard pending history from another account"
						disabled={Boolean(busy)}
						type="button"
						onClick={() => {
							if (
								!client.confirmDiscard(
									"Discard pending Watch History from another account?",
								)
							)
								return;
							void runAction("discard-old-owner", async () => {
								const token = actionGeneration.current;
								const result = await requestPopupWatchHistory(client, {
									type: "ANIDACHI_WATCH_HISTORY_V3",
									command: "discard-old-owner-work",
									confirmed: true,
								});
								if (actionGeneration.current !== token) return;
								if (!result.ok) throw new Error("discard");
								setOldOwnerPending(false);
							});
						}}
					>
						Discard
					</button>
				</div>
			) : null}
			{error ? (
				<div className="popup-social-empty" data-tone="error" role="alert">
					{error}
				</div>
			) : null}
			{items.length ? (
				<div className="popup-resource-list">
					{groupWatchHistoryItems(items).map((group) => {
						const branch = JSON.stringify([group.provider]);
						const open = disclosure.isOpen(branch, true);
						return (
							<section
								className="popup-provider"
								data-provider={group.provider}
								key={group.provider}
							>
								<button
									aria-expanded={open}
									aria-label={`Toggle ${group.label} history`}
									className="popup-provider-row"
									type="button"
									onClick={() => disclosure.toggle(branch, true)}
								>
									<ProviderLogo label={group.label} provider={group.provider} />
									<span className="popup-provider-main">
										<strong className="popup-provider-name">
											{group.label}
										</strong>
										<span className="popup-provider-meta">
											{group.items.length}{" "}
											{group.items.length === 1 ? "title" : "titles"} shown
										</span>
									</span>
									<span
										aria-hidden="true"
										className="popup-provider-chevron"
										data-open={open}
									>
										<ChevronDown size={16} />
									</span>
								</button>
								{open ? (
									<div className="popup-provider-body">
										{group.items.map((item, index) => (
											<PopupWatchHistoryItem
												key={pendingTitleKey(item.provider, item.titleKey)}
												item={item}
												ownerUserId={ownerUserId}
												client={client}
												input={input}
												refresh={refreshVersion + invalidation}
												generation={snapshot?.accountGeneration}
												disclosure={disclosure}
												initiallyOpen={index === 0}
												matchingDate={
													matches.get(
														pendingTitleKey(item.provider, item.titleKey),
													)?.lastWatchedAt
												}
												pending={pending}
												allowPending={allowPending}
												canonical={canonical.get(
													pendingTitleKey(item.provider, item.titleKey),
												)}
												busy={busy}
												onOpen={openUrl}
												onCreateRoom={createRoom}
											/>
										))}
									</div>
								) : null}
							</section>
						);
					})}
				</div>
			) : !recovering && !browsing.loading && !error && dates.ok ? (
				<div className="popup-empty">
					{search.trim() ||
					conditions.period !== "all-time" ||
					conditions.group ||
					conditions.participant
						? "No history matches these conditions."
						: mode === "together"
							? "Shared sessions will appear after watching together."
							: "Episodes you watch on supported sites will appear here."}
				</div>
			) : null}
			{browsing.nextCursor && dates.ok ? (
				<button
					type="button"
					className="popup-watch-load-more"
					disabled={browsing.loading}
					onClick={browsing.loadMore}
				>
					Load more titles
				</button>
			) : null}
			<footer className="popup-watch-footer">
				<button
					type="button"
					disabled={busy === "open"}
					onClick={() =>
						openUrl(new URL("/account/watch-library", WEB_HTTP_BASE).toString())
					}
				>
					Manage history
				</button>
			</footer>
		</section>
	);
	return (
		<PopupWatchBrowseRecovery.Provider value={recoverAfterMismatch}>
			{content}
		</PopupWatchBrowseRecovery.Provider>
	);
}

function PopupWatchArtwork({
	url,
	title,
}: {
	url: string | null;
	title: string;
}) {
	const [failed, setFailed] = useState(false);
	const visible = Boolean(url) && !failed;
	return (
		<span className="popup-watch-artwork" data-has-artwork={visible}>
			{visible && url ? (
				<img
					alt=""
					loading="lazy"
					decoding="async"
					src={url}
					width={44}
					height={66}
					onError={() => setFailed(true)}
				/>
			) : (
				title.slice(0, 1)
			)}
		</span>
	);
}

function PopupWatchHistoryItem({
	item,
	ownerUserId,
	client,
	input,
	refresh,
	generation,
	disclosure,
	initiallyOpen,
	matchingDate,
	pending,
	allowPending,
	canonical,
	busy,
	onOpen,
	onCreateRoom,
}: {
	item: WatchHistoryItem;
	ownerUserId: string;
	client: PopupWatchHistoryClient;
	input: WatchHistoryBrowseQuery;
	refresh: number;
	generation?: number;
	disclosure: Disclosure;
	initiallyOpen: boolean;
	matchingDate?: string;
	pending: Map<string, WatchProgressEvent>;
	allowPending: boolean;
	canonical?: WatchHistoryItem;
	busy: string | null;
	onOpen: (url: string) => void;
	onCreateRoom: (session: WatchHistorySession, url: string) => void;
}) {
	const branch = JSON.stringify([item.provider, item.titleKey]);
	const open = disclosure.isOpen(branch, initiallyOpen);
	const bodyId = useId();
	const page = usePopupWatchBrowse({
		client,
		message: {
			type: "ANIDACHI_WATCH_HISTORY_V3",
			command: "browse-title-episodes",
			expectedOwnerUserId: ownerUserId,
			input: { ...input, provider: item.provider, titleKey: item.titleKey },
		},
		parser: WatchHistoryBrowseTitleEpisodesResponseSchema,
		meta: detailMeta,
		cursor: detailCursor,
		refresh,
		enabled: open && Boolean(matchingDate),
		generation,
	});
	const matchingEpisodes = mergeBy(
		page.pages.flatMap((page) => page.detail.episodes),
		(episode) => episode.episodeKey,
	);
	const matchingKeys = new Set(
		matchingEpisodes.map((episode) => episode.episodeKey),
	);
	const projectedKeys = new Set(
		item.seasons.flatMap((season) =>
			season.episodes.map((episode) => episode.episodeKey),
		),
	);
	const ownPending = [...pending.values()].filter(
		(event) =>
			event.provider === item.provider &&
			event.titleKey === item.titleKey &&
			(projectedKeys.has(event.episodeKey) || item.seasons.length === 0),
	);
	if (allowPending)
		for (const event of ownPending)
			if (!matchingKeys.has(event.episodeKey)) {
				matchingEpisodes.push(pendingWatchHistoryEpisode(event));
				matchingKeys.add(event.episodeKey);
			}
	const episodeMatches = new Map(
		page.pages
			.flatMap((page) => page.matches)
			.map((match) => [match.episodeKey, match]),
	);
	const seasonMetadata = page.pages[0]?.detail.catalog.seasons ?? item.seasons;
	const observedSeasons = matchingEpisodes.flatMap((episode) =>
		episode.seasonKey
			? [
					{
						seasonKey: episode.seasonKey,
						seasonTitle: episode.seasonTitle ?? "Observed season",
						seasonNumber: episode.seasonNumber,
						order: 0,
						aggregate: {
							completedEpisodes: 0,
							availableEpisodes: null,
							progress: null,
						},
						nextEpisode: null,
					},
				]
			: [],
	);
	const seasons = mergeBy(
		[
			...item.seasons,
			...seasonMetadata,
			...observedSeasons.filter(
				(observed) =>
					!item.seasons.some(
						(season) => season.seasonKey === observed.seasonKey,
					) &&
					!seasonMetadata.some(
						(season) => season.seasonKey === observed.seasonKey,
					),
			),
		],
		(season) => season.seasonKey,
	)
		.map((season) => ({
			...season,
			episodes: matchingEpisodes
				.filter(
					(episode) =>
						(episode.seasonKey ?? episode.episodeKey) === season.seasonKey,
				)
				.sort(
					(a, b) =>
						(a.episodeNumber ?? Number.MAX_SAFE_INTEGER) -
							(b.episodeNumber ?? Number.MAX_SAFE_INTEGER) ||
						(a.episodeKey < b.episodeKey
							? -1
							: a.episodeKey > b.episodeKey
								? 1
								: 0),
				),
		}))
		.filter((season) => season.episodes.length > 0);
	const unseasoned = matchingEpisodes.filter(
		(episode) =>
			!seasons.some((season) =>
				season.episodes.some(
					(value) => value.episodeKey === episode.episodeKey,
				),
			),
	);
	const overall = watchHistoryOverallProgress(item);
	const initialSeason = useRef<string | null>(null);
	const resolvedSeason =
		seasons.find((season) =>
			season.episodes.some(
				(episode) => episode.episodeKey === item.latestActivity.episodeKey,
			),
		)?.seasonKey ?? seasons[0]?.seasonKey;
	if (initialSeason.current === null && resolvedSeason && page.pages.length > 0)
		initialSeason.current = resolvedSeason;
	const latestSeasonKey = initialSeason.current ?? resolvedSeason;
	const renderEpisode = (episode: Episode) => {
		const personal = canonical?.seasons
			.flatMap((season) => season.episodes)
			.find((value) => value.episodeKey === episode.episodeKey);
		const updated =
			personal &&
			Date.parse(personal.lastWatchedAt) >= Date.parse(episode.lastWatchedAt)
				? {
						...episode,
						currentTime: personal.currentTime,
						duration: personal.duration,
						progress: personal.progress,
						completedAt: personal.completedAt ?? episode.completedAt,
					}
				: episode;
		return (
			<PopupEpisode
				key={episode.episodeKey}
				episode={updated}
				item={item}
				pending={(() => {
					const event = pending.get(
						pendingEpisodeKey(item.provider, item.titleKey, episode.episodeKey),
					);
					return event &&
						Date.parse(event.observedAt) >= Date.parse(episode.lastWatchedAt)
						? event
						: undefined;
				})()}
				match={episodeMatches.get(episode.episodeKey)}
				ownerUserId={ownerUserId}
				client={client}
				input={input}
				refresh={refresh}
				generation={generation}
				busy={busy}
				onOpen={onOpen}
				onCreateRoom={onCreateRoom}
			/>
		);
	};
	return (
		<article
			className="popup-watch-item"
			data-kind={item.itemKind}
			data-provider={item.provider}
			data-open={open}
		>
			<div className="popup-watch-row">
				<button
					aria-label={`Toggle ${item.title} history${overall.accessibleSuffix}`}
					aria-expanded={open}
					aria-controls={bodyId}
					className="popup-watch-title-toggle"
					type="button"
					onClick={() => disclosure.toggle(branch, initiallyOpen)}
				>
					<PopupWatchArtwork
						key={item.artworkUrl}
						url={item.artworkUrl}
						title={item.title}
					/>
					<span className="popup-watch-main">
						<strong className="popup-watch-title" dir="auto">
							{item.title}
						</strong>
						<span className="popup-watch-overall">
							<span className="popup-watch-overall-label">
								<span className="popup-watch-meta">
									{overall.label.split(" · ")[0]}
								</span>
								{overall.progress !== null ? (
									<span className="popup-watch-percent">
										{formatProgressPercent(overall.progress)}%
									</span>
								) : null}
							</span>
							{overall.progress !== null ? (
								<span aria-hidden="true" className="popup-watch-overall-track">
									<span style={{ width: `${overall.progress * 100}%` }} />
								</span>
							) : null}
						</span>
						<span className="popup-watch-date">
							{matchingDate ? watchedDate(matchingDate) : "Pending sync"}
						</span>
					</span>
					<ChevronDown
						aria-hidden="true"
						className="popup-watch-disclosure-icon"
						size={16}
					/>
				</button>
			</div>
			{open ? (
				<div className="popup-watch-tree" id={bodyId}>
					{page.loading && !page.pages.length && !ownPending.length ? (
						<p className="popup-watch-slice-note" role="status">
							Loading matching episodes...
						</p>
					) : null}
					{page.error ? (
						<p className="popup-watch-slice-note" role="alert">
							Could not load episodes.{" "}
							<button type="button" onClick={page.reload}>
								Retry episodes
							</button>
						</p>
					) : null}
					{seasons.map((season, index) => {
						const key = JSON.stringify([
							item.provider,
							item.titleKey,
							season.seasonKey,
						]);
						const initial = season.seasonKey === latestSeasonKey;
						const expanded = disclosure.isOpen(key, initial);
						const aggregate =
							item.catalogState !== "complete"
								? (item.seasons.find(
										(value) => value.seasonKey === season.seasonKey,
									)?.aggregate ?? {
										completedEpisodes: 0,
										availableEpisodes: null,
										progress: null,
									})
								: season.aggregate;
						return (
							<section className="popup-season-group" key={key}>
								<button
									aria-label={`Toggle ${item.title} ${season.seasonTitle}`}
									aria-expanded={expanded}
									aria-controls={`${bodyId}-${index}`}
									className="popup-season-header"
									type="button"
									onClick={() => disclosure.toggle(key, initial)}
								>
									<span className="popup-season-main">
										<strong className="popup-season-title" dir="auto">
											{season.seasonTitle}
										</strong>
										<span className="popup-season-meta">
											{aggregate.availableEpisodes === null
												? "Availability unknown"
												: aggregate.availableEpisodes === 0
													? "Not currently available"
													: `${aggregate.completedEpisodes} / ${aggregate.availableEpisodes} episodes`}
										</span>
										{aggregate.progress !== null &&
										aggregate.availableEpisodes ? (
											<span
												className="popup-watch-overall-track"
												aria-hidden="true"
											>
												<span
													style={{ width: `${aggregate.progress * 100}%` }}
												/>
											</span>
										) : null}
									</span>
									{aggregate.progress !== null &&
									aggregate.availableEpisodes ? (
										<span className="popup-watch-percent">
											{formatProgressPercent(aggregate.progress)}%
										</span>
									) : null}
									<ChevronDown
										aria-hidden="true"
										className="popup-watch-disclosure-icon"
										size={14}
									/>
								</button>
								{expanded ? (
									<div
										className="popup-season-episode-list"
										id={`${bodyId}-${index}`}
									>
										{season.episodes.map(renderEpisode)}
									</div>
								) : null}
							</section>
						);
					})}
					{unseasoned.map(renderEpisode)}
					{page.nextCursor ? (
						<button
							className="popup-watch-load-more"
							aria-label={`Load more episodes for ${item.title}`}
							type="button"
							disabled={page.loading}
							onClick={page.loadMore}
						>
							Load more episodes
						</button>
					) : null}
					{!page.loading &&
					!page.error &&
					page.pages.length > 0 &&
					!matchingEpisodes.length ? (
						<p className="popup-watch-slice-note">No matching episodes.</p>
					) : null}
				</div>
			) : null}
		</article>
	);
}

function PopupEpisode({
	episode,
	item,
	pending,
	match,
	ownerUserId,
	client,
	input,
	refresh,
	generation,
	busy,
	onOpen,
	onCreateRoom,
}: {
	episode: Episode;
	item: WatchHistoryItem;
	pending?: WatchProgressEvent;
	match?: WatchHistoryBrowseTitleEpisodesResponse["matches"][number];
	ownerUserId: string;
	client: PopupWatchHistoryClient;
	input: WatchHistoryBrowseQuery;
	refresh: number;
	generation?: number;
	busy: string | null;
	onOpen: (url: string) => void;
	onCreateRoom: (session: WatchHistorySession, url: string) => void;
}) {
	const [sessionsOpen, setSessionsOpen] = useState(false);
	const pages = usePopupWatchBrowse({
		client,
		message: {
			type: "ANIDACHI_WATCH_HISTORY_V3",
			command: "browse-sessions",
			expectedOwnerUserId: ownerUserId,
			input: {
				...input,
				provider: item.provider,
				titleKey: item.titleKey,
				episodeKey: episode.episodeKey,
			},
		},
		parser: WatchHistoryBrowseSessionsResponseSchema,
		meta: sessionMeta,
		cursor: sessionCursor,
		refresh,
		enabled: sessionsOpen && match?.sessionsComplete === false,
		discard: match?.sessionsComplete === true,
		generation,
	});
	const sessions = mergeBy(
		[...episode.sessions, ...pages.pages.flatMap((page) => page.sessions)],
		(session) => session.id,
	);
	const completed = Boolean(episode.completedAt);
	const currentTime = pending?.currentTime ?? episode.currentTime;
	const progress = pending?.progress ?? episode.progress;
	return (
		<div
			className="popup-episode-row"
			data-selected={episode.episodeKey === item.latestActivity.episodeKey}
			data-completed={completed}
		>
			<div className="popup-episode-main">
				<div className="popup-episode-header">
					<span className="popup-episode-number">
						{episode.episodeNumber === null
							? "Video"
							: `E${episode.episodeNumber}`}
					</span>
					<span className="popup-episode-title" dir="auto">
						{episode.episodeTitle}
					</span>
					<span className="popup-episode-complete" data-visible={completed}>
						{completed ? (
							<>
								<Check size={13} aria-hidden="true" />
								<span className="popup-sr-only">Completed</span>
							</>
						) : null}
					</span>
				</div>
				<div className="popup-series-progress">
					<span className="popup-progress-track">
						<span
							style={{
								width: `${Math.min(progress * 100, completed ? 100 : 99.9)}%`,
							}}
						/>
					</span>
					<span>{formatClock(currentTime)}</span>
				</div>
				<div className="popup-episode-actions">
					<button
						type="button"
						aria-label={`Resume ${episode.episodeTitle}`}
						disabled={busy === "open"}
						onClick={() => onOpen(episode.sourceUrl)}
					>
						Resume
					</button>
					{input.mode === "shared" &&
					(match?.matchingSessionCount || sessions.length) ? (
						<button
							type="button"
							aria-expanded={sessionsOpen}
							onClick={() => setSessionsOpen((value) => !value)}
						>
							{match?.matchingSessionCount ?? sessions.length} shared{" "}
							{(match?.matchingSessionCount ?? sessions.length) === 1
								? "session"
								: "sessions"}
						</button>
					) : null}
					{pending ? (
						<span className="popup-watch-pending">Pending sync</span>
					) : null}
				</div>
				{sessionsOpen ? (
					<div className="popup-watch-sessions">
						{sessions.map((session) => (
							<div className="popup-watch-session" key={session.id}>
								<time dateTime={session.lastWatchedAt}>
									{watchedDate(session.lastWatchedAt, true)}
								</time>
								<span className="popup-watch-participants" dir="auto">
									{session.participants
										.map((participant) => participant.user.displayName)
										.join(", ") || "No recorded participants"}
								</span>
								<button
									aria-label="Create room from Shared session"
									className="popup-session-summary-action"
									type="button"
									disabled={Boolean(busy)}
									onClick={() => onCreateRoom(session, episode.sourceUrl)}
								>
									Create room
								</button>
							</div>
						))}
						{pages.loading ? <p role="status">Loading sessions...</p> : null}
						{pages.error ? (
							<p role="alert">
								Could not load sessions.{" "}
								<button type="button" onClick={pages.reload}>
									Retry sessions
								</button>
							</p>
						) : null}
						{pages.nextCursor ? (
							<button
								type="button"
								disabled={pages.loading}
								onClick={pages.loadMore}
							>
								Load more sessions
							</button>
						) : null}
					</div>
				) : null}
			</div>
		</div>
	);
}
