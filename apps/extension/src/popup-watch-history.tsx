import {
  WatchHistoryDeletionAckSchema,
  type WatchHistoryDeleteScope,
  WatchHistoryPreferencesResponseSchema,
  WatchHistoryResponseSchema,
  WatchHistoryRoomRecreationResponseSchema,
  type WatchHistoryItem,
  type WatchHistoryPreferences,
  type WatchHistoryResponse,
  type WatchHistorySession,
  type WatchProgressEvent,
} from "@anidachi/protocol";
import { RefreshCw, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createListWatchHistoryMessage,
  createWatchHistoryMessage,
  requestWatchHistory,
  type WatchHistoryMessage,
  type WatchHistoryMessageResponse,
} from "./watch-history-client";
import { createWatchHistoryStorage, watchHistoryPartitionKey } from "./watch-history-storage";

export type PopupWatchHistorySnapshot = {
  history: WatchHistoryResponse;
  accountGeneration: number;
  preferences: WatchHistoryPreferences;
  pendingEvents: WatchProgressEvent[];
  capturePaused: boolean;
};

export type PopupWatchHistoryClient = {
  loadCached(ownerUserId: string): Promise<PopupWatchHistorySnapshot | null>;
  request(message: WatchHistoryMessage): Promise<WatchHistoryMessageResponse>;
  confirmDiscard(message: string): boolean;
  openUrl(url: string): Promise<void>;
};

const defaultClient: PopupWatchHistoryClient = {
  loadCached: loadConfirmedPopupWatchHistorySnapshot,
  request: requestWatchHistory,
  confirmDiscard: (message) => window.confirm(message),
  openUrl: async (url) => {
    await chrome.tabs.create({ url });
  },
};

export function PopupWatchHistoryPanel({
  ownerUserId,
  client = defaultClient,
  onTitleCountChange,
}: {
  ownerUserId: string | null;
  client?: PopupWatchHistoryClient;
  onTitleCountChange?: (count: number) => void;
}) {
  const [history, setHistory] = useState<WatchHistoryResponse | null>(null);
  const [pendingEvents, setPendingEvents] = useState<WatchProgressEvent[]>([]);
  const [capturePaused, setCapturePaused] = useState(false);
  const [preferences, setPreferences] = useState<WatchHistoryPreferences>({
    youtubeHistoryEnabled: false,
  });
  const [preferencesConfirmed, setPreferencesConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [oldOwnerPending, setOldOwnerPending] = useState(false);
  const [mode, setMode] = useState<"mine" | "together">("mine");
  const [searchQuery, setSearchQuery] = useState("");
  const requestGeneration = useRef(0);

  useEffect(() => {
    onTitleCountChange?.(history?.totalTitleCount ?? 0);
  }, [history?.totalTitleCount, onTitleCountChange]);

  useEffect(() => {
    const generation = ++requestGeneration.current;
    const current = () => requestGeneration.current === generation;
    setHistory(null);
    setPendingEvents([]);
    setCapturePaused(false);
    setPreferences({ youtubeHistoryEnabled: false });
    setPreferencesConfirmed(false);
    setError(null);
    setBusyAction(null);
    setOldOwnerPending(false);
    setMode("mine");
    setSearchQuery("");
    if (!ownerUserId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    void (async () => {
      const cached = await client.loadCached(ownerUserId).catch(() => null);
      if (!current()) return;
      if (cached) {
        setHistory(cached.history);
        setPendingEvents(cached.pendingEvents);
        setCapturePaused(cached.capturePaused);
      }

      const [historyResponse, preferencesResponse, oldOwnerResponse] = await Promise.all([
        client.request(createListWatchHistoryMessage({ limit: 100 })),
        client.request(createWatchHistoryMessage({
          type: "ANIDACHI_WATCH_HISTORY_V2",
          command: "get-preferences",
        })),
        client.request(createWatchHistoryMessage({
          type: "ANIDACHI_WATCH_HISTORY_V2",
          command: "other-owner-pending",
        })),
      ]);
      if (!current()) return;

      if (historyResponse.ok) {
        const parsed = WatchHistoryResponseSchema.safeParse(historyResponse.data);
        if (parsed.success && parsed.data.meta.ownerUserId === ownerUserId) {
          setHistory(parsed.data);
          setPendingEvents([]);
        } else {
          setError("Could not validate watch history.");
        }
      } else if (!cached) {
        setError(messageForStatus(historyResponse.status));
      }

      if (preferencesResponse.ok) {
        const parsed = WatchHistoryPreferencesResponseSchema.safeParse(preferencesResponse.data);
        if (parsed.success && parsed.data.meta.ownerUserId === ownerUserId) {
          setPreferences(parsed.data.preferences);
          setPreferencesConfirmed(true);
        }
      }
      if (oldOwnerResponse.ok) {
        setOldOwnerPending(oldOwnerResponse.hasPendingWork === true);
      }
      setLoading(false);
    })();

    return () => {
      if (requestGeneration.current === generation) requestGeneration.current += 1;
    };
  }, [client, ownerUserId]);

  const pendingByEpisode = useMemo(() => latestPendingByEpisode(pendingEvents), [pendingEvents]);
  const visibleItems = useMemo(
    () => filterWatchHistoryItems(history?.items ?? [], mode, searchQuery),
    [history?.items, mode, searchQuery],
  );
  const providerGroups = useMemo(() => groupWatchHistoryItems(visibleItems), [visibleItems]);

  const updateYoutubePreference = async () => {
    if (!ownerUserId || !preferencesConfirmed || busyAction) return;
    const expectedGeneration = requestGeneration.current;
    setBusyAction("preferences");
    setError(null);
    const response = await client.request(createWatchHistoryMessage({
      type: "ANIDACHI_WATCH_HISTORY_V2",
      command: "update-preferences",
      input: { youtubeHistoryEnabled: !preferences.youtubeHistoryEnabled },
    }));
    if (requestGeneration.current !== expectedGeneration) return;
    if (response.ok) {
      const parsed = WatchHistoryPreferencesResponseSchema.safeParse(response.data);
      if (parsed.success && parsed.data.meta.ownerUserId === ownerUserId) {
        setPreferences(parsed.data.preferences);
        setPreferencesConfirmed(true);
      } else {
        setError("Could not validate history preferences.");
      }
    } else {
      setError(messageForStatus(response.status));
    }
    setBusyAction(null);
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
        <label className="popup-watch-search">
          <Search aria-hidden="true" size={13} />
          <input
            aria-label="Search watch history"
            placeholder="Search"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.currentTarget.value)}
          />
          {searchQuery ? (
            <button
              aria-label="Clear watch history search"
              type="button"
              onClick={() => setSearchQuery("")}
            >
              <X size={12} />
            </button>
          ) : null}
        </label>
        <span aria-hidden="true" className="popup-watch-controls-spacer" />
      </div>
      <div className="popup-watch-preferences">
        <button
          aria-label="Track YouTube history"
          aria-pressed={preferencesConfirmed && preferences.youtubeHistoryEnabled}
          disabled={!preferencesConfirmed}
          type="button"
          onClick={() => void updateYoutubePreference()}
        >
          <span>Track YouTube history</span>
          <span>{preferencesConfirmed && preferences.youtubeHistoryEnabled ? "On" : "Off"}</span>
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
          <span>Syncing watch history...</span>
        </div>
      ) : providerGroups.length ? (
        <div className="popup-resource-list">
          {providerGroups.map((group) => (
            <section className="popup-provider" data-provider={group.provider} key={group.provider}>
              <div className="popup-provider-row">
                <ProviderLogo label={group.label} provider={group.provider} />
                <span className="popup-provider-main">
                  <strong className="popup-provider-name">{group.label}</strong>
                  <span className="popup-provider-meta">
                    {group.items.length} {group.items.length === 1 ? "title" : "titles"}
                  </span>
                </span>
                <span aria-hidden="true" className="popup-provider-chevron" />
              </div>
              <div className="popup-provider-body">
                {group.items.map((item) => (
                  <PopupWatchHistoryItem
                    item={item}
                    key={`${item.provider}:${item.titleKey}`}
                    busyAction={busyAction}
                    onCreateRoom={createRoom}
                    onDelete={deleteTarget}
                    pendingByEpisode={pendingByEpisode}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : history?.items.length && searchQuery.trim() ? (
        <div className="popup-empty">No titles match your search.</div>
      ) : history?.items.length ? (
        <div className="popup-empty">
          {mode === "together"
            ? "Shared sessions will appear after watching together."
            : "Solo sessions will appear after meaningful playback."}
        </div>
      ) : (
        <div className="popup-empty">Progress will appear after meaningful playback.</div>
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

function PopupWatchHistoryItem({
  busyAction,
  item,
  onCreateRoom,
  onDelete,
  pendingByEpisode,
}: {
  busyAction: string | null;
  item: WatchHistoryItem;
  onCreateRoom: (session: WatchHistorySession, sourceUrl: string) => void;
  onDelete: (target: WatchHistoryDeleteScope) => void;
  pendingByEpisode: Map<string, WatchProgressEvent>;
}) {
  const episodeCount = item.seasons.reduce((sum, season) => sum + season.episodes.length, 0);
  const observedCount = episodeCount || (item.itemKind === "movie" ? 1 : 0);
  return (
    <article className="popup-watch-item" data-kind={item.itemKind} data-provider={item.provider}>
      <div className="popup-watch-row">
        <span className="popup-watch-artwork" data-has-artwork={Boolean(item.artworkUrl)}>
          {item.artworkUrl ? <img alt="" src={item.artworkUrl} /> : item.title.slice(0, 1)}
        </span>
        <span className="popup-watch-main">
          <strong className="popup-watch-title">{item.title}</strong>
          <span className="popup-watch-meta">
            {item.catalogState === "complete" && item.aggregate.availableEpisodes !== null
              ? `${item.aggregate.completedEpisodes}/${item.aggregate.availableEpisodes} episodes`
              : `${observedCount} observed ${observedCount === 1 ? "episode" : "episodes"}`}
          </span>
        </span>
        <button
          aria-label={`Delete ${item.title}`}
          className="popup-watch-chevron"
          disabled={busyAction === deleteScopeKey({
            scope: "title",
            provider: item.provider,
            titleKey: item.titleKey,
          })}
          type="button"
          onClick={() => onDelete({
            scope: "title",
            provider: item.provider,
            titleKey: item.titleKey,
          })}
        >
          <X aria-hidden="true" size={14} />
        </button>
      </div>
      {item.seasons.map((season) => (
        <section className="popup-season-group" key={season.seasonKey}>
          <div className="popup-season-header">
            <span className="popup-season-main">
              <strong className="popup-season-title">{season.seasonTitle}</strong>
              <span className="popup-season-meta">
                {season.episodes.length} {season.episodes.length === 1 ? "episode" : "episodes"}
              </span>
            </span>
          </div>
          <div className="popup-season-episode-list">
            {season.episodes.map((episode) => {
              const pending = pendingByEpisode.get(
                pendingEpisodeKey(item.provider, item.titleKey, episode.episodeKey),
              );
              const currentTime = pending?.currentTime ?? episode.currentTime;
              const progress = pending?.progress ?? episode.progress;
              return (
                <div className="popup-episode-row" key={episode.episodeKey}>
                  <span className="popup-episode-main">
                    <span className="popup-episode-header">
                      <span className="popup-episode-number">
                        {episode.episodeNumber === null ? "Episode" : `E${episode.episodeNumber}`}
                      </span>
                      <span className="popup-episode-title">{episode.episodeTitle}</span>
                    </span>
                    <span className="popup-series-progress">
                      <span className="popup-progress-track">
                        <span style={{ width: `${Math.round(progress * 100)}%` }} />
                      </span>
                      <span>{formatClock(currentTime)}</span>
                    </span>
                    {pending ? <span className="popup-mode-badge">Pending sync</span> : null}
                    {episode.sessions.slice(0, 4).map((session) => (
                      <button
                        aria-label={`Create room from ${session.kind === "shared" ? "Shared" : "Solo"} session`}
                        className="popup-session-summary-action"
                        disabled={busyAction === `room:${session.id}`}
                        key={session.id}
                        type="button"
                        onClick={() => onCreateRoom(session, episode.sourceUrl)}
                      >
                        {session.kind === "shared" ? "Shared session" : "Solo session"}
                      </button>
                    ))}
                    <button
                      aria-label={`Delete ${episode.episodeTitle}`}
                      className="popup-quiet-danger"
                      disabled={busyAction === deleteScopeKey({
                        scope: "episode",
                        provider: item.provider,
                        titleKey: item.titleKey,
                        episodeKey: episode.episodeKey,
                      })}
                      type="button"
                      onClick={() => onDelete({
                        scope: "episode",
                        provider: item.provider,
                        titleKey: item.titleKey,
                        episodeKey: episode.episodeKey,
                      })}
                    >
                      Delete
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {item.seasons.length === 0 ? (
        <div className="popup-episode-row">
          <span className="popup-episode-main">
            <span className="popup-episode-header">
              <span className="popup-episode-title">Latest activity</span>
            </span>
            <span className="popup-series-progress">
              <span className="popup-progress-track">
                <span style={{ width: `${Math.round(item.latestActivity.progress * 100)}%` }} />
              </span>
              <span>{formatClock(item.latestActivity.currentTime)}</span>
            </span>
            {item.sessions.slice(0, 4).map((session) => (
              <button
                aria-label={`Create room from ${session.kind === "shared" ? "Shared" : "Solo"} session`}
                className="popup-session-summary-action"
                disabled={busyAction === `room:${session.id}`}
                key={session.id}
                type="button"
                onClick={() => onCreateRoom(session, item.sourceUrl)}
              >
                {session.kind === "shared" ? "Shared session" : "Solo session"}
              </button>
            ))}
          </span>
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
): WatchHistoryItem[] {
  const sessionKind = mode === "mine" ? "solo" : "shared";
  const query = searchQuery.trim().toLocaleLowerCase();

  return items.flatMap((item) => {
    const titleMatches = !query || item.title.toLocaleLowerCase().includes(query);
    const sessions = item.sessions.filter((session) => session.kind === sessionKind);
    const seasons = item.seasons.flatMap((season) => {
      const episodes = season.episodes.filter((episode) =>
        episode.sessions.some((session) => session.kind === sessionKind) &&
        (titleMatches || episode.episodeTitle.toLocaleLowerCase().includes(query)),
      );
      return episodes.length ? [{ ...season, episodes }] : [];
    });

    if (seasons.length) return [{ ...item, seasons, sessions }];
    if (item.seasons.length === 0 && sessions.length && titleMatches) {
      return [{ ...item, sessions }];
    }
    return [];
  });
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
  const accountGeneration = root.activeGenerations?.[ownerUserId];
  if (accountGeneration === undefined) return null;
  const partition = root.partitions[watchHistoryPartitionKey(ownerUserId, accountGeneration)];
  if (!partition ||
    partition.ownerUserId !== ownerUserId ||
    partition.accountGeneration !== accountGeneration ||
    partition.preferencesConfirmed !== true) {
    return null;
  }
  const history = WatchHistoryResponseSchema.safeParse(partition.cache);
  if (!history.success ||
    history.data.meta.ownerUserId !== ownerUserId ||
    history.data.meta.accountGeneration !== accountGeneration) {
    return null;
  }
  return {
    history: history.data,
    accountGeneration,
    preferences: partition.preferences ?? { youtubeHistoryEnabled: false },
    pendingEvents: partition.outbox.entries.map((entry) => entry.event),
    capturePaused: partition.capturePaused === true,
  };
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

function pendingEpisodeKey(provider: string, titleKey: string, episodeKey: string): string {
  return `${provider}\u0000${titleKey}\u0000${episodeKey}`;
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
    const seasons = item.seasons
      .map((season) => ({
        ...season,
        episodes: season.episodes.filter((episode) => episode.episodeKey !== target.episodeKey),
      }))
      .filter((season) => season.episodes.length > 0);
    return seasons.length > 0 ? [{ ...item, seasons }] : [];
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
