"use client";

import {
  WatchHistoryDeletionAckSchema,
  WatchHistoryPreferencesResponseSchema,
  WatchHistoryResponseSchema,
  WatchHistoryRoomRecreationResponseSchema,
  type WatchHistoryDeleteScope,
  type WatchHistoryEpisode,
  type WatchHistoryItem,
  type WatchHistoryPreferencesResponse,
  type WatchHistoryResponse,
  type WatchHistorySession,
} from "@anidachi/protocol";
import { Clock3, Film, Play, RefreshCw, Trash2, Users } from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/client-api";

type Notice = { tone: "success" | "error"; text: string };

export function WatchLibraryClient({
  initialHistory,
  initialPreferences,
}: {
  initialHistory: WatchHistoryResponse;
  initialPreferences: WatchHistoryPreferencesResponse;
}) {
  const [history, setHistory] = useState(initialHistory);
  const [preferences, setPreferences] = useState(initialPreferences);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const observedEpisodeCount = useMemo(
    () => history.items.reduce((total, item) => total + observedEpisodeCountForItem(item), 0),
    [history.items],
  );
  const sharedSessionCount = useMemo(
    () => history.items.reduce(
      (total, item) => total + item.sessions.filter((session) => session.kind === "shared").length,
      0,
    ),
    [history.items],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const [historyValue, preferencesValue] = await Promise.all([
        api<unknown>("/api/watch-history/v2?limit=24"),
        api<unknown>("/api/watch-history/v2/preferences"),
      ]);
      setHistory(parseOwnedHistory(historyValue, history.meta.ownerUserId));
      setPreferences(parseOwnedPreferences(preferencesValue, history.meta.ownerUserId));
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error, "Could not refresh watch history") });
    } finally {
      setLoading(false);
    }
  }, [history.meta.ownerUserId]);

  const loadMore = useCallback(async () => {
    if (!history.nextCursor || loadingMore) return;
    setLoadingMore(true);
    setNotice(null);
    try {
      const page = parseOwnedHistory(
        await api<unknown>(`/api/watch-history/v2?limit=24&cursor=${encodeURIComponent(history.nextCursor)}`),
        history.meta.ownerUserId,
      );
      setHistory((current) => mergeWatchHistoryPages(current, page));
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error, "Could not load more history") });
    } finally {
      setLoadingMore(false);
    }
  }, [history, loadingMore]);

  const updateYoutubePreference = useCallback(async () => {
    if (busyAction) return;
    setBusyAction("preferences");
    setNotice(null);
    try {
      const next = parseOwnedPreferences(
        await api<unknown>("/api/watch-history/v2/preferences", {
          method: "PATCH",
          body: JSON.stringify({ youtubeHistoryEnabled: !preferences.preferences.youtubeHistoryEnabled }),
        }),
        history.meta.ownerUserId,
      );
      setPreferences(next);
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error, "Could not update history settings") });
    } finally {
      setBusyAction(null);
    }
  }, [busyAction, history.meta.ownerUserId, preferences.preferences.youtubeHistoryEnabled]);

  const deleteHistory = useCallback(async (target: WatchHistoryDeleteScope) => {
    if (busyAction || !window.confirm(deleteConfirmation(target))) return;
    const action = deleteScopeKey(target);
    setBusyAction(action);
    setNotice(null);
    try {
      const acknowledgement = WatchHistoryDeletionAckSchema.parse(
        await api<unknown>("/api/watch-history/v2/delete", {
          method: "POST",
          body: JSON.stringify({
            schemaVersion: 2,
            clientMutationId: crypto.randomUUID(),
            accountGeneration: history.meta.accountGeneration,
            target,
            requestedAt: new Date().toISOString(),
          }),
        }),
      );
      if (acknowledgement.meta.ownerUserId !== history.meta.ownerUserId) {
        throw new Error("Watch history owner changed");
      }
      setHistory((current) => removeWatchHistoryTarget(current, acknowledgement.target, acknowledgement.accountGeneration));
      setNotice({ tone: "success", text: "Watch history updated." });
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error, "Could not delete watch history") });
    } finally {
      setBusyAction(null);
    }
  }, [busyAction, history.meta.accountGeneration, history.meta.ownerUserId]);

  const createRoom = useCallback(async (session: WatchHistorySession, sourceUrl: string) => {
    const action = `room:${session.id}`;
    setBusyAction(action);
    setNotice(null);
    try {
      const room = WatchHistoryRoomRecreationResponseSchema.parse(
        await api<unknown>("/api/watch-history/v2/rooms", {
          method: "POST",
          body: JSON.stringify({ sessionId: session.id, clientRequestId: crypto.randomUUID() }),
        }),
      );
      window.location.assign(buildLaunchUrl(sourceUrl, room.roomId));
    } catch (error) {
      setNotice({ tone: "error", text: errorMessage(error, "Could not create room") });
    } finally {
      setBusyAction(null);
    }
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard icon={<Film className="h-5 w-5" aria-hidden />} label="Tracked titles" value={history.totalTitleCount} />
        <StatCard icon={<Clock3 className="h-5 w-5" aria-hidden />} label="Observed episodes" value={observedEpisodeCount} />
        <StatCard icon={<Users className="h-5 w-5" aria-hidden />} label="Shared sessions" value={sharedSessionCount} />
      </section>

      <section className="rounded-lg border border-brand-border bg-brand-surface p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Watch History</h2>
            <p className="mt-1 text-sm text-foreground/50">Canonical progress from supported playback in the AniDachi extension.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button aria-pressed={preferences.preferences.youtubeHistoryEnabled} className="inline-flex min-h-11 items-center rounded-lg border border-brand-border px-4 text-sm font-semibold text-foreground disabled:opacity-50" disabled={Boolean(busyAction)} onClick={() => void updateYoutubePreference()} type="button">
              YouTube history: {preferences.preferences.youtubeHistoryEnabled ? "On" : "Off"}
            </button>
            <button className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-brand-border px-4 text-sm font-semibold text-foreground disabled:opacity-50" disabled={loading || Boolean(busyAction)} onClick={() => void refresh()} type="button">
              <RefreshCw className="h-4 w-4" aria-hidden /> Refresh
            </button>
            <button className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-400/25 bg-red-500/10 px-4 text-sm font-semibold text-red-100 disabled:opacity-50" disabled={Boolean(busyAction) || history.items.length === 0} onClick={() => void deleteHistory({ scope: "all" })} type="button">
              <Trash2 className="h-4 w-4" aria-hidden /> {busyAction === "delete:all" ? "Clearing..." : "Clear history"}
            </button>
          </div>
        </div>
      </section>

      {notice ? <div className={`rounded-lg border px-4 py-3 text-sm ${notice.tone === "error" ? "border-red-400/25 bg-red-500/10 text-red-100" : "border-brand-orange/25 bg-brand-orange/10 text-brand-orange"}`}>{notice.text}</div> : null}

      {history.items.length ? (
        <div className="grid gap-4">
          {history.items.map((item) => <WatchItemCard busyAction={busyAction} item={item} key={`${item.provider}:${item.titleKey}`} onCreateRoom={createRoom} onDelete={deleteHistory} />)}
        </div>
      ) : (
        <section className="rounded-lg border border-brand-border bg-brand-surface p-6 text-sm text-foreground/50">Progress will appear after meaningful playback while signed in to the extension.</section>
      )}

      {history.nextCursor ? <button className="mx-auto inline-flex min-h-11 items-center rounded-lg border border-brand-border px-5 text-sm font-semibold text-foreground disabled:opacity-50" disabled={loadingMore} onClick={() => void loadMore()} type="button">{loadingMore ? "Loading..." : "Load more"}</button> : null}
    </div>
  );
}

function WatchItemCard({ busyAction, item, onCreateRoom, onDelete }: { busyAction: string | null; item: WatchHistoryItem; onCreateRoom: (session: WatchHistorySession, sourceUrl: string) => void; onDelete: (target: WatchHistoryDeleteScope) => void }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-brand-border/80 bg-brand-surface">
      <div className="flex items-center gap-4 border-b border-brand-border/80 p-4">
        <Poster item={item} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-[0.1em] text-brand-orange">{providerLabel(item.provider)} · {item.itemKind}</p>
          <h3 className="mt-1 truncate text-lg font-bold text-foreground">{item.title}</h3>
          <p className="mt-1 text-sm text-foreground/50">{getWatchHistoryAggregateLabel(item)} · last watched {formatDate(item.lastWatchedAt)}</p>
        </div>
        <button className="rounded-lg border border-red-400/25 px-3 py-2 text-xs font-semibold text-red-100 disabled:opacity-50" disabled={Boolean(busyAction)} onClick={() => onDelete({ scope: "title", provider: item.provider, titleKey: item.titleKey })} type="button">Delete title</button>
      </div>

      {item.seasons.length ? item.seasons.map((season) => (
        <section className="border-b border-brand-border/50 last:border-b-0" key={season.seasonKey}>
          <div className="bg-white/[0.025] px-4 py-3">
            <h4 className="text-sm font-bold text-brand-orange">{season.seasonTitle}</h4>
            <p className="mt-0.5 text-xs text-foreground/45">{season.aggregate.availableEpisodes === null ? `${season.episodes.length} observed ${season.episodes.length === 1 ? "episode" : "episodes"}` : `${season.aggregate.completedEpisodes}/${season.aggregate.availableEpisodes} episodes`}</p>
          </div>
          <div className="divide-y divide-brand-border/50">
            {season.episodes.map((episode) => <EpisodeRow busyAction={busyAction} episode={episode} item={item} key={episode.episodeKey} onCreateRoom={onCreateRoom} onDelete={onDelete} />)}
          </div>
        </section>
      )) : <LatestActivityRow busyAction={busyAction} item={item} onCreateRoom={onCreateRoom} />}
    </section>
  );
}

function EpisodeRow({ busyAction, episode, item, onCreateRoom, onDelete }: { busyAction: string | null; episode: WatchHistoryEpisode; item: WatchHistoryItem; onCreateRoom: (session: WatchHistorySession, sourceUrl: string) => void; onDelete: (target: WatchHistoryDeleteScope) => void }) {
  const latestSession = episode.sessions[0] ?? null;
  const target = { scope: "episode", provider: item.provider, titleKey: item.titleKey, episodeKey: episode.episodeKey } as const;
  return (
    <div className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{episode.episodeTitle}</p>
        <ProgressBar progress={episode.progress} />
        <p className="mt-2 text-xs text-foreground/50">{formatClock(episode.currentTime)} / {formatClock(episode.duration)} · {formatDate(episode.lastWatchedAt)}</p>
        <SessionPills sessions={episode.sessions} />
      </div>
      <div className="flex gap-2">
        <button className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-orange px-4 text-sm font-semibold text-foreground disabled:opacity-50" disabled={!latestSession || busyAction === `room:${latestSession.id}`} onClick={() => latestSession && onCreateRoom(latestSession, episode.sourceUrl)} type="button"><Play className="h-4 w-4" aria-hidden /> Create room</button>
        <button aria-label={`Delete ${episode.episodeTitle}`} className="rounded-lg border border-red-400/25 px-3 text-red-100 disabled:opacity-50" disabled={Boolean(busyAction)} onClick={() => onDelete(target)} type="button"><Trash2 className="h-4 w-4" aria-hidden /></button>
      </div>
    </div>
  );
}

function LatestActivityRow({ busyAction, item, onCreateRoom }: { busyAction: string | null; item: WatchHistoryItem; onCreateRoom: (session: WatchHistorySession, sourceUrl: string) => void }) {
  const latestSession = item.sessions[0] ?? null;
  return (
    <div className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div><p className="text-sm font-semibold text-foreground">Latest activity</p><ProgressBar progress={item.latestActivity.progress} /><p className="mt-2 text-xs text-foreground/50">{formatClock(item.latestActivity.currentTime)} / {formatClock(item.latestActivity.duration)} · {formatDate(item.latestActivity.lastWatchedAt)}</p><SessionPills sessions={item.sessions} /></div>
      <button className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-orange px-4 text-sm font-semibold text-foreground disabled:opacity-50" disabled={!latestSession || busyAction === `room:${latestSession.id}`} onClick={() => latestSession && onCreateRoom(latestSession, item.sourceUrl)} type="button"><Play className="h-4 w-4" aria-hidden /> Create room</button>
    </div>
  );
}

function SessionPills({ sessions }: { sessions: WatchHistorySession[] }) {
  if (!sessions.length) return null;
  return <div className="mt-3 flex flex-wrap gap-2">{sessions.slice(0, 4).map((session) => <span className="inline-flex items-center gap-2 rounded-full border border-brand-border bg-brand-orange/5 px-3 py-1 text-xs text-foreground/70" key={session.id}><Users className="h-3.5 w-3.5 text-brand-orange" aria-hidden />{session.kind === "shared" ? `${session.participants.length} people` : "Solo"} · {formatDate(session.lastWatchedAt)}</span>)}</div>;
}

function ProgressBar({ progress }: { progress: number }) {
  return <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-surface"><span className="block h-full rounded-full bg-gradient-to-r from-brand-orange to-brand-orange-bright" style={{ width: `${Math.round(clampProgress(progress) * 100)}%` }} /></div>;
}

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return <div className="rounded-lg border border-brand-border bg-brand-surface p-5"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-orange/15 text-brand-orange">{icon}</span><div><p className="text-2xl font-bold text-foreground">{value}</p><p className="text-sm text-foreground/50">{label}</p></div></div></div>;
}

function Poster({ item }: { item: WatchHistoryItem }) {
  return item.artworkUrl ? <img alt="" className="h-16 w-11 shrink-0 rounded-md object-cover" src={item.artworkUrl} /> : <span className="flex h-16 w-11 shrink-0 items-center justify-center rounded-md bg-brand-surface text-foreground/50"><Film className="h-5 w-5" aria-hidden /></span>;
}

export function getWatchHistoryAggregateLabel(item: WatchHistoryItem): string {
  const observed = observedEpisodeCountForItem(item);
  if (item.catalogState !== "complete" || item.aggregate.availableEpisodes === null) return `${observed} observed ${observed === 1 ? "episode" : "episodes"}`;
  return `${item.aggregate.completedEpisodes}/${item.aggregate.availableEpisodes} episodes`;
}

export function mergeWatchHistoryPages(current: WatchHistoryResponse, page: WatchHistoryResponse): WatchHistoryResponse {
  if (current.meta.ownerUserId !== page.meta.ownerUserId || current.meta.accountGeneration !== page.meta.accountGeneration) return page;
  const items = new Map(current.items.map((item) => [`${item.provider}:${item.titleKey}`, item]));
  for (const item of page.items) items.set(`${item.provider}:${item.titleKey}`, item);
  return { ...page, items: Array.from(items.values()) };
}

export function removeWatchHistoryTarget(history: WatchHistoryResponse, target: WatchHistoryDeleteScope, accountGeneration = history.meta.accountGeneration): WatchHistoryResponse {
  if (target.scope === "all") return { ...history, meta: { ...history.meta, accountGeneration }, items: [], totalTitleCount: 0, nextCursor: null };
  if (target.scope === "title") {
    const items = history.items.filter((item) => item.provider !== target.provider || item.titleKey !== target.titleKey);
    return { ...history, meta: { ...history.meta, accountGeneration }, items, totalTitleCount: Math.max(0, history.totalTitleCount - (items.length === history.items.length ? 0 : 1)) };
  }
  const items = history.items.flatMap((item) => {
    if (item.provider !== target.provider || item.titleKey !== target.titleKey) return [item];
    const seasons = item.seasons.map((season) => ({ ...season, episodes: season.episodes.filter((episode) => episode.episodeKey !== target.episodeKey) })).filter((season) => season.episodes.length > 0);
    return seasons.length > 0 ? [{ ...item, seasons }] : [];
  });
  return { ...history, meta: { ...history.meta, accountGeneration }, items, totalTitleCount: Math.max(0, history.totalTitleCount - (items.length === history.items.length ? 0 : 1)) };
}

function parseOwnedHistory(value: unknown, ownerUserId: string): WatchHistoryResponse {
  const parsed = WatchHistoryResponseSchema.parse(value);
  if (parsed.meta.ownerUserId !== ownerUserId) throw new Error("Watch history owner changed");
  return parsed;
}

function parseOwnedPreferences(value: unknown, ownerUserId: string): WatchHistoryPreferencesResponse {
  const parsed = WatchHistoryPreferencesResponseSchema.parse(value);
  if (parsed.meta.ownerUserId !== ownerUserId) throw new Error("Watch history owner changed");
  return parsed;
}

function observedEpisodeCountForItem(item: WatchHistoryItem): number {
  const episodes = item.seasons.reduce((total, season) => total + season.episodes.length, 0);
  return episodes || (item.itemKind === "movie" ? 1 : 0);
}

function deleteScopeKey(target: WatchHistoryDeleteScope): string {
  if (target.scope === "all") return "delete:all";
  if (target.scope === "title") return `delete:${target.provider}:${target.titleKey}`;
  return `delete:${target.provider}:${target.titleKey}:${target.episodeKey}`;
}

function deleteConfirmation(target: WatchHistoryDeleteScope): string {
  if (target.scope === "all") return "Clear your AniDachi watch history?";
  if (target.scope === "title") return "Delete this title from your watch history?";
  return "Delete this episode from your watch history?";
}

function providerLabel(provider: string): string {
  if (provider === "crunchyroll") return "Crunchyroll";
  if (provider === "youtube") return "YouTube";
  return provider;
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown date" : date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatClock(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const rest = value % 60;
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}` : `${minutes}:${String(rest).padStart(2, "0")}`;
}

function clampProgress(progress: number): number {
  return Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
}

function buildLaunchUrl(sourceUrl: string, roomId: string): string {
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Unsupported URL");
    const params = new URLSearchParams(url.hash.replace(/^#/, ""));
    params.set("anidachiRoom", roomId);
    url.hash = params.toString();
    return url.toString();
  } catch {
    return `/room/${encodeURIComponent(roomId)}`;
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
