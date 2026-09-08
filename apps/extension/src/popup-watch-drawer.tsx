import { parseWatchHistoryBootstrapData } from "./watch-history-client";
import { canCaptureWatchHistory } from "./watch-history-access";
import { buildPersonalHistoryResumeUrl } from "@anidachi/protocol";
import {
	type WatchHistoryBrowseQuery,
	type WatchHistoryBrowseResponse,
	WatchHistoryBrowseResponseSchema,
	type WatchHistoryBrowseTitleEpisodesResponse,
	WatchHistoryBrowseTitleEpisodesResponseSchema,
	type WatchHistoryItem,
	type WatchHistoryGridResponse,
	WatchHistoryGridResponseSchema,
	isWatchSpecialSeasonLabel,
	WatchHistoryResponseSchema,
	type WatchProgressEvent,
} from "@anidachi/protocol";
import { Check, ChevronDown, Play, RefreshCw, Search, X } from "lucide-react";
import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { WEB_HTTP_BASE } from "./constants";
import { PopupEpisodeProgress } from "./popup-episode-progress";
import { useWatchLoadingHeight } from "./use-watch-loading-height";
import {
	PopupWatchBrowseRecovery,
	PopupWatchBrowseViews,
	usePopupWatchBrowse,
} from "./popup-watch-browse";
import {
	emptyHistoryConditions,
	type PopupHistoryConditions,
	PopupWatchFilters,
} from "./popup-watch-filters";
import {
	defaultPopupWatchHistoryClient,
	formatClock,
	formatProgressPercent,
	groupWatchHistoryItems,
	isSameHistoryRevision,
	latestPendingByEpisode,
	type PopupHistoryLayout,
	type PopupWatchHistoryClient,
	type PopupWatchHistorySnapshot,
	ProviderLogo,
	pendingEpisodeKey,
	pendingTitleKey,
	pendingWatchHistoryEpisode,
	projectPendingWatchHistoryItems,
	reconcileHistoryLayout,
	reconcilePopupPendingEvents,
	requestPopupWatchHistory,
	watchHistoryOverallProgress,
} from "./popup-watch-history";
import {
	PopupEpisodePicker,
	PopupSeasonPicker,
	PopupUnwatchedEpisode,
	type PopupEpisodeChoice,
} from "./popup-watch-episode-picker";
import { useWatchProgressPreview } from "./use-watch-progress-preview";
import { createWatchHistoryDateRange } from "./watch-history-browse";

const titleMeta = (page: WatchHistoryBrowseResponse) => page.history.meta;
const titleCursor = (page: WatchHistoryBrowseResponse) =>
	page.history.nextCursor;
const detailMeta = (page: WatchHistoryBrowseTitleEpisodesResponse) =>
	page.detail.meta;
const detailCursor = (page: WatchHistoryBrowseTitleEpisodesResponse) =>
	page.detail.nextCursor;
const gridMeta = (page: WatchHistoryGridResponse) => page.meta;
const gridCursor = (page: WatchHistoryGridResponse) => page.nextCursor;
type Episode = WatchHistoryItem["seasons"][number]["episodes"][number];
type Disclosure = {
	isOpen(key: string, initial: boolean): boolean;
	toggle(key: string, initial: boolean): void;
};
function mergeBy<T>(values: T[], key: (item: T) => string) {
	return [...new Map(values.map((value) => [key(value), value])).values()];
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
	const watchRootRef = useRef<HTMLElement>(null);
	useWatchProgressPreview(watchRootRef);
	const [snapshot, setSnapshot] = useState<PopupWatchHistorySnapshot | null>(
		null,
	);
	const [cacheReady, setCacheReady] = useState(false);
	const [accessState, setAccessState] = useState<{
		client: PopupWatchHistoryClient;
		status: string;
		generation?: number;
	}>({ client, status: "checking" });
	const accessStatus =
		accessState.client === client ? accessState.status : "checking";
	const accessAllowed = accessStatus === "allowed";
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
		let disposed = false;
		let expiry: ReturnType<typeof setTimeout> | undefined;
		void requestPopupWatchHistory(client, {
			type: "ANIDACHI_WATCH_HISTORY_V3",
			command: "bootstrap",
			expectedOwnerUserId: ownerUserId,
		}).then((result) => {
			if (disposed) return;
			const data = result.ok
				? parseWatchHistoryBootstrapData(result.data)
				: null;
			const lease = data?.ownerUserId === ownerUserId ? data.accessLease : null;
			const currentLease =
				lease &&
				lease.access.ownerUserId === ownerUserId &&
				lease.access.accountGeneration === data?.accountGeneration &&
				Date.now() >= lease.receivedAt &&
				Date.now() < lease.expiresAt;
			const status = currentLease
				? lease.access.state === "allowed"
					? "allowed"
					: "plan-required"
				: !result.ok &&
						["plan-required", "upgrade-required"].includes(result.status)
					? result.status
					: "access-unavailable";
			setAccessState({ client, status, generation: data?.accountGeneration });
			if (currentLease)
				expiry = setTimeout(
					() => setAccessState({ client, status: "access-unavailable" }),
					lease.expiresAt - Date.now(),
				);
		});
		return () => {
			disposed = true;
			clearTimeout(expiry);
		};
	}, [client, ownerUserId, refreshVersion]);
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
			if (
				result &&
				!result.ok &&
				[
					"plan-required",
					"access-changed",
					"access-unavailable",
					"upgrade-required",
					"unauthenticated",
					"rejected",
				].includes(result.status)
			) {
				setAccessState({ client, status: result.status });
				setSnapshot(null);
				return;
			}
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

	useEffect(() => {
		const nextDay = new Date(now);
		nextDay.setHours(24, 0, 0, 0);
		const timer = window.setTimeout(
			() => setNow(new Date()),
			Math.max(0, nextDay.getTime() - Date.now()) + 100,
		);
		return () => window.clearTimeout(timer);
	}, [now]);

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
		mode: "personal",
		limit: 20,
		...(search.trim() ? { search: search.trim() } : {}),
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
		forceRefresh: refreshVersion,
		enabled: accessAllowed && dates.ok && cacheReady && !recovering,
		discard: !accessAllowed,
		generation: snapshot?.accountGeneration,
	});
	useWatchLoadingHeight(
		watchRootRef,
		browsing.loading && !browsing.pages.length,
	);
	const browseViews = useMemo(
		() => ({
			client,
			ownerUserId,
			generation: snapshot?.accountGeneration,
			refresh: refreshVersion + invalidation,
			pages: new Map<string, unknown[]>(),
		}),
		[
			client,
			ownerUserId,
			snapshot?.accountGeneration,
			refreshVersion,
			invalidation,
		],
	);
	useEffect(() => {
		if (browsing.errorStatus === "generation-mismatch")
			void recoverAfterMismatch(false);
	}, [browsing.errorStatus, recoverAfterMismatch]);
	useEffect(() => {
		if (
			[
				"plan-required",
				"access-changed",
				"upgrade-required",
				"access-unavailable",
			].includes(browsing.errorStatus ?? "")
		) {
			setAccessState({ client, status: browsing.errorStatus! });
		}
	}, [browsing.errorStatus, client]);
	const titleItems =
		accessAllowed && dates.ok
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
	const previews = new Map(
		browsing.pages
			.flatMap((page) => page.episodePreviews ?? [])
			.map((preview) => [
				pendingTitleKey(preview.detail.provider, preview.detail.titleKey),
				preview,
			]),
	);
	const pending = useMemo(() => {
		const events = snapshot?.pendingEvents ?? [];
		const result = latestPendingByEpisode(events);
		if (snapshot?.localObservation) {
			const event = snapshot.localObservation.event;
			result.set(
				pendingEpisodeKey(event.provider, event.titleKey, event.episodeKey),
				event,
			);
		}
		return result;
	}, [snapshot]);
	const allowPending =
		accessAllowed && !search.trim() && conditions.period === "all-time";
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
	const total = accessAllowed
		? (browsing.pages[0]?.history.totalTitleCount ?? 0)
		: 0;
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
	const openUrl = (url: string, currentTime?: number) =>
		void runAction("open", async () => {
			const token = actionGeneration.current;
			const generation =
				snapshotRef.current?.accountGeneration ??
				browsing.pages[0]?.history.meta.accountGeneration;
			if (currentTime === undefined) {
				await client.openUrl(url);
				return;
			}
			const bootstrapped = await requestPopupWatchHistory(client, {
				type: "ANIDACHI_WATCH_HISTORY_V3",
				command: "bootstrap",
				expectedOwnerUserId: ownerUserId,
			});
			const data = bootstrapped.ok
				? parseWatchHistoryBootstrapData(bootstrapped.data)
				: null;
			if (
				!data?.accessLease ||
				data.accountGeneration !== generation ||
				!canCaptureWatchHistory(data.accessLease, ownerUserId, Date.now()) ||
				actionGeneration.current !== token
			)
				return;
			const launch = await buildPersonalHistoryResumeUrl({
				ownerUserId,
				accountGeneration: data.accountGeneration,
				provider: new URL(url).hostname.endsWith("youtube.com")
					? "youtube"
					: "crunchyroll",
				sourceUrl: url,
				currentTime,
			});
			if (
				actionGeneration.current === token &&
				(snapshotRef.current?.accountGeneration ??
					browsing.pages[0]?.history.meta.accountGeneration) === generation
			)
				await client.openUrl(launch);
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
	if (!accessAllowed)
		return (
			<section className="popup-watch-screen" aria-label="Watch History">
				<div className="popup-empty" role="status">
					{accessStatus === "checking"
						? "Checking history access..."
						: accessStatus === "plan-required"
							? "Personal history is available with your own Plus or Pro plan. Your saved history is preserved."
							: accessStatus === "upgrade-required"
								? "Update AniDachi to use personal history."
								: "History access is temporarily unavailable. Please retry."}
				</div>
				<footer className="popup-watch-footer">
					{accessStatus === "plan-required" ? (
						<button
							type="button"
							onClick={() =>
								openUrl(new URL("/pricing", WEB_HTTP_BASE).toString())
							}
						>
							View plans
						</button>
					) : (
						<button
							type="button"
							onClick={() => setRefresh((value) => value + 1)}
						>
							Retry history access
						</button>
					)}
					<button
						type="button"
						onClick={() =>
							openUrl(
								new URL("/account/watch-library", WEB_HTTP_BASE).toString(),
							)
						}
					>
						Manage history
					</button>
				</footer>
			</section>
		);
	const content = (
		<section
			ref={watchRootRef}
			className="popup-watch-screen"
			aria-label="Watch History"
		>
			<div className="popup-watch-controls">
				<div className="popup-watch-search">
					<Search aria-hidden="true" size={15} />
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
					ownerUserId={ownerUserId}
					conditions={conditions}
					onChange={setConditions}
					dateError={dates.ok ? null : dates.error}
					today={now}
				/>
			</div>
			<div
				className={
					error ||
					snapshot?.capturePaused ||
					(!items.length &&
						!browsing.pages.length &&
						(recovering || browsing.loading))
						? "popup-watch-status"
						: "popup-sr-only"
				}
			>
				<span role="status">
					{recovering
						? "Recovering watch history..."
						: browsing.loading
							? browsing.pages.length
								? "Updating..."
								: "Loading watch history..."
							: ""}
				</span>
				{error || snapshot?.capturePaused ? (
					<button
						aria-label="Retry watch history"
						className="popup-watch-refresh"
						disabled={recovering || browsing.loading || Boolean(busy)}
						type="button"
						onClick={refreshHistory}
					>
						<RefreshCw aria-hidden="true" size={12} />
						Retry
					</button>
				) : null}
			</div>
			{snapshot?.capturePaused ? (
				<div className="popup-social-empty" data-tone="error">
					Watch History is paused because browser storage is full.
				</div>
			) : null}
			{snapshot?.retiredUnprovenCount ? (
				<div className="popup-social-empty" data-tone="warning">
					Older pending history could not be verified and was not uploaded. Your
					saved history is retained.
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
									aria-description={`${group.items.length} ${group.items.length === 1 ? "title" : "titles"} shown`}
									className="popup-provider-row"
									type="button"
									onClick={() => disclosure.toggle(branch, true)}
								>
									<ProviderLogo label={group.label} provider={group.provider} />
									<span className="popup-provider-main">
										<strong className="popup-provider-name">
											{group.label}
										</strong>
										<span className="popup-provider-count" aria-hidden="true">
											{group.items.length}
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
								{
									<div className="popup-provider-body" hidden={!open}>
										{group.items.map((item, index) => (
											<PopupWatchHistoryItem
												key={pendingTitleKey(item.provider, item.titleKey)}
												item={item}
												ownerUserId={ownerUserId}
												client={client}
												input={input}
												refresh={refreshVersion + invalidation}
												forceRefresh={refreshVersion}
												preview={previews.get(
													pendingTitleKey(item.provider, item.titleKey),
												)}
												generation={snapshot?.accountGeneration}
												disclosure={disclosure}
												initiallyOpen={index === 0}
												providerOpen={open}
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
											/>
										))}
									</div>
								}
							</section>
						);
					})}
				</div>
			) : !recovering &&
				(!browsing.loading || browsing.pages.length > 0) &&
				!error &&
				dates.ok ? (
				<div className="popup-empty">
					{search.trim() || conditions.period !== "all-time"
						? "No history matches these conditions."
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
			<PopupWatchBrowseViews.Provider value={browseViews}>
				{content}
			</PopupWatchBrowseViews.Provider>
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
	forceRefresh,
	preview,
	generation,
	disclosure,
	initiallyOpen,
	providerOpen,
	matchingDate,
	pending,
	allowPending,
	canonical,
	busy,
	onOpen,
}: {
	item: WatchHistoryItem;
	ownerUserId: string;
	client: PopupWatchHistoryClient;
	input: WatchHistoryBrowseQuery;
	refresh: number;
	forceRefresh: number;
	preview?: WatchHistoryBrowseTitleEpisodesResponse;
	generation?: number;
	disclosure: Disclosure;
	initiallyOpen: boolean;
	providerOpen: boolean;
	matchingDate?: string;
	pending: Map<string, WatchProgressEvent>;
	allowPending: boolean;
	canonical?: WatchHistoryItem;
	busy: string | null;
	onOpen: (url: string, currentTime?: number) => void;
}) {
	const branch = JSON.stringify([item.provider, item.titleKey]);
	const open = disclosure.isOpen(branch, initiallyOpen);
	const bodyId = useId();
	const hasOpened = useRef(open);
	if (open) hasOpened.current = true;
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
		forceRefresh,
		initialPage: preview,
		enabled: providerOpen && open && Boolean(matchingDate),
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
	const isSeries =
		item.provider === "crunchyroll" && item.itemKind === "series";
	const fullHistory =
		input.mode === "personal" && !input.search && !input.from && !input.until;
	const [chosenSeason, setChosenSeason] = useState<string | null>(null);
	const latestSeason = item.seasons.find((season) =>
		season.episodes.some(
			(episode) => episode.episodeKey === item.latestActivity.episodeKey,
		),
	)?.seasonKey;
	const requestedSeason = chosenSeason ?? latestSeason;
	const grid = usePopupWatchBrowse({
		client,
		message: {
			type: "ANIDACHI_WATCH_HISTORY_V3",
			command: "browse-catalog",
			expectedOwnerUserId: ownerUserId,
			input: {
				provider: "crunchyroll",
				titleKey: item.titleKey,
				...(requestedSeason && requestedSeason !== "__unseasoned__"
					? { seasonKey: requestedSeason }
					: {}),
			},
		},
		parser: WatchHistoryGridResponseSchema,
		meta: gridMeta,
		cursor: gridCursor,
		refresh,
		forceRefresh,
		generation,
		enabled: providerOpen && open && isSeries && Boolean(matchingDate),
	});
	// Retain just the season menu while another season loads. Never carry it
	// across an account, generation, client, or history invalidation.
	const catalogScope = JSON.stringify([ownerUserId, generation, refresh]);
	const retainedCatalog = useRef<{
		scope: string;
		client: PopupWatchHistoryClient;
		value: WatchHistoryGridResponse;
	} | null>(null);
	const catalogInvalid = [
		"unauthenticated",
		"rejected",
		"generation-mismatch",
		"deleted-history",
		"invalid-response",
	].includes(grid.errorStatus ?? "");
	if (catalogInvalid) retainedCatalog.current = null;
	else if (grid.pages[0])
		retainedCatalog.current = {
			scope: catalogScope,
			client,
			value: grid.pages[0],
		};
	const catalog = catalogInvalid
		? undefined
		: (grid.pages[0] ??
			(retainedCatalog.current?.scope === catalogScope &&
			retainedCatalog.current.client === client
				? retainedCatalog.current.value
				: undefined));
	const exactCatalog =
		catalog?.state === "complete" && item.catalogState === "complete"
			? catalog
			: undefined;
	const seasonMetadata =
		exactCatalog?.seasons ??
		page.pages[0]?.detail.catalog.seasons ??
		item.seasons;
	const observedSeasons = matchingEpisodes.map((episode) => ({
		seasonKey: episode.seasonKey ?? "__unseasoned__",
		seasonTitle: episode.seasonTitle ?? "Other episodes",
		seasonNumber: episode.seasonNumber,
		order: Number.MAX_SAFE_INTEGER,
		aggregate: {
			completedEpisodes: 0,
			availableEpisodes: null,
			progress: null,
		},
		nextEpisode: null,
	}));
	const seasons = mergeBy(
		[...observedSeasons, ...item.seasons, ...seasonMetadata],
		(season) => season.seasonKey,
	)
		.filter(
			(season) =>
				(fullHistory &&
					exactCatalog?.seasons.some(
						(known) => known.seasonKey === season.seasonKey,
					)) ||
				matchingEpisodes.some(
					(episode) =>
						(episode.seasonKey ?? "__unseasoned__") === season.seasonKey,
				),
		)
		.map((season) => ({
			...season,
			special: isWatchSpecialSeasonLabel(season.seasonTitle),
		}))
		.sort(
			(a, b) =>
				Number(a.special) - Number(b.special) ||
				a.order - b.order ||
				(a.seasonNumber ?? Infinity) - (b.seasonNumber ?? Infinity) ||
				a.seasonKey.localeCompare(b.seasonKey),
		);
	const selectedSeason =
		seasons.find((season) => season.seasonKey === chosenSeason) ??
		seasons.find((season) => season.seasonKey === latestSeason) ??
		seasons[0];
	useEffect(() => {
		if (open && selectedSeason && chosenSeason !== selectedSeason.seasonKey)
			setChosenSeason(selectedSeason.seasonKey);
	}, [open, selectedSeason?.seasonKey, chosenSeason]);
	const overall =
		item.itemKind === "movie" && item.provider === "crunchyroll"
			? {
					label: item.latestActivity.completedAt
						? "Watched"
						: `${formatClock(item.latestActivity.currentTime)} watched`,
					accessibleSuffix: item.latestActivity.completedAt
						? ", Watched"
						: `, ${formatProgressPercent(item.latestActivity.progress)} percent`,
					progress: item.latestActivity.progress,
				}
			: watchHistoryOverallProgress(
					exactCatalog?.mainAggregate
						? { ...item, aggregate: exactCatalog.mainAggregate }
						: item,
				);
	const specialAggregate = exactCatalog?.specialsAggregate;
	const effectiveEpisode = (episode: Episode): Episode => {
		const personal = canonical?.seasons
			.flatMap((season) => season.episodes)
			.find((value) => value.episodeKey === episode.episodeKey);
		return personal &&
			Date.parse(personal.lastWatchedAt) >= Date.parse(episode.lastWatchedAt)
			? {
					...episode,
					sourceUrl: personal.sourceUrl,
					lastWatchedAt: personal.lastWatchedAt,
					currentTime: personal.currentTime,
					duration: personal.duration,
					progress: personal.progress,
					completedAt: personal.completedAt ?? episode.completedAt,
				}
			: episode;
	};
	const episodePending = (episode: Episode) => {
		const event = pending.get(
			pendingEpisodeKey(item.provider, item.titleKey, episode.episodeKey),
		);
		return event &&
			Date.parse(event.observedAt) >= Date.parse(episode.lastWatchedAt)
			? event
			: undefined;
	};
	const rosterReady =
		fullHistory &&
		exactCatalog &&
		grid.pages[0]?.state === "complete" &&
		grid.pages[0].seasonKey === selectedSeason?.seasonKey &&
		exactCatalog.seasons.some(
			(season) => season.seasonKey === selectedSeason?.seasonKey,
		);
	// Keep Resume attached to the known current episode even when its catalog
	// cell is on a later page. Never manufacture a cell or fetch the full season.
	const knownLatest = matchingEpisodes.find(
		(episode) =>
			episode.episodeKey === item.latestActivity.episodeKey &&
			(episode.seasonKey ?? "__unseasoned__") === selectedSeason?.seasonKey,
	);
	const choices: PopupEpisodeChoice[] = rosterReady
		? mergeBy(
				grid.pages.flatMap((page) => page.episodes),
				(episode) => episode.episodeKey,
			).map((episode) => {
				const matched = matchingEpisodes.find(
					(value) => value.episodeKey === episode.episodeKey,
				);
				const history =
					episode.history &&
					(!matched ||
						Date.parse(episode.history.lastWatchedAt) >
							Date.parse(matched.lastWatchedAt))
						? episode.history
						: matched;
				const personal = history
					? effectiveEpisode({
							...history,
							episodeTitle: episode.episodeTitle,
							episodeNumber: episode.episodeNumber,
						})
					: undefined;
				return {
					key: episode.episodeKey,
					title: episode.episodeTitle,
					number: episode.episodeNumber,
					catalog: episode,
					history: personal,
					pending: personal ? episodePending(personal) : undefined,
				};
			})
		: matchingEpisodes
				.filter(
					(episode) =>
						(episode.seasonKey ?? "__unseasoned__") ===
						selectedSeason?.seasonKey,
				)
				.sort(
					(a, b) =>
						(a.episodeNumber ?? Infinity) - (b.episodeNumber ?? Infinity) ||
						(a.episodeKey < b.episodeKey
							? -1
							: a.episodeKey > b.episodeKey
								? 1
								: 0),
				)
				.map((episode) => {
					const personal = effectiveEpisode(episode);
					return {
						key: episode.episodeKey,
						title: episode.episodeTitle,
						number: episode.episodeNumber,
						history: personal,
						pending: episodePending(personal),
					};
				});

	const renderEpisode = (
		episode: Episode,
		detail = false,
		available = true,
	) => (
		<PopupEpisode
			key={episode.episodeKey}
			episode={effectiveEpisode(episode)}
			item={item}
			pending={episodePending(effectiveEpisode(episode))}
			match={episodeMatches.get(episode.episodeKey)}
			ownerUserId={ownerUserId}
			client={client}
			input={input}
			refresh={refresh}
			generation={generation}
			busy={busy}
			onOpen={onOpen}
			detail={detail}
			active={providerOpen && open}
			available={available}
		/>
	);
	const selectedAggregate =
		item.catalogState === "complete" ? selectedSeason?.aggregate : undefined;

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
					data-has-progress={overall.progress !== null}
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
						<span className="popup-watch-summary">
							<span className="popup-watch-meta">
								{overall.label.split(" · ")[0]}
								{specialAggregate ? (
									<span className="popup-watch-special-total">
										{" "}
										+ {specialAggregate.completedEpisodes} /{" "}
										{specialAggregate.availableEpisodes} specials
									</span>
								) : null}
							</span>
							{overall.progress !== null ? (
								<span
									className="popup-watch-overall popup-watch-progress-preview"
									aria-hidden="true"
								>
									<span className="popup-watch-overall-label">
										<span className="popup-watch-meta">
											{isSeries ? "Series progress" : "Watch progress"}
										</span>
										<span className="popup-watch-percent">
											{formatProgressPercent(overall.progress)}%
										</span>
									</span>
									<span
										className="popup-watch-overall-track"
										aria-hidden="true"
									>
										<span style={{ width: `${overall.progress * 100}%` }} />
									</span>
								</span>
							) : null}
						</span>
						{!matchingDate ? (
							<span className="popup-watch-pending">Pending sync</span>
						) : null}
					</span>
					<ChevronDown
						aria-hidden="true"
						className="popup-watch-disclosure-icon"
						size={16}
					/>
				</button>
			</div>
			{hasOpened.current ? (
				<div
					hidden={!open}
					className={
						isSeries ? "popup-watch-grid-view" : "popup-watch-video-list"
					}
					id={bodyId}
				>
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
					{isSeries && selectedSeason ? (
						<>
							<div className="popup-season-toolbar">
								<PopupSeasonPicker
									seasons={seasons}
									selected={selectedSeason.seasonKey}
									onSelect={setChosenSeason}
									title={item.title}
								/>
								<span className="popup-season-counter">
									{selectedAggregate?.availableEpisodes === 0
										? "Unavailable"
										: selectedAggregate?.availableEpisodes != null
											? `${selectedAggregate.completedEpisodes} / ${selectedAggregate.availableEpisodes} watched`
											: `${choices.length} known`}
								</span>
							</div>
							<PopupEpisodePicker
								pending={
									fullHistory &&
									Boolean(exactCatalog) &&
									!rosterReady &&
									grid.loading
								}
								title={item.title}
								seasonKey={selectedSeason.seasonKey}
								seasonTitle={selectedSeason.seasonTitle}
								entries={choices}
								latestKey={item.latestActivity.episodeKey}
								knownLatest={
									knownLatest
										? {
												key: knownLatest.episodeKey,
												title: knownLatest.episodeTitle,
												number: knownLatest.episodeNumber,
												history: effectiveEpisode(knownLatest),
												pending: episodePending(knownLatest),
											}
										: undefined
								}
								special={
									selectedSeason.special ||
									selectedSeason.seasonKey === "__unseasoned__"
								}
								loading={
									rosterReady || (fullHistory && exactCatalog)
										? grid.loading
										: page.loading
								}
								hasMore={Boolean(
									rosterReady ? grid.nextCursor : page.nextCursor,
								)}
								loadMore={rosterReady ? grid.loadMore : page.loadMore}
								renderSelected={(entry) =>
									entry.history ? (
										renderEpisode(entry.history, true, entry.catalog?.available)
									) : (
										<PopupUnwatchedEpisode
											entry={entry}
											onOpen={onOpen}
											busy={busy === "open"}
										/>
									)
								}
							/>
							{fullHistory && !rosterReady ? (
								<p
									className="popup-catalog-note"
									role={grid.loading ? "status" : undefined}
									hidden={Boolean(exactCatalog) && grid.loading}
								>
									{grid.loading
										? "Loading episode catalog..."
										: "Known episodes only · full catalog unavailable"}
									{grid.error ? (
										<>
											{" "}
											<button type="button" onClick={grid.reload}>
												Retry catalog
											</button>
										</>
									) : null}
								</p>
							) : !fullHistory ? (
								<p className="popup-catalog-note">
									Episodes matching your filters
								</p>
							) : null}
							{rosterReady && grid.error ? (
								<p className="popup-catalog-note" role="alert">
									Could not load more episodes.{" "}
									<button type="button" onClick={grid.reload}>
										Retry catalog
									</button>
								</p>
							) : null}
						</>
					) : isSeries ? null : item.itemKind === "movie" &&
						item.provider === "crunchyroll" ? (
						(() => {
							const film =
								matchingEpisodes.find(
									(episode) =>
										episode.episodeKey === item.latestActivity.episodeKey,
								) ?? matchingEpisodes[0];
							return film ? renderEpisode(film, true) : null;
						})()
					) : (
						matchingEpisodes.map((episode) => renderEpisode(episode))
					)}
					{page.nextCursor && (!isSeries || !selectedSeason) ? (
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
					!matchingEpisodes.length &&
					!selectedSeason ? (
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
	detail = false,
	available = true,
	active = true,
}: {
	detail?: boolean;
	available?: boolean;
	active?: boolean;
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
	onOpen: (url: string, currentTime?: number) => void;
}) {
	const completed = Boolean(episode.completedAt);
	const currentTime = pending?.currentTime ?? episode.currentTime;
	const progress = pending?.progress ?? episode.progress;
	return (
		<div
			className={
				detail
					? "popup-episode-row popup-selected-episode"
					: "popup-episode-row"
			}
			data-selected={episode.episodeKey === item.latestActivity.episodeKey}
			data-completed={completed}
		>
			<div className="popup-episode-main">
				{detail ? (
					<>
						<div className="popup-selected-episode-heading">
							<span>
								{item.itemKind === "movie"
									? "Film"
									: episode.episodeNumber === null
										? "Episode"
										: `Episode ${episode.episodeNumber}`}
							</span>
							<span>
								{completed
									? "Watched"
									: currentTime > 0
										? "In progress"
										: "Not watched"}
							</span>
						</div>
						{item.itemKind !== "movie" ? (
							<strong className="popup-selected-episode-title" dir="auto">
								{episode.episodeTitle}
							</strong>
						) : null}
						<PopupEpisodeProgress
							title={episode.episodeTitle}
							elapsed={formatClock(currentTime)}
							duration={
								(pending?.duration ?? episode.duration) > 0
									? formatClock(pending?.duration ?? episode.duration)
									: "—"
							}
							progress={Math.min(progress, completed ? 1 : 0.999)}
							action={`${completed ? "Watch again" : currentTime > 0 ? "Resume" : "Watch"}${!completed && item.itemKind !== "movie" && episode.episodeNumber !== null ? ` E${episode.episodeNumber}` : ""}`}
							actionLabel={`Resume ${episode.episodeTitle}`}
							disabled={busy === "open" || !available}
							onOpen={() => onOpen(pending?.sourceUrl ?? episode.sourceUrl, currentTime)}
						/>
					</>
				) : (
					<>
						<div className="popup-episode-header">
							<span className="popup-episode-number">
								{episode.episodeNumber === null
									? "Video"
									: `E${episode.episodeNumber}`}
							</span>
							<span className="popup-episode-title" dir="auto">
								{episode.episodeTitle}
							</span>
							<button
								className="popup-episode-resume"
								type="button"
								aria-label={`Resume ${episode.episodeTitle}`}
								title="Resume"
								disabled={busy === "open" || !available}
								onClick={() => onOpen(pending?.sourceUrl ?? episode.sourceUrl, currentTime)}
							>
								<Play size={14} fill="currentColor" aria-hidden="true" />
							</button>
						</div>
						<div className="popup-series-progress">
							<span className="popup-progress-track" aria-hidden="true">
								<span
									style={{
										width: `${Math.min(progress * 100, completed ? 100 : 99.9)}%`,
									}}
								/>
							</span>
							<span className="popup-episode-time">
								{completed ? (
									<span className="popup-episode-complete">
										<Check size={12} aria-hidden="true" />
										<span className="popup-sr-only">Completed</span>
									</span>
								) : null}
								{formatClock(currentTime)}
							</span>
						</div>
					</>
				)}
				<div className="popup-episode-actions">
					{pending ? (
						<span className="popup-watch-pending">Pending sync</span>
					) : null}
				</div>
			</div>
		</div>
	);
}
