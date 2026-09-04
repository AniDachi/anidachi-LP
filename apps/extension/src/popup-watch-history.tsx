import {
  WATCH_HISTORY_TITLE_EPISODE_SLICE_LIMIT,
  type WatchHistoryDeleteScope,
  WatchHistoryDeletionAckSchema,
  WatchHistoryEpisodeSchema,
  type WatchHistoryItem,
  type WatchHistoryPreferences,
  WatchHistoryPreferencesResponseSchema,
  type WatchHistoryResponse,
  WatchHistoryResponseSchema,
  WatchHistoryRoomRecreationResponseSchema,
  type WatchHistorySession,
  type WatchProgressEvent,
  WatchProgressEventSchema,
} from "@anidachi/protocol";
import { Check, ChevronDown, RefreshCw, Search, Trash2, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  createListWatchHistoryMessage,
  createWatchHistoryMessage,
  requestWatchHistory,
  type WatchHistoryMessage,
  type WatchHistoryMessageResponse,
} from "./watch-history-client";
import {
  createWatchHistoryStorage,
  WATCH_HISTORY_STORAGE_KEY,
  type WatchHistoryObservationDisplayMode,
  type WatchHistoryStorageRoot,
  watchHistoryPartitionKey,
} from "./watch-history-storage";

export type PopupWatchHistoryLocalObservation = {
  event: WatchProgressEvent;
  mode: WatchHistoryObservationDisplayMode;
};

export type PopupWatchHistorySnapshot = {
  history: WatchHistoryResponse;
  accountGeneration: number;
  preferences: WatchHistoryPreferences;
  pendingEvents: WatchProgressEvent[];
  localObservation: PopupWatchHistoryLocalObservation | null;
  capturePaused: boolean;
};

export type PopupWatchHistoryClient = {
  loadCached(ownerUserId: string): Promise<PopupWatchHistorySnapshot | null>;
  request(message: WatchHistoryMessage): Promise<WatchHistoryMessageResponse>;
  subscribe?(
    ownerUserId: string,
    listener: (snapshot: PopupWatchHistorySnapshot | null) => void,
  ): () => void;
  confirmDiscard(message: string): boolean;
  openUrl(url: string): Promise<void>;
};

const LOCAL_CACHE_REFRESH_CURSOR = "local_cache_refresh_required";

const defaultClient: PopupWatchHistoryClient = {
  loadCached: loadConfirmedPopupWatchHistorySnapshot,
  request: requestWatchHistory,
  subscribe: subscribeToPopupWatchHistorySnapshot,
  confirmDiscard: (message) => window.confirm(message),
  openUrl: async (url) => {
    await chrome.tabs.create({ url });
  },
};

async function requestPopupWatchHistory(
  client: PopupWatchHistoryClient,
  message: WatchHistoryMessage,
): Promise<WatchHistoryMessageResponse> {
  try {
    return await client.request(message);
  } catch {
    return { ok: false, status: "retryable" };
  }
}

function isSameHistoryRevision(
  current: WatchHistoryResponse | null,
  next: WatchHistoryResponse,
): boolean {
  return current === next || Boolean(
    current &&
    current.meta.ownerUserId === next.meta.ownerUserId &&
    current.meta.accountGeneration === next.meta.accountGeneration &&
    current.meta.serverTime === next.meta.serverTime &&
    current.generatedAt === next.generatedAt &&
    current.totalTitleCount === next.totalTitleCount,
  );
}

export function PopupWatchHistoryPanel({
  ownerUserId,
  client = defaultClient,
  onTitleCountChange,
  refreshSignal = 0,
}: {
  ownerUserId: string | null;
  client?: PopupWatchHistoryClient;
  onTitleCountChange?: (count: number) => void;
  refreshSignal?: number;
}) {
  const [history, setHistory] = useState<WatchHistoryResponse | null>(null);
  const [pendingEvents, setPendingEvents] = useState<WatchProgressEvent[]>([]);
  const [localObservation, setLocalObservation] =
    useState<PopupWatchHistoryLocalObservation | null>(null);
  const [capturePaused, setCapturePaused] = useState(false);
  const [preferences, setPreferences] = useState<WatchHistoryPreferences>({
    youtubeHistoryEnabled: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [oldOwnerPending, setOldOwnerPending] = useState(false);
  const [mode, setMode] = useState<"mine" | "together">("mine");
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [expandedBranches, setExpandedBranches] = useState<Record<string, boolean>>({});
  const [searchBranches, setSearchBranches] = useState<{
    query: string;
    branches: Record<string, boolean>;
  }>({ query: "", branches: {} });
  const [manualRefreshVersion, setManualRefreshVersion] = useState(0);
  const requestGeneration = useRef(0);
  const preferenceRevision = useRef(0);
  const renderedOwnerRef = useRef(ownerUserId);

  useEffect(() => {
    onTitleCountChange?.(history?.totalTitleCount ?? 0);
  }, [history?.totalTitleCount, onTitleCountChange]);

  useEffect(() => {
    setMode("mine");
    setSearchQuery("");
    setExpandedBranches({});
    setSearchBranches({ query: "", branches: {} });
  }, [ownerUserId]);

  useEffect(() => {
    const generation = ++requestGeneration.current;
    const current = () => requestGeneration.current === generation;
    const ownerChanged = renderedOwnerRef.current !== ownerUserId;
    renderedOwnerRef.current = ownerUserId;
    if (ownerChanged) {
      setHistory(null);
      setPendingEvents([]);
      setLocalObservation(null);
      setCapturePaused(false);
      setPreferences({ youtubeHistoryEnabled: false });
      setBusyAction(null);
      setOldOwnerPending(false);
    }
    setError(null);
    if (!ownerUserId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    void (async () => {
      const preferenceRevisionAtLoad = preferenceRevision.current;
      const cached = await client.loadCached(ownerUserId).catch(() => null);
      if (!current()) return;
      if (cached) {
        setHistory((visibleHistory) => visibleHistory ?? cached.history);
        setPendingEvents(cached.pendingEvents);
        setLocalObservation(cached.localObservation);
        setCapturePaused(cached.capturePaused);
        if (preferenceRevision.current === preferenceRevisionAtLoad) {
          setPreferences(cached.preferences);
        }
      }

      const historyRequest = requestPopupWatchHistory(
        client,
        createListWatchHistoryMessage({ limit: 100 }),
      );
      const preferencesRequest = requestPopupWatchHistory(
        client,
        createWatchHistoryMessage({
          type: "ANIDACHI_WATCH_HISTORY_V2",
          command: "get-preferences",
        }),
      );
      const oldOwnerRequest = requestPopupWatchHistory(
        client,
        createWatchHistoryMessage({
          type: "ANIDACHI_WATCH_HISTORY_V2",
          command: "other-owner-pending",
        }),
      );

      void preferencesRequest.then((preferencesResponse) => {
        if (!current() || preferenceRevision.current !== preferenceRevisionAtLoad) return;
        if (!preferencesResponse.ok) return;
        const parsed = WatchHistoryPreferencesResponseSchema.safeParse(preferencesResponse.data);
        if (parsed.success && parsed.data.meta.ownerUserId === ownerUserId) {
          setPreferences(parsed.data.preferences);
        }
      });
      void oldOwnerRequest.then((oldOwnerResponse) => {
        if (current() && oldOwnerResponse.ok) {
          setOldOwnerPending(oldOwnerResponse.hasPendingWork === true);
        }
      });

      const historyResponse = await historyRequest;
      if (!current()) return;

      if (historyResponse.ok) {
        const parsed = WatchHistoryResponseSchema.safeParse(historyResponse.data);
        if (parsed.success && parsed.data.meta.ownerUserId === ownerUserId) {
          setHistory(parsed.data);
          const refreshedLocal = await client.loadCached(ownerUserId).catch(() => null);
          if (!current()) return;
          if (refreshedLocal?.accountGeneration === parsed.data.meta.accountGeneration) {
            setPendingEvents((currentEvents) =>
              reconcilePopupPendingEvents(currentEvents, refreshedLocal)
            );
            setLocalObservation(refreshedLocal.localObservation);
            setCapturePaused(refreshedLocal.capturePaused);
          } else {
            setPendingEvents([]);
            setLocalObservation(null);
          }
        } else {
          setError("Could not validate watch history.");
        }
      } else {
        setError(messageForStatus(historyResponse.status));
        if (historyResponse.status === "storage-full") setCapturePaused(true);
      }

      setLoading(false);
    })();

    return () => {
      if (requestGeneration.current === generation) requestGeneration.current += 1;
    };
  }, [client, manualRefreshVersion, ownerUserId, refreshSignal]);

  useEffect(() => {
    if (!ownerUserId || !client.subscribe) return;
    return client.subscribe(ownerUserId, (snapshot) => {
      if (!snapshot || snapshot.history.meta.ownerUserId !== ownerUserId) return;
      setHistory((current) => isSameHistoryRevision(current, snapshot.history)
        ? current
        : snapshot.history);
      setPendingEvents((current) => reconcilePopupPendingEvents(current, snapshot));
      setLocalObservation(snapshot.localObservation);
      setCapturePaused(snapshot.capturePaused);
      setPreferences((current) =>
        current.youtubeHistoryEnabled === snapshot.preferences.youtubeHistoryEnabled
          ? current
          : snapshot.preferences
      );
    });
  }, [client, ownerUserId]);

  const visiblePendingEvents = useMemo(
    () => pendingEvents.filter((event) =>
      mode === "together" ? Boolean(event.sharedRoom) : !event.sharedRoom,
    ),
    [mode, pendingEvents],
  );
  const visibleLocalObservation = localObservation?.mode === mode
    ? localObservation.event
    : null;
  const pendingByEpisode = useMemo(
    () => {
      const pending = latestPendingByEpisode(visiblePendingEvents);
      if (visibleLocalObservation) {
        pending.set(
          pendingEpisodeKey(
            visibleLocalObservation.provider,
            visibleLocalObservation.titleKey,
            visibleLocalObservation.episodeKey,
          ),
          visibleLocalObservation,
        );
      }
      return pending;
    },
    [visibleLocalObservation, visiblePendingEvents],
  );
  const itemsWithPending = useMemo(
    () => projectPendingWatchHistoryItems(
      history?.items ?? [],
      pendingByEpisode,
      visibleLocalObservation,
    ),
    [history?.items, pendingByEpisode, visibleLocalObservation],
  );
  const visibleItems = useMemo(
    () => filterWatchHistoryItems(itemsWithPending, mode, searchQuery, pendingByEpisode),
    [itemsWithPending, mode, pendingByEpisode, searchQuery],
  );
  const providerGroups = useMemo(() => groupWatchHistoryItems(visibleItems), [visibleItems]);

  // Searching reveals matches without overwriting the user's normal tree layout.
  const query = searchQuery.trim().toLocaleLowerCase();
  const updateSearchQuery = (value: string) => {
    const nextQuery = value.trim().toLocaleLowerCase();
    setSearchQuery(value);
    if (nextQuery !== query) setSearchBranches({ query: nextQuery, branches: {} });
  };
  const branches = query
    ? searchBranches.query === query ? searchBranches.branches : {}
    : expandedBranches;
  const disclosure: PopupHistoryDisclosure = {
    isOpen: (key, initiallyOpen) => branches[key] ?? (Boolean(query) || initiallyOpen),
    toggle: (key, initiallyOpen) => {
      if (query) {
        setSearchBranches((current) => {
          const previous = current.query === query ? current.branches : {};
          return { query, branches: { ...previous, [key]: !(previous[key] ?? true) } };
        });
      } else {
        setExpandedBranches((current) => ({ ...current, [key]: !(current[key] ?? initiallyOpen) }));
      }
    },
  };

  const updateYoutubePreference = async () => {
    if (!ownerUserId || busyAction) return;
    const expectedGeneration = requestGeneration.current;
    const previousPreferences = preferences;
    const nextPreferences = {
      youtubeHistoryEnabled: !preferences.youtubeHistoryEnabled,
    };
    const revision = ++preferenceRevision.current;
    setPreferences(nextPreferences);
    setBusyAction("preferences");
    setError(null);
    const response = await requestPopupWatchHistory(client, createWatchHistoryMessage({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "update-preferences",
      input: nextPreferences,
    }));
    const samePreferenceRevision = preferenceRevision.current === revision;
    if (requestGeneration.current === expectedGeneration && samePreferenceRevision && !response.ok) {
      setPreferences(previousPreferences);
      setError(messageForStatus(response.status));
    }
    if (samePreferenceRevision) setBusyAction(null);
  };

  const deleteTarget = async (target: WatchHistoryDeleteScope) => {
    if (!ownerUserId || !history || busyAction) return;
    if (!client.confirmDiscard("Delete this watch history?")) return;
    const expectedGeneration = requestGeneration.current;
    const actionKey = deleteScopeKey(target);
    setBusyAction(actionKey);
    setError(null);
    const response = await client.request(createWatchHistoryMessage({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "delete",
      input: {
        schemaVersion: 2,
        clientMutationId: crypto.randomUUID(),
        accountGeneration: history.meta.accountGeneration,
        target,
        requestedAt: new Date().toISOString(),
      },
    }));
    if (requestGeneration.current !== expectedGeneration) return;
    if (response.ok) {
      const parsed = WatchHistoryDeletionAckSchema.safeParse(response.data);
      if (parsed.success &&
        parsed.data.meta.ownerUserId === ownerUserId &&
        parsed.data.accountGeneration >= history.meta.accountGeneration) {
        setHistory((current) => current
          ? removeHistoryTarget(current, parsed.data.target, parsed.data.accountGeneration)
          : null);
        setPendingEvents((current) => current.filter((event) => !eventMatchesScope(event, parsed.data.target)));
      } else {
        setError("Could not validate history deletion.");
      }
    } else {
      setError(messageForStatus(response.status));
    }
    setBusyAction(null);
  };

  const createRoom = async (session: WatchHistorySession, sourceUrl: string) => {
    if (busyAction) return;
    const expectedGeneration = requestGeneration.current;
    setBusyAction(`room:${session.id}`);
    setError(null);
    const response = await client.request(createWatchHistoryMessage({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "create-room",
      sessionId: session.id,
      clientRequestId: crypto.randomUUID(),
    }));
    if (requestGeneration.current !== expectedGeneration) return;
    if (response.ok) {
      const parsed = WatchHistoryRoomRecreationResponseSchema.safeParse(response.data);
      if (parsed.success) {
        await client.openUrl(withRoomHash(sourceUrl, parsed.data.roomId));
      } else {
        setError("Could not validate the recreated room.");
      }
    } else {
      setError(messageForStatus(response.status));
    }
    setBusyAction(null);
  };

  const discardOldOwnerWork = async () => {
    if (!oldOwnerPending || busyAction) return;
    if (!client.confirmDiscard("Discard pending Watch History from another account?")) return;
    setBusyAction("discard-old-owner");
    const response = await client.request(createWatchHistoryMessage({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "discard-old-owner-work",
      confirmed: true,
    }));
    if (response.ok) setOldOwnerPending(false);
    else setError(messageForStatus(response.status));
    setBusyAction(null);
  };

  const refreshHistory = async () => {
    if (loading || busyAction) return;
    if (capturePaused) {
      const expectedGeneration = requestGeneration.current;
      setBusyAction("refresh");
      setError(null);
      const response = await client.request(createWatchHistoryMessage({
        type: "ANIDACHI_WATCH_HISTORY_V2",
        command: "recover-storage",
      }));
      if (requestGeneration.current !== expectedGeneration) return;
      if (!response.ok) {
        setError(messageForStatus(response.status));
        setBusyAction(null);
        return;
      }
      setCapturePaused(false);
      setBusyAction(null);
    }
    setManualRefreshVersion((current) => current + 1);
  };

  if (!ownerUserId) {
    return <div className="popup-empty">Sign in to sync watch history.</div>;
  }

  return (
    <section className="popup-watch-screen" aria-label="Watch History">
      <div className="popup-watch-controls">
        <button
          aria-label={`Watch history mode: ${mode === "mine" ? "Mine" : "Together"}. Switch to ${
            mode === "mine" ? "Together" : "Mine"
          }`}
          aria-pressed={mode === "together"}
          className="popup-watch-mode-switch"
          data-mode={mode}
          type="button"
          onClick={() => setMode((current) => current === "mine" ? "together" : "mine")}
        >
          <span aria-hidden="true" className="popup-watch-mode-track">
            <span className="popup-watch-mode-thumb" />
            <span className="popup-watch-mode-segment popup-watch-mode-segment-mine">Mine</span>
            <span className="popup-watch-mode-segment popup-watch-mode-segment-together">
              Together
            </span>
          </span>
        </button>
        <div className="popup-watch-search">
          <Search aria-hidden="true" size={13} />
          <input
            aria-label="Search watch history"
            placeholder="Search"
            type="search"
            ref={searchInputRef}
            value={searchQuery}
            onChange={(event) => updateSearchQuery(event.currentTarget.value)}
          />
          {searchQuery ? (
            <button
              aria-label="Clear watch history search"
              type="button"
              onClick={() => {
                updateSearchQuery("");
                searchInputRef.current?.focus();
              }}
            >
              <X size={12} />
            </button>
          ) : null}
        </div>
        <button
          aria-label={error || capturePaused ? "Retry watch history" : "Refresh watch history"}
          className="popup-watch-refresh"
          disabled={loading || Boolean(busyAction)}
          title={error || capturePaused ? "Retry watch history" : "Refresh watch history"}
          type="button"
          onClick={() => void refreshHistory()}
        >
          <RefreshCw aria-hidden="true" size={13} />
          <span>{error || capturePaused ? "Retry" : "Refresh"}</span>
        </button>
      </div>
      <div className="popup-watch-preferences">
        <button
          aria-label="Track YouTube history"
          aria-checked={preferences.youtubeHistoryEnabled}
          className="popup-watch-youtube-switch"
          data-enabled={preferences.youtubeHistoryEnabled}
          disabled={Boolean(busyAction)}
          role="switch"
          title="Track YouTube history"
          type="button"
          onClick={() => void updateYoutubePreference()}
        >
          <span className="popup-watch-youtube-label">Track YouTube history</span>
          <span className="popup-watch-youtube-state">
            {preferences.youtubeHistoryEnabled ? "On" : "Off"}
          </span>
          <span className="popup-watch-youtube-switch-track" aria-hidden="true">
            <span />
          </span>
        </button>
      </div>
      {capturePaused ? (
        <div className="popup-social-empty" data-tone="error">
          Watch History is paused because browser storage is full.
        </div>
      ) : null}
      {oldOwnerPending ? (
        <div className="popup-social-empty" data-tone="warning">
          <span>Pending history from another account</span>
          <button
            aria-label="Discard pending history from another account"
            disabled={busyAction === "discard-old-owner"}
            type="button"
            onClick={() => void discardOldOwnerWork()}
          >
            Discard
          </button>
        </div>
      ) : null}
      {error ? <div className="popup-social-empty" data-tone="error">{error}</div> : null}
      {loading && !history ? (
        <div className="popup-empty popup-empty-syncing">
          <RefreshCw size={14} />
          <span>Loading watch history...</span>
        </div>
      ) : providerGroups.length ? (
        <div className="popup-resource-list">
          {providerGroups.map((group) => (
            <PopupProviderSection
              busyAction={busyAction}
              group={group}
              disclosure={disclosure}
              key={group.provider}
              onCreateRoom={createRoom}
              onDelete={deleteTarget}
              pendingByEpisode={pendingByEpisode}
            />
          ))}
        </div>
      ) : history?.items.length && searchQuery.trim() ? (
        <div className="popup-empty">No titles match your search.</div>
      ) : history?.items.length ? (
        <div className="popup-empty">
          {mode === "together"
            ? "Shared sessions will appear after watching together."
            : "Episodes you watch on supported sites will appear here."}
        </div>
      ) : (
        <div className="popup-empty">Episodes you watch on supported sites will appear here.</div>
      )}
      {history?.items.length ? (
        <button
          aria-label="Clear all watch history"
          className="popup-quiet-danger"
          disabled={Boolean(busyAction)}
          type="button"
          onClick={() => void deleteTarget({ scope: "all" })}
        >
          Clear watch history
        </button>
      ) : null}
    </section>
  );
}

type PopupHistoryDisclosure = {
  isOpen: (key: string, initiallyOpen: boolean) => boolean;
  toggle: (key: string, initiallyOpen: boolean) => void;
};

function PopupProviderSection({
  busyAction,
  disclosure,
  group,
  onCreateRoom,
  onDelete,
  pendingByEpisode,
}: {
  busyAction: string | null;
  disclosure: PopupHistoryDisclosure;
  group: PopupProviderGroup;
  onCreateRoom: (session: WatchHistorySession, sourceUrl: string) => void;
  onDelete: (target: WatchHistoryDeleteScope) => void;
  pendingByEpisode: Map<string, WatchProgressEvent>;
}) {
  const branchKey = JSON.stringify([group.provider]);
  const open = disclosure.isOpen(branchKey, true);
  const bodyId = useId();

  return (
    <section className="popup-provider" data-provider={group.provider}>
      <button
        aria-expanded={open}
        aria-controls={bodyId}
        aria-label={`Toggle ${group.label} history`}
        className="popup-provider-row"
        type="button"
        onClick={() => disclosure.toggle(branchKey, true)}
      >
        <ProviderLogo label={group.label} provider={group.provider} />
        <span className="popup-provider-main">
          <strong className="popup-provider-name">{group.label}</strong>
          <span className="popup-provider-meta">
            {group.items.length} {group.items.length === 1 ? "title" : "titles"}
          </span>
        </span>
        <span aria-hidden="true" className="popup-provider-chevron" data-open={open}>
          <ChevronDown size={18} />
        </span>
      </button>
      {open ? (
        <div className="popup-provider-body" id={bodyId}>
          {group.items.map((item, index) => (
            <PopupWatchHistoryItem
              item={item}
              disclosure={disclosure}
              initiallyOpen={index === 0}
              key={`${item.provider}:${item.titleKey}`}
              busyAction={busyAction}
              onCreateRoom={onCreateRoom}
              onDelete={onDelete}
              pendingByEpisode={pendingByEpisode}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function PopupWatchHistoryItem({
	busyAction,
	disclosure,
	initiallyOpen,
	item,
	onCreateRoom,
	onDelete,
	pendingByEpisode,
}: {
	busyAction: string | null;
	disclosure: PopupHistoryDisclosure;
	initiallyOpen: boolean;
	item: WatchHistoryItem;
	onCreateRoom: (session: WatchHistorySession, sourceUrl: string) => void;
	onDelete: (target: WatchHistoryDeleteScope) => void;
	pendingByEpisode: Map<string, WatchProgressEvent>;
}) {
	const observedCount = item.observedEpisodeCount;
	const branchKey = JSON.stringify([item.provider, item.titleKey]);
	const open = disclosure.isOpen(branchKey, initiallyOpen);
	const bodyId = useId();
	const latestSeasonKey =
		item.seasons.find((season) =>
			season.episodes.some(
				(episode) => episode.episodeKey === item.latestActivity.episodeKey,
			),
		)?.seasonKey ?? item.seasons[0]?.seasonKey;
	const latestActivityPending = pendingByEpisode.get(
		pendingEpisodeKey(
			item.provider,
			item.titleKey,
			item.latestActivity.episodeKey,
		),
	);
	return (
		<article
			className="popup-watch-item"
			data-kind={item.itemKind}
			data-provider={item.provider}
			data-open={open}
		>
			<div className="popup-watch-row">
				<button
					aria-label={`Toggle ${item.title} history`}
					aria-expanded={open}
					aria-controls={bodyId}
					className="popup-watch-title-toggle"
					type="button"
					onClick={() => disclosure.toggle(branchKey, initiallyOpen)}
				>
					<span
						className="popup-watch-artwork"
						data-has-artwork={Boolean(item.artworkUrl)}
					>
						{item.artworkUrl ? (
							<img alt="" loading="lazy" src={item.artworkUrl} />
						) : (
							item.title.slice(0, 1)
						)}
					</span>
					<span className="popup-watch-main">
						<strong className="popup-watch-title">{item.title}</strong>
						<span className="popup-watch-meta">
							{item.catalogState === "complete" &&
							item.aggregate.availableEpisodes !== null
								? `${item.aggregate.completedEpisodes}/${item.aggregate.availableEpisodes} episodes`
								: `${observedCount} observed ${observedCount === 1 ? "episode" : "episodes"}`}
						</span>
					</span>
					<ChevronDown
						aria-hidden="true"
						className="popup-watch-disclosure-icon"
						size={16}
					/>
				</button>
				<button
					aria-label={`Delete ${item.title}`}
					className="popup-watch-delete"
					title={`Delete ${item.title}`}
					disabled={
						busyAction ===
						deleteScopeKey({
							scope: "title",
							provider: item.provider,
							titleKey: item.titleKey,
						})
					}
					type="button"
					onClick={() =>
						onDelete({
							scope: "title",
							provider: item.provider,
							titleKey: item.titleKey,
						})
					}
				>
					<Trash2 aria-hidden="true" size={14} />
				</button>
			</div>
			{open ? (
				<div className="popup-watch-tree" id={bodyId}>
					{item.seasons.map((season, seasonIndex) => {
						const seasonKey = JSON.stringify([
							item.provider,
							item.titleKey,
							season.seasonKey,
						]);
						const initiallyOpenSeason = season.seasonKey === latestSeasonKey;
						const seasonOpen = disclosure.isOpen(
							seasonKey,
							initiallyOpenSeason,
						);
						const seasonBodyId = `${bodyId}-season-${seasonIndex}`;
						return (
							<section className="popup-season-group" key={season.seasonKey}>
								<button
									aria-label={`Toggle ${item.title} ${season.seasonTitle}`}
									aria-expanded={seasonOpen}
									aria-controls={seasonBodyId}
									className="popup-season-header"
									type="button"
									onClick={() =>
										disclosure.toggle(seasonKey, initiallyOpenSeason)
									}
								>
									<span className="popup-season-main">
										<strong className="popup-season-title">
											{season.seasonTitle}
										</strong>
										<span className="popup-season-meta">
											{season.episodes.length}{" "}
											{season.episodes.length === 1 ? "episode" : "episodes"}
											{item.episodePage.complete ? "" : " shown"}
										</span>
									</span>
									<ChevronDown
										aria-hidden="true"
										className="popup-watch-disclosure-icon"
										size={14}
									/>
								</button>
								{seasonOpen ? (
									<div className="popup-season-episode-list" id={seasonBodyId}>
										{season.episodes.map((episode) => {
											const pending = pendingByEpisode.get(
												pendingEpisodeKey(
													item.provider,
													item.titleKey,
													episode.episodeKey,
												),
											);
											const currentTime =
												pending?.currentTime ?? episode.currentTime;
											const progress = pending?.progress ?? episode.progress;
											const completed =
												Boolean(episode.completedAt) && !pending;
											return (
												<div
													className="popup-episode-row"
													key={episode.episodeKey}
													data-selected={
														episode.episodeKey ===
														item.latestActivity.episodeKey
													}
													data-completed={completed}
												>
													<span className="popup-episode-main">
														<span className="popup-episode-header">
															<span className="popup-episode-number">
																{episode.episodeNumber === null
																	? "Episode"
																	: `E${episode.episodeNumber}`}
															</span>
															<span className="popup-episode-title">
																{episode.episodeTitle}
															</span>
															{completed ? (
																<span className="popup-episode-complete">
																	<Check aria-hidden="true" size={13} />
																	<span className="popup-sr-only">Completed</span>
																</span>
															) : null}
														</span>
														<span className="popup-series-progress">
															<span className="popup-progress-track">
																<span
																	style={{
																		width: `${Math.round(progress * 100)}%`,
																	}}
																/>
															</span>
															<span>{formatClock(currentTime)}</span>
														</span>
														{episode.sessions
															.filter((session) => session.kind === "shared")
															.slice(0, 4)
															.map((session) => (
																<button
																	aria-label={`Create room from ${session.kind === "shared" ? "Shared" : "Solo"} session`}
																	className="popup-session-summary-action"
																	disabled={busyAction === `room:${session.id}`}
																	key={session.id}
																	type="button"
																	onClick={() =>
																		onCreateRoom(session, episode.sourceUrl)
																	}
																>
																	{session.kind === "shared"
																		? "Shared session"
																		: "Solo session"}
																</button>
															))}
														<button
															aria-label={`Delete ${episode.episodeTitle}`}
															className="popup-watch-delete popup-episode-delete"
															title={`Delete ${episode.episodeTitle}`}
															disabled={
																busyAction ===
																deleteScopeKey({
																	scope: "episode",
																	provider: item.provider,
																	titleKey: item.titleKey,
																	episodeKey: episode.episodeKey,
																})
															}
															type="button"
															onClick={() =>
																onDelete({
																	scope: "episode",
																	provider: item.provider,
																	titleKey: item.titleKey,
																	episodeKey: episode.episodeKey,
																})
															}
														>
															<Trash2 aria-hidden="true" size={13} />
														</button>
													</span>
												</div>
											);
										})}
									</div>
								) : null}
							</section>
						);
					})}
					{item.seasons.length === 0 ? (
						<div className="popup-episode-row">
							<span className="popup-episode-main">
								<span className="popup-episode-header">
									<span className="popup-episode-title">Latest activity</span>
								</span>
								<span className="popup-series-progress">
									<span className="popup-progress-track">
										<span
											style={{
												width: `${Math.round(
													(latestActivityPending?.progress ??
														item.latestActivity.progress) * 100,
												)}%`,
											}}
										/>
									</span>
									<span>
										{formatClock(
											latestActivityPending?.currentTime ??
												item.latestActivity.currentTime,
										)}
									</span>
								</span>
								{item.sessions
									.filter((session) => session.kind === "shared")
									.slice(0, 4)
									.map((session) => (
										<button
											aria-label={`Create room from ${session.kind === "shared" ? "Shared" : "Solo"} session`}
											className="popup-session-summary-action"
											disabled={busyAction === `room:${session.id}`}
											key={session.id}
											type="button"
											onClick={() => onCreateRoom(session, item.sourceUrl)}
										>
											{session.kind === "shared"
												? "Shared session"
												: "Solo session"}
										</button>
									))}
							</span>
						</div>
					) : null}
					{!item.episodePage.complete ? (
						<p className="popup-watch-slice-note">
							Recent episodes shown · Full history in your account
						</p>
					) : null}
				</div>
			) : null}
		</article>
	);
}

type PopupProviderGroup = {
  provider: WatchHistoryItem["provider"];
  label: string;
  items: WatchHistoryItem[];
};

function filterWatchHistoryItems(
  items: WatchHistoryItem[],
  mode: "mine" | "together",
  searchQuery: string,
  pendingByEpisode: Map<string, WatchProgressEvent>,
): WatchHistoryItem[] {
  const sessionKind = mode === "mine" ? "solo" : "shared";
  const query = searchQuery.trim().toLocaleLowerCase();

  return items.flatMap((item) => {
    const titleMatches = !query || item.title.toLocaleLowerCase().includes(query);
    const sessions = item.sessions.filter((session) => session.kind === sessionKind);
    const seasons = item.seasons.flatMap((season) => {
      const episodes = season.episodes.flatMap((episode) => {
        const episodeSessions = episode.sessions.filter((session) => session.kind === sessionKind);
        const hasPending = pendingByEpisode.has(
          pendingEpisodeKey(item.provider, item.titleKey, episode.episodeKey),
        );
        const belongsToMode = episodeSessions.length > 0 ||
          (mode === "mine" && episode.sessions.length === 0) ||
          hasPending;
        const matchesSearch = titleMatches || episode.episodeTitle.toLocaleLowerCase().includes(query);
        if (!belongsToMode || !matchesSearch) return [];
        const latestSession = newestSession(episodeSessions);
        return [{
          ...episode,
          currentTime: latestSession?.currentTime ?? episode.currentTime,
          duration: latestSession?.duration ?? episode.duration,
          progress: latestSession?.progress ?? episode.progress,
          lastWatchedAt: latestSession?.lastWatchedAt ?? episode.lastWatchedAt,
          sessions: episodeSessions,
        }];
      });
      return episodes.length ? [{ ...season, episodes }] : [];
    });

    if (seasons.length) return [{ ...item, seasons, sessions }];
    const latestPending = pendingByEpisode.has(
      pendingEpisodeKey(item.provider, item.titleKey, item.latestActivity.episodeKey),
    );
    if (item.seasons.length === 0 && titleMatches &&
      (sessions.length > 0 || (mode === "mine" && item.sessions.length === 0) || latestPending)) {
      const latestSession = newestSession(sessions);
      return [{
        ...item,
        latestActivity: latestSession ? {
          ...item.latestActivity,
          currentTime: latestSession.currentTime,
          duration: latestSession.duration,
          progress: latestSession.progress,
          lastWatchedAt: latestSession.lastWatchedAt,
        } : item.latestActivity,
        sessions,
      }];
    }
    return [];
  });
}

function projectPendingWatchHistoryItems(
  items: WatchHistoryItem[],
  pendingByEpisode: Map<string, WatchProgressEvent>,
  localObservation: WatchProgressEvent | null,
): WatchHistoryItem[] {
  let projected = items;
  const affectedTitles = new Set<string>();
  for (const event of pendingByEpisode.values()) {
    affectedTitles.add(pendingTitleKey(event.provider, event.titleKey));
    const itemIndex = projected.findIndex((item) =>
      item.provider === event.provider && item.titleKey === event.titleKey,
    );
    if (itemIndex < 0) {
      projected = [...projected, pendingWatchHistoryItem(event)];
      continue;
    }
    const item = projected[itemIndex];
    if (!item || item.seasons.some((season) =>
      season.episodes.some((episode) => episode.episodeKey === event.episodeKey)
    ) || (item.seasons.length === 0 && item.latestActivity.episodeKey === event.episodeKey)) {
      continue;
    }
    const seasonKey = event.seasonKey ?? event.episodeKey;
    const seasonIndex = item.seasons.findIndex((season) => season.seasonKey === seasonKey);
    const pendingEpisode = pendingWatchHistoryEpisode(event);
    const seasons = seasonIndex < 0
      ? [...item.seasons, pendingWatchHistorySeason(event, pendingEpisode)]
      : item.seasons.map((season, index) => index === seasonIndex
        ? { ...season, episodes: [...season.episodes, pendingEpisode] }
        : season);
    const nextItem: WatchHistoryItem = {
      ...item,
      observedEpisodeCount: Math.max(
        item.observedEpisodeCount,
        seasons.reduce((total, season) => total + season.episodes.length, 0),
      ),
      seasons,
      latestActivity: Date.parse(event.observedAt) >= Date.parse(item.latestActivity.lastWatchedAt)
        ? pendingWatchHistoryLatestActivity(event)
        : item.latestActivity,
      lastWatchedAt: Date.parse(event.observedAt) >= Date.parse(item.lastWatchedAt)
        ? event.observedAt
        : item.lastWatchedAt,
    };
    projected = projected.map((candidate, index) => index === itemIndex ? nextItem : candidate);
  }
  return projected.map((item) => affectedTitles.has(pendingTitleKey(item.provider, item.titleKey))
    ? boundProjectedWatchHistoryItem(item, localObservation)
    : item);
}

function boundProjectedWatchHistoryItem(
  item: WatchHistoryItem,
  localObservation: WatchProgressEvent | null,
): WatchHistoryItem {
  if (item.seasons.length === 0) return item;
  const episodes = item.seasons
    .flatMap((season) => season.episodes)
    .sort(compareWatchHistoryEpisodesNewest);
  let selected = episodes.slice(0, WATCH_HISTORY_TITLE_EPISODE_SLICE_LIMIT);
  const localEpisodeKey = localObservation?.provider === item.provider &&
      localObservation.titleKey === item.titleKey
    ? localObservation.episodeKey
    : null;
  const localEpisode = localEpisodeKey
    ? episodes.find((episode) => episode.episodeKey === localEpisodeKey)
    : undefined;
  if (localEpisode && !selected.some((episode) => episode.episodeKey === localEpisode.episodeKey)) {
    selected = [
      ...selected.slice(0, WATCH_HISTORY_TITLE_EPISODE_SLICE_LIMIT - 1),
      localEpisode,
    ].sort(compareWatchHistoryEpisodesNewest);
  }
  const selectedKeys = new Set(selected.map((episode) => episode.episodeKey));
  const seasons = item.seasons
    .map((season) => ({
      ...season,
      episodes: season.episodes
        .filter((episode) => selectedKeys.has(episode.episodeKey))
        .sort(compareWatchHistoryEpisodesNewest),
    }))
    .filter((season) => season.episodes.length > 0)
    .sort(compareWatchHistorySeasonsNewest)
    .map((season, order) => ({ ...season, order }));
  const observedEpisodeCount = Math.max(item.observedEpisodeCount, episodes.length);
  const representedEpisodeCount = selected.length;
  const incomplete = !item.episodePage.complete || observedEpisodeCount > representedEpisodeCount;
  return {
    ...item,
    observedEpisodeCount,
    episodePage: incomplete
      ? {
          complete: false,
          nextCursor: item.episodePage.nextCursor ?? LOCAL_CACHE_REFRESH_CURSOR,
        }
      : { complete: true, nextCursor: null },
    seasons,
  };
}

function compareWatchHistoryEpisodesNewest(
  a: WatchHistoryItem["seasons"][number]["episodes"][number],
  b: WatchHistoryItem["seasons"][number]["episodes"][number],
): number {
  return compareCodeUnits(b.lastWatchedAt, a.lastWatchedAt) ||
    compareCodeUnits(a.episodeKey, b.episodeKey);
}

function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function compareWatchHistorySeasonsNewest(
  a: { episodes: WatchHistoryItem["seasons"][number]["episodes"] },
  b: { episodes: WatchHistoryItem["seasons"][number]["episodes"] },
): number {
  const aNewest = a.episodes[0];
  const bNewest = b.episodes[0];
  if (!aNewest) return bNewest ? 1 : 0;
  if (!bNewest) return -1;
  return compareWatchHistoryEpisodesNewest(aNewest, bNewest);
}

function pendingWatchHistoryItem(event: WatchProgressEvent): WatchHistoryItem {
  return {
    provider: event.provider,
    titleKey: event.titleKey,
    observedEpisodeCount: 1,
    completedEpisodeCount: 0,
    episodePage: { complete: true, nextCursor: null },
    itemKind: event.itemKind,
    title: event.title,
    sourceUrl: event.sourceUrl,
    artworkUrl: event.artworkUrl,
    catalogState: "unavailable",
    aggregate: unknownWatchHistoryAggregate(),
    seasons: event.itemKind === "series"
      ? [pendingWatchHistorySeason(event, pendingWatchHistoryEpisode(event))]
      : [],
    sessions: [],
    latestActivity: pendingWatchHistoryLatestActivity(event),
    lastWatchedAt: event.observedAt,
  };
}

function pendingWatchHistorySeason(
  event: WatchProgressEvent,
  episode: WatchHistoryItem["seasons"][number]["episodes"][number],
): WatchHistoryItem["seasons"][number] {
  return {
    seasonKey: event.seasonKey ?? event.episodeKey,
    seasonTitle: event.seasonTitle ?? "Observed episodes",
    seasonNumber: event.seasonNumber,
    order: 0,
    aggregate: unknownWatchHistoryAggregate(),
    episodes: [episode],
    nextEpisode: null,
  };
}

function pendingWatchHistoryEpisode(
  event: WatchProgressEvent,
): WatchHistoryItem["seasons"][number]["episodes"][number] {
  return {
    episodeKey: event.episodeKey,
    episodeTitle: event.episodeTitle,
    seasonKey: event.seasonKey,
    seasonTitle: event.seasonTitle,
    seasonNumber: event.seasonNumber,
    episodeNumber: event.episodeNumber,
    sourceUrl: event.sourceUrl,
    currentTime: event.currentTime,
    duration: event.duration,
    progress: event.progress,
    completedAt: null,
    lastWatchedAt: event.observedAt,
    sessions: [],
  };
}

function pendingWatchHistoryLatestActivity(
  event: WatchProgressEvent,
): WatchHistoryItem["latestActivity"] {
  return {
    episodeKey: event.episodeKey,
    currentTime: event.currentTime,
    duration: event.duration,
    progress: event.progress,
    completedAt: null,
    lastWatchedAt: event.observedAt,
  };
}

function unknownWatchHistoryAggregate(): WatchHistoryItem["aggregate"] {
  return { completedEpisodes: 0, availableEpisodes: null, progress: null };
}

function newestSession(sessions: WatchHistorySession[]): WatchHistorySession | undefined {
  return sessions.reduce<WatchHistorySession | undefined>((latest, session) =>
    !latest || Date.parse(session.lastWatchedAt) > Date.parse(latest.lastWatchedAt)
      ? session
      : latest,
  undefined);
}

function groupWatchHistoryItems(items: WatchHistoryItem[]): PopupProviderGroup[] {
  const groups = new Map<WatchHistoryItem["provider"], PopupProviderGroup>();
  for (const item of items) {
    const current = groups.get(item.provider);
    if (current) {
      current.items.push(item);
      continue;
    }
    groups.set(item.provider, {
      provider: item.provider,
      label: providerLabel(item.provider),
      items: [item],
    });
  }
  return [...groups.values()];
}

function providerLabel(provider: WatchHistoryItem["provider"]): string {
  if (provider === "crunchyroll") return "Crunchyroll";
  if (provider === "youtube") return "YouTube";
  return provider;
}

function ProviderLogo({ label, provider }: { label: string; provider: string }) {
  if (provider === "crunchyroll") {
    return (
      <span aria-hidden="true" className="resource-provider-logo crunchyroll">
        <svg viewBox="0 0 24 24">
          <title>{label}</title>
          <path
            d="M2.909 13.436C2.914 7.61 7.642 2.893 13.468 2.898c5.576.005 10.137 4.339 10.51 9.819q.021-.351.022-.706C24.007 5.385 18.64.006 12.012 0S.007 5.36 0 11.988 5.36 23.994 11.988 24q.412 0 .815-.027c-5.526-.338-9.9-4.928-9.894-10.538Zm16.284.155a4.1 4.1 0 0 1-4.095-4.103 4.1 4.1 0 0 1 2.712-3.855 8.95 8.95 0 0 0-4.187-1.037 9.007 9.007 0 1 0 8.997 9.016q-.001-.847-.15-1.651a4.1 4.1 0 0 1-3.278 1.63Z"
            fill="currentColor"
          />
        </svg>
      </span>
    );
  }
  if (provider === "youtube") {
    return (
      <span aria-hidden="true" className="resource-provider-logo youtube">
        <svg viewBox="0 0 32 32">
          <title>{label}</title>
          <path
            d="M28.2 9.1a3.8 3.8 0 0 0-2.7-2.7C23.1 5.8 16 5.8 16 5.8s-7.1 0-9.5.6a3.8 3.8 0 0 0-2.7 2.7C3.2 11.5 3.2 16 3.2 16s0 4.5.6 6.9a3.8 3.8 0 0 0 2.7 2.7c2.4.6 9.5.6 9.5.6s7.1 0 9.5-.6a3.8 3.8 0 0 0 2.7-2.7c.6-2.4.6-6.9.6-6.9s0-4.5-.6-6.9Z"
            fill="currentColor"
          />
          <path d="m13.4 20.4 7-4.4-7-4.4v8.8Z" fill="#fff" />
        </svg>
      </span>
    );
  }
  return (
    <span aria-hidden="true" className={`resource-provider-logo ${provider}`}>
      <span className="resource-provider-fallback">{label.slice(0, 1)}</span>
    </span>
  );
}

export async function loadConfirmedPopupWatchHistorySnapshot(
  ownerUserId: string,
): Promise<PopupWatchHistorySnapshot | null> {
  const root = await createWatchHistoryStorage().readRoot();
  return selectConfirmedPopupWatchHistorySnapshot(root, ownerUserId);
}

function subscribeToPopupWatchHistorySnapshot(
  ownerUserId: string,
  listener: (snapshot: PopupWatchHistorySnapshot | null) => void,
): () => void {
  let disposed = false;
  let sequence = 0;
  const handleStorageChange = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ) => {
    if (areaName !== "local" || !changes[WATCH_HISTORY_STORAGE_KEY]) return;
    const currentSequence = ++sequence;
    void loadConfirmedPopupWatchHistorySnapshot(ownerUserId)
      .then((snapshot) => {
        if (!disposed && currentSequence === sequence) listener(snapshot);
      })
      .catch(() => undefined);
  };
  chrome.storage.onChanged.addListener(handleStorageChange);
  return () => {
    disposed = true;
    sequence += 1;
    chrome.storage.onChanged.removeListener(handleStorageChange);
  };
}

export function selectConfirmedPopupWatchHistorySnapshot(
  root: WatchHistoryStorageRoot,
  ownerUserId: string,
): PopupWatchHistorySnapshot | null {
  const accountGeneration = root.activeGenerations?.[ownerUserId];
  if (accountGeneration === undefined) return null;
  const partition = root.partitions[watchHistoryPartitionKey(ownerUserId, accountGeneration)];
  if (!partition ||
    partition.ownerUserId !== ownerUserId ||
    partition.accountGeneration !== accountGeneration ||
    partition.preferencesConfirmed !== true) {
    return null;
  }
  const history = normalizeCachedWatchHistoryResponse(partition.cache);
  if (!history ||
    history.meta.ownerUserId !== ownerUserId ||
    history.meta.accountGeneration !== accountGeneration) {
    return null;
  }
  const pendingEvents = new Map<string, WatchProgressEvent>();
  let localObservation: PopupWatchHistoryLocalObservation | null = null;
  if (partition.currentObservation) {
    const current = WatchProgressEventSchema.safeParse(partition.currentObservation);
    if (current.success &&
      current.data.accountGeneration === accountGeneration &&
      isNewerThanCanonicalHistory(history, current.data)) {
      const displayMode = partition.currentObservationDisplayMode === "mine" ||
          partition.currentObservationDisplayMode === "together"
        ? partition.currentObservationDisplayMode
        : partition.currentObservationMeaningfulSolo === true
          ? "mine"
          : null;
      if (displayMode) localObservation = { event: current.data, mode: displayMode };
      if (partition.currentObservationMeaningfulSolo === true && !current.data.sharedRoom) {
        pendingEvents.set(current.data.clientEventId, current.data);
      }
    }
  }
  for (const entry of partition.outbox.entries) {
    const pending = WatchProgressEventSchema.safeParse(entry.event);
    if (pending.success && pending.data.accountGeneration === accountGeneration) {
      pendingEvents.set(pending.data.clientEventId, pending.data);
    }
  }
  return {
    history,
    accountGeneration,
    preferences: partition.preferences ?? { youtubeHistoryEnabled: false },
    pendingEvents: [...pendingEvents.values()],
    localObservation,
    capturePaused: partition.capturePaused === true,
  };
}

function normalizeCachedWatchHistoryResponse(value: unknown): WatchHistoryResponse | null {
  const current = WatchHistoryResponseSchema.safeParse(value);
  if (current.success) return current.data;
  if (!isPopupRecord(value) || !Array.isArray(value.items)) return null;
  const items: unknown[] = [];
  for (const item of value.items) {
    const normalized = normalizeLegacyCachedWatchHistoryItem(item);
    if (!normalized) return null;
    items.push(normalized);
  }
  const normalized = WatchHistoryResponseSchema.safeParse({ ...value, items });
  return normalized.success ? normalized.data : null;
}

function normalizeLegacyCachedWatchHistoryItem(value: unknown): unknown | null {
  if (!isPopupRecord(value) ||
    Object.hasOwn(value, "observedEpisodeCount") ||
    Object.hasOwn(value, "completedEpisodeCount") ||
    Object.hasOwn(value, "episodePage") ||
    !Array.isArray(value.seasons)) {
    return null;
  }
  type ParsedEpisode = ReturnType<typeof WatchHistoryEpisodeSchema.parse>;
  const episodesByKey = new Map<string, ParsedEpisode>();
  const parsedSeasons: Array<{
    source: Record<string, unknown>;
    episodes: ParsedEpisode[];
  }> = [];
  for (const season of value.seasons) {
    if (!isPopupRecord(season) || !Array.isArray(season.episodes)) return null;
    const episodes: ParsedEpisode[] = [];
    for (const episodeValue of season.episodes) {
      const episode = WatchHistoryEpisodeSchema.safeParse(episodeValue);
      if (!episode.success || episodesByKey.has(episode.data.episodeKey)) return null;
      episodesByKey.set(episode.data.episodeKey, episode.data);
      episodes.push(episode.data);
    }
    parsedSeasons.push({ source: season, episodes });
  }
  const allEpisodes = [...episodesByKey.values()].sort(compareWatchHistoryEpisodesNewest);
  const selected = allEpisodes.slice(0, WATCH_HISTORY_TITLE_EPISODE_SLICE_LIMIT);
  const selectedKeys = new Set(selected.map((episode) => episode.episodeKey));
  const seasons = parsedSeasons
    .map(({ source, episodes }) => {
      const visibleEpisodes = episodes
        .filter((episode) => selectedKeys.has(episode.episodeKey))
        .sort(compareWatchHistoryEpisodesNewest);
      return {
        ...source,
        aggregate: {
          completedEpisodes: visibleEpisodes.filter((episode) => episode.completedAt !== null).length,
          availableEpisodes: null,
          progress: null,
        },
        episodes: visibleEpisodes,
        nextEpisode: null,
      };
    })
    .filter((season) => season.episodes.length > 0)
    .sort(compareWatchHistorySeasonsNewest)
    .map((season, order) => ({ ...season, order }));
  const isMovie = value.itemKind === "movie";
  const latestActivity = isPopupRecord(value.latestActivity) ? value.latestActivity : null;
  const observedEpisodeCount = isMovie ? 1 : allEpisodes.length;
  const completedEpisodeCount = isMovie
    ? latestActivity?.completedAt ? 1 : 0
    : allEpisodes.filter((episode) => episode.completedAt !== null).length;
  const complete = isMovie || observedEpisodeCount <= WATCH_HISTORY_TITLE_EPISODE_SLICE_LIMIT;
  return {
    ...value,
    observedEpisodeCount,
    completedEpisodeCount,
    episodePage: {
      complete,
      nextCursor: complete ? null : LOCAL_CACHE_REFRESH_CURSOR,
    },
    catalogState: "unavailable",
    aggregate: {
      completedEpisodes: completedEpisodeCount,
      availableEpisodes: null,
      progress: null,
    },
    seasons,
  };
}

function isPopupRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNewerThanCanonicalHistory(
  history: WatchHistoryResponse,
  event: WatchProgressEvent,
): boolean {
  const item = history.items.find((candidate) =>
    candidate.provider === event.provider && candidate.titleKey === event.titleKey,
  );
  if (!item) return true;
  const episode = item.seasons
    .flatMap((season) => season.episodes)
    .find((candidate) => candidate.episodeKey === event.episodeKey);
  const canonicalObservedAt = episode?.lastWatchedAt ??
    (item.latestActivity.episodeKey === event.episodeKey
      ? item.latestActivity.lastWatchedAt
      : null);
  return canonicalObservedAt === null ||
    Date.parse(event.observedAt) > Date.parse(canonicalObservedAt);
}

function latestPendingByEpisode(events: WatchProgressEvent[]): Map<string, WatchProgressEvent> {
  const pending = new Map<string, WatchProgressEvent>();
  for (const event of events) {
    const key = pendingEpisodeKey(event.provider, event.titleKey, event.episodeKey);
    const current = pending.get(key);
    if (!current || Date.parse(event.observedAt) >= Date.parse(current.observedAt)) {
      pending.set(key, event);
    }
  }
  return pending;
}

function reconcilePopupPendingEvents(
  current: WatchProgressEvent[],
  snapshot: PopupWatchHistorySnapshot,
): WatchProgressEvent[] {
  const pending = new Map<string, WatchProgressEvent>();
  for (const event of [...current, ...snapshot.pendingEvents]) {
    if (event.accountGeneration !== snapshot.accountGeneration ||
      canonicalHistoryIncludesEvent(snapshot.history, event)) {
      continue;
    }
    const key = `${pendingEpisodeKey(event.provider, event.titleKey, event.episodeKey)}\u0000${
      event.sharedRoom ? "shared" : "solo"
    }`;
    const previous = pending.get(key);
    if (!previous || Date.parse(event.observedAt) > Date.parse(previous.observedAt) ||
      (event.observedAt === previous.observedAt && event.clientEventId > previous.clientEventId)) {
      pending.set(key, event);
    }
  }
  return [...pending.values()];
}

function canonicalHistoryIncludesEvent(
  history: WatchHistoryResponse,
  event: WatchProgressEvent,
): boolean {
  const item = history.items.find((candidate) =>
    candidate.provider === event.provider && candidate.titleKey === event.titleKey,
  );
  if (!item) return false;
  const episode = item.seasons
    .flatMap((season) => season.episodes)
    .find((candidate) => candidate.episodeKey === event.episodeKey);
  const canonicalObservedAt = episode?.lastWatchedAt ??
    (item.latestActivity.episodeKey === event.episodeKey
      ? item.latestActivity.lastWatchedAt
      : null);
  return canonicalObservedAt !== null &&
    Date.parse(canonicalObservedAt) >= Date.parse(event.observedAt);
}

function pendingEpisodeKey(provider: string, titleKey: string, episodeKey: string): string {
  return `${provider}\u0000${titleKey}\u0000${episodeKey}`;
}

function pendingTitleKey(provider: string, titleKey: string): string {
  return `${provider}\u0000${titleKey}`;
}

function formatClock(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value / 3_600);
  const minutes = Math.floor((value % 3_600) / 60);
  const rest = value % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
    : `${minutes}:${String(rest).padStart(2, "0")}`;
}

function messageForStatus(status: string): string {
  if (status === "storage-full") return "Browser storage is full.";
  if (status === "unauthenticated") return "Sign in to sync watch history.";
  return "Could not refresh watch history.";
}

function deleteScopeKey(target: WatchHistoryDeleteScope): string {
  if (target.scope === "all") return "delete:all";
  if (target.scope === "title") return `delete:${target.provider}:${target.titleKey}`;
  return `delete:${target.provider}:${target.titleKey}:${target.episodeKey}`;
}

function removeHistoryTarget(
  history: WatchHistoryResponse,
  target: WatchHistoryDeleteScope,
  accountGeneration = history.meta.accountGeneration,
): WatchHistoryResponse {
  if (target.scope === "all") {
    return {
      ...history,
      meta: { ...history.meta, accountGeneration },
      items: [],
      totalTitleCount: 0,
      nextCursor: null,
    };
  }
  if (target.scope === "title") {
    const items = history.items.filter((item) =>
      item.provider !== target.provider || item.titleKey !== target.titleKey,
    );
    return {
      ...history,
      meta: { ...history.meta, accountGeneration },
      items,
      totalTitleCount: Math.max(0, history.totalTitleCount - 1),
    };
  }
  const items = history.items.flatMap((item) => {
    if (item.provider !== target.provider || item.titleKey !== target.titleKey) return [item];
    const removedEpisode = item.seasons
      .flatMap((season) => season.episodes)
      .find((episode) => episode.episodeKey === target.episodeKey);
    const seasons = item.seasons
      .map((season) => ({
        ...season,
        episodes: season.episodes.filter((episode) => episode.episodeKey !== target.episodeKey),
      }))
      .filter((season) => season.episodes.length > 0);
    const observedEpisodeCount = Math.max(
      0,
      item.observedEpisodeCount - (removedEpisode ? 1 : 0),
    );
    if (observedEpisodeCount === 0) return [];
    const completedEpisodeCount = Math.max(
      0,
      item.completedEpisodeCount - (removedEpisode?.completedAt ? 1 : 0),
    );
    return [{
      ...item,
      observedEpisodeCount,
      completedEpisodeCount,
      aggregate: { ...item.aggregate, completedEpisodes: completedEpisodeCount },
      seasons,
    }];
  });
  return {
    ...history,
    meta: { ...history.meta, accountGeneration },
    items,
    totalTitleCount: items.length === history.items.length
      ? history.totalTitleCount
      : Math.max(0, history.totalTitleCount - 1),
  };
}

function withRoomHash(sourceUrl: string, roomId: string): string {
  try {
    const url = new URL(sourceUrl);
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    hash.set("anidachiRoom", roomId);
    url.hash = hash.toString();
    return url.toString();
  } catch {
    return sourceUrl;
  }
}

function eventMatchesScope(event: WatchProgressEvent, target: WatchHistoryDeleteScope): boolean {
  if (target.scope === "all") return true;
  if (event.provider !== target.provider || event.titleKey !== target.titleKey) return false;
  return target.scope === "title" || event.episodeKey === target.episodeKey;
}
