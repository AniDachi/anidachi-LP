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
import { RefreshCw } from "lucide-react";
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
      ) : history?.items.length ? (
        <div className="popup-resource-list">
          {history.items.map((item) => (
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
    <article className="popup-provider-row" data-provider={item.provider}>
      <div className="popup-series-card">
        <strong>{item.title}</strong>
        <span>
          {item.catalogState === "complete" && item.aggregate.availableEpisodes !== null
            ? `${item.aggregate.completedEpisodes}/${item.aggregate.availableEpisodes} episodes`
            : `${observedCount} observed ${observedCount === 1 ? "episode" : "episodes"}`}
        </span>
        <button
          aria-label={`Delete ${item.title}`}
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
          Delete title
        </button>
      </div>
      {item.seasons.map((season) => (
        <section className="popup-season-group" key={season.seasonKey}>
          <strong>{season.seasonTitle}</strong>
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
