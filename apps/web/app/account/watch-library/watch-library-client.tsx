"use client";

import { WATCH_HISTORY_OWNER_HEADER } from "../../../lib/watch-history-owner";

import {
  WatchHistoryDeletionAckSchema,
  WatchHistoryPreferencesResponseSchema,
  WatchHistoryResponseSchema,
  WatchHistoryAccessSchema,
  buildPersonalHistoryResumeUrl,
  WatchHistoryTitleEpisodesResponseSchema,
  type WatchHistoryDeleteScope,
  type WatchHistoryEpisode,
  type WatchHistoryItem,
  type WatchHistoryPreferencesResponse,
  type WatchHistoryResponse,
  type WatchHistoryTitleEpisodesResponse,
} from "@anidachi/protocol";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/client-api";
import { WatchLibraryCapacity } from "./watch-library-capacity";
import { HistoryBrowser } from "./history-browser";

type Notice = { tone: "success" | "error"; text: string };

export function WatchLibraryClient({
  initialHistory,
  initialPreferences,
  initialAccess = "allowed",
}: {
  initialHistory: WatchHistoryResponse;
  initialPreferences: WatchHistoryPreferencesResponse;
  initialAccess?: "allowed" | "plan_required";
}) {
  const ownerGenerationKey = `${initialHistory.meta.ownerUserId}:${initialHistory.meta.accountGeneration}:${initialAccess}`;
  return (
    <WatchLibraryOwnerClient
      initialHistory={initialHistory}
      initialPreferences={initialPreferences}
      initialAccess={initialAccess}
      key={ownerGenerationKey}
    />
  );
}

function WatchLibraryOwnerClient({
  initialHistory,
  initialPreferences,
  initialAccess = "allowed",
}: {
  initialHistory: WatchHistoryResponse;
  initialPreferences: WatchHistoryPreferencesResponse;
  initialAccess?: "allowed" | "plan_required";
}) {
  const [accessState, setAccessState] = useState<string>(initialAccess);
  const canRead = accessState === "allowed" || accessState === "plan_required";
  const [history, setHistory] = useState(initialHistory);
  const loadedTitleCount = useRef(initialHistory.items.length);
  loadedTitleCount.current = history.items.length;
  const [preferences, setPreferences] = useState(initialPreferences);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const operationRevision = useRef(0);
  const mutationInFlight = useRef(false);
  const editorActive = useRef(false);
  const [editorDirty, setEditorDirty] = useState(false);
  const onDraftChange = useCallback((active: boolean) => { editorActive.current = active; setEditorDirty(active); }, []);
  const mounted = useRef(true);
  const ownerUserId = initialHistory.meta.ownerUserId;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      operationRevision.current += 1;
      mutationInFlight.current = false;
    };
  }, []);
  const readAccess = useCallback(async () => {
    try {
      const access = WatchHistoryAccessSchema.parse(await api<unknown>("/api/watch-history/v3/access", { headers: { [WATCH_HISTORY_OWNER_HEADER]: ownerUserId } }));
      if (access.ownerUserId !== ownerUserId) throw new ApiError("History access changed during the request", "HISTORY_ACCESS_CHANGED", 409);
      return access;
    } catch (error) {
      if (historyAuthorityState(error)) throw error;
      throw new ApiError("History access is temporarily unavailable", "HISTORY_ACCESS_UNAVAILABLE", 503);
    }
  }, [ownerUserId]);
  const hideInaccessible = useCallback((error: unknown) => {
    const state = historyAuthorityState(error);
    if (!state) return false;
    operationRevision.current += 1;
    mutationInFlight.current = false;
    setLoading(false);
    setLoadingMore(false);
    setBusyAction(null);
    setAccessState(state);
    setHistory(value => ({ ...value, items: [], totalTitleCount: 0, nextCursor: null }));
    return true;
  }, []);
  const captureDetailAccessFailure = useCallback(() => {
    const revision = operationRevision.current;
    return (error: unknown) => mounted.current && operationRevision.current === revision &&
      !mutationInFlight.current && hideInaccessible(error);
  }, [hideInaccessible]);

  const refresh = useCallback(async () => {
    if (mutationInFlight.current || editorActive.current) return;
    const revision = ++operationRevision.current;
    const current = () => mounted.current && operationRevision.current === revision;
    setLoadingMore(false);
    setLoading(true);
    setNotice(null);
    try {
      const access = await readAccess();
      if (!current()) return;
      setAccessState(access.state);
      const [historyValue, preferencesValue] = await Promise.all([
        api<unknown>("/api/watch-history/v3?limit=24"),
        api<unknown>("/api/watch-history/v3/preferences"),
      ]);
      let nextHistory = parseOwnedHistory(historyValue, ownerUserId);
      // Refresh the already visible window, including a title selected on a later
      // page. Every retained card comes from the new canonical read.
      while (nextHistory.nextCursor && nextHistory.items.length < loadedTitleCount.current && current()) {
        const page = parseOwnedHistory(await api<unknown>(`/api/watch-history/v3?limit=24&cursor=${encodeURIComponent(nextHistory.nextCursor)}`), ownerUserId);
        if (page.meta.accountGeneration !== nextHistory.meta.accountGeneration) throw new Error("Watch history generation changed");
        nextHistory = mergeWatchHistoryPages(nextHistory, page);
      }
      const nextPreferences = parseOwnedPreferences(preferencesValue, ownerUserId);
      if (nextHistory.meta.accountGeneration !== nextPreferences.meta.accountGeneration) {
        throw new Error("Watch history generation changed");
      }
      const finalAccess = await readAccess();
      if (finalAccess.accountGeneration !== access.accountGeneration || finalAccess.accessEpoch !== access.accessEpoch || nextHistory.meta.accountGeneration !== finalAccess.accountGeneration) throw new ApiError("History access changed during the request", "HISTORY_ACCESS_CHANGED", 409);
      if (!current()) return;
      setHistory(nextHistory);
      setPreferences(nextPreferences);
    } catch (error) {
      if (current()) {
        hideInaccessible(error);
        setNotice({ tone: "error", text: errorMessage(error, "Could not refresh watch history") });
      }
    } finally {
      if (current()) setLoading(false);
    }
  }, [ownerUserId, readAccess, hideInaccessible]);

  useEffect(() => bindWatchHistoryPageRefresh({ refresh }), [refresh]);

  const loadMore = useCallback(async () => {
    if (!history.nextCursor || loadingMore || mutationInFlight.current) return;
    const revision = ++operationRevision.current;
    const expectedGeneration = history.meta.accountGeneration;
    const current = () => mounted.current && operationRevision.current === revision;
    setLoading(false);
    setLoadingMore(true);
    setNotice(null);
    try {
      const page = parseOwnedHistory(
        await api<unknown>(`/api/watch-history/v3?limit=24&cursor=${encodeURIComponent(history.nextCursor)}`),
        ownerUserId,
      );
      if (page.meta.accountGeneration !== expectedGeneration) {
        throw new Error("Watch history generation changed");
      }
      if (!current()) return;
      setHistory((currentHistory) =>
        currentHistory.meta.ownerUserId === ownerUserId &&
          currentHistory.meta.accountGeneration === expectedGeneration
          ? mergeWatchHistoryPages(currentHistory, page)
          : currentHistory,
      );
    } catch (error) {
      if (current()) {
        hideInaccessible(error);
        setNotice({ tone: "error", text: errorMessage(error, "Could not load more history") });
      }
    } finally {
      if (current()) setLoadingMore(false);
    }
  }, [history, loadingMore, ownerUserId, hideInaccessible]);

  const updateYoutubePreference = useCallback(async () => {
    if (busyAction) return;
    const current = () => mounted.current;
    const revision = operationRevision.current;
    setBusyAction("preferences");
    setNotice(null);
    try {
      const next = parseOwnedPreferences(
        await api<unknown>("/api/watch-history/v3/preferences", {
          method: "PATCH",
          headers: { [WATCH_HISTORY_OWNER_HEADER]: ownerUserId },
          body: JSON.stringify({ youtubeHistoryEnabled: !preferences.preferences.youtubeHistoryEnabled }),
        }),
        ownerUserId,
      );
      if (current()) setPreferences(next);
    } catch (error) {
      if (current()) {
        if (operationRevision.current === revision) hideInaccessible(error);
        setNotice({ tone: "error", text: errorMessage(error, "Could not update history settings") });
      }
    } finally {
      if (current()) setBusyAction(null);
    }
  }, [busyAction, ownerUserId, preferences.preferences.youtubeHistoryEnabled, hideInaccessible]);

  const deleteHistory = useCallback(async (target: WatchHistoryDeleteScope) => {
    if (busyAction || mutationInFlight.current || !window.confirm(deleteConfirmation(target))) return;
    mutationInFlight.current = true;
    const revision = ++operationRevision.current;
    const expectedGeneration = history.meta.accountGeneration;
    const current = () => mounted.current && operationRevision.current === revision;
    const action = deleteScopeKey(target);
    setLoading(false);
    setLoadingMore(false);
    setBusyAction(action);
    setNotice(null);
    try {
      const acknowledgement = WatchHistoryDeletionAckSchema.parse(
        await api<unknown>("/api/watch-history/v3/delete", {
          method: "POST",
          headers: { [WATCH_HISTORY_OWNER_HEADER]: ownerUserId },
          body: JSON.stringify({
            schemaVersion: 3,
            clientMutationId: crypto.randomUUID(),
            accountGeneration: expectedGeneration,
            target,
            requestedAt: new Date().toISOString(),
          }),
        }),
      );
      if (
        acknowledgement.meta.ownerUserId !== ownerUserId ||
        acknowledgement.accountGeneration < expectedGeneration
      ) {
        throw new Error("Watch history owner changed");
      }
      if (!current()) return;
      setHistory((currentHistory) =>
        currentHistory.meta.ownerUserId === ownerUserId &&
          currentHistory.meta.accountGeneration === expectedGeneration
          ? removeWatchHistoryTarget(
              currentHistory,
              acknowledgement.target,
              acknowledgement.accountGeneration,
            )
          : currentHistory,
      );
      setNotice({ tone: "success", text: "Watch history updated." });

      if (!canRead) return;
      const canonical = parseOwnedHistory(
        await api<unknown>("/api/watch-history/v3?limit=24"),
        ownerUserId,
      );
      if (canonical.meta.accountGeneration < acknowledgement.accountGeneration) {
        throw new Error("Watch history generation changed");
      }
      if (current()) setHistory(canonical);
    } catch (error) {
      if (current()) {
        hideInaccessible(error);
        setNotice({ tone: "error", text: errorMessage(error, "Could not delete watch history") });
      }
    } finally {
      if (current()) {
        mutationInFlight.current = false;
        setBusyAction(null);
      }
    }
  }, [busyAction, history.meta.accountGeneration, ownerUserId, canRead, hideInaccessible]);

  const resume = useCallback(async (provider: WatchHistoryItem["provider"], sourceUrl: string, currentTime: number) => {
    if (busyAction || mutationInFlight.current || !canRead) return;
    if (provider !== "crunchyroll" && provider !== "youtube") return;
    const revision = operationRevision.current;
    const generation = history.meta.accountGeneration;
    const current = () => mounted.current && operationRevision.current === revision && !mutationInFlight.current;
    setBusyAction("resume");
    setNotice(null);
    try {
      const access = await readAccess();
      if (!current()) return;
      if (access.accountGeneration !== generation) throw new ApiError("History access changed during the request", "HISTORY_ACCESS_CHANGED", 409);
      const url = await buildPersonalHistoryResumeUrl({ ownerUserId, accountGeneration: generation, provider, sourceUrl, currentTime });
      if (current()) window.location.assign(url);
    } catch (error) {
      if (current()) { hideInaccessible(error); setNotice({ tone: "error", text: errorMessage(error, "Could not resume playback") }); }
    } finally { if (mounted.current) setBusyAction(value => value === "resume" ? null : value); }
  }, [busyAction, canRead, history.meta.accountGeneration, ownerUserId, readAccess, hideInaccessible]);

  return (
    <div className="wh-page">
      <header className="wh-page-heading">
        <div><h1>Watch Library</h1><p>Your progress, all in one place.</p></div>
        <div className="wh-page-actions">
          <button aria-pressed={preferences.preferences.youtubeHistoryEnabled} className="wh-button" disabled={Boolean(busyAction) || editorDirty} onClick={() => void updateYoutubePreference()} type="button">YouTube history: {preferences.preferences.youtubeHistoryEnabled ? "On" : "Off"}</button>
          <button className="wh-icon" aria-label="Refresh history" disabled={loading || Boolean(busyAction) || editorDirty} onClick={() => void refresh()} type="button"><RefreshCw size={16} aria-hidden /></button>
          <button className="wh-text wh-danger" disabled={Boolean(busyAction) || editorDirty} onClick={() => void deleteHistory({ scope: "all" })} type="button">{busyAction === "delete:all" ? "Clearing..." : "Clear history"}</button>
        </div>
      </header>
      {accessState === "plan_required" && <p className="wh-hint" role="status">Your saved history stays here. Plus or Pro unlocks recording and progress editing. <a href="/pricing" className="text-brand-orange">View plans</a></p>}
      {notice && <div className={notice.tone === "error" ? "wh-error" : "wh-saved"} role="status">{notice.text}</div>}
      {!canRead ? <section className="wh-error" role="status">{accessState === "upgrade-required" ? "Update AniDachi to use personal history." : "History access is temporarily unavailable. Please retry."}</section> : (
        <HistoryBrowser key={`${ownerUserId}:${history.meta.accountGeneration}`} items={history.items} owner={ownerUserId} generation={history.meta.accountGeneration}
          canEdit={accessState === "allowed"} busy={Boolean(busyAction)} nextCursor={history.nextCursor} loadingMore={loadingMore}
          captureAccessFailure={captureDetailAccessFailure} onLoadMore={loadMore} onEdited={refresh} onDraftChange={onDraftChange} onDelete={deleteHistory} onResume={resume}
          capacity={<WatchLibraryCapacity ownerUserId={ownerUserId} accountGeneration={history.meta.accountGeneration}
            revision={`${history.generatedAt}:${history.totalTitleCount}`} recordingAllowed={accessState === "allowed"} />} />
      )}
    </div>
  );
}

type WatchHistoryRefreshEventTarget = Pick<EventTarget, "addEventListener" | "removeEventListener">;

export function bindWatchHistoryPageRefresh(options: {
  refresh: () => void | Promise<void>;
  windowTarget?: WatchHistoryRefreshEventTarget;
  documentTarget?: WatchHistoryRefreshEventTarget;
  getVisibilityState?: () => DocumentVisibilityState;
  schedule?: (callback: () => void) => () => void;
}): () => void {
  const windowTarget = options.windowTarget ?? window;
  const documentTarget = options.documentTarget ?? document;
  const getVisibilityState = options.getVisibilityState ?? (() => document.visibilityState);
  const schedule = options.schedule ?? ((callback) => {
    const timer = window.setTimeout(callback, 350);
    return () => window.clearTimeout(timer);
  });
  let cancelScheduled: (() => void) | null = null;
  let disposed = false;
  const trigger = () => {
    if (disposed || cancelScheduled) return;
    cancelScheduled = schedule(() => {
      cancelScheduled = null;
      if (!disposed) void options.refresh();
    });
  };
  const onFocus = () => trigger();
  const onVisibilityChange = () => {
    if (getVisibilityState() === "visible") trigger();
  };
  windowTarget.addEventListener("focus", onFocus);
  documentTarget.addEventListener("visibilitychange", onVisibilityChange);
  return () => {
    disposed = true;
    cancelScheduled?.();
    cancelScheduled = null;
    windowTarget.removeEventListener("focus", onFocus);
    documentTarget.removeEventListener("visibilitychange", onVisibilityChange);
  };
}

export function getWatchHistoryAggregateLabel(item: WatchHistoryItem): string {
  const observed = item.observedEpisodeCount;
  if (
    item.catalogState !== "complete" ||
    item.aggregate.availableEpisodes === null ||
    item.aggregate.progress === null
  ) return `${observed} observed ${observed === 1 ? "episode" : "episodes"}`;
  if (item.aggregate.availableEpisodes === 0) return "Not currently available";
  return `${item.aggregate.completedEpisodes} / ${item.aggregate.availableEpisodes} episodes · ${formatProgressPercent(item.aggregate.progress ?? 0)}%`;
}

export function mergeWatchHistoryPages(current: WatchHistoryResponse, page: WatchHistoryResponse): WatchHistoryResponse {
  if (current.meta.ownerUserId !== page.meta.ownerUserId || current.meta.accountGeneration !== page.meta.accountGeneration) return page;
  const items = new Map(current.items.map((item) => [`${item.provider}:${item.titleKey}`, item]));
  for (const item of page.items) items.set(`${item.provider}:${item.titleKey}`, item);
  return { ...page, items: Array.from(items.values()) };
}

export async function loadWatchHistoryTitleEpisodePage(params: {
  ownerUserId: string;
  accountGeneration?: number;
  item: WatchHistoryItem;
  cursor: string;
  request?: (path: string) => Promise<unknown>;
}): Promise<WatchHistoryTitleEpisodesResponse> {
  const query = new URLSearchParams({
    provider: params.item.provider,
    titleKey: params.item.titleKey,
    limit: "50",
    cursor: params.cursor,
  });
  const value = await (params.request ?? ((path) => api<unknown>(path)))(
    `/api/watch-history/v3/title-episodes?${query.toString()}`,
  );
  const page = WatchHistoryTitleEpisodesResponseSchema.parse(value);
  if (
    page.meta.ownerUserId !== params.ownerUserId ||
    (params.accountGeneration !== undefined &&
      page.meta.accountGeneration !== params.accountGeneration) ||
    page.provider !== params.item.provider ||
    page.titleKey !== params.item.titleKey
  ) {
    throw new Error("Watch history owner or title changed");
  }
  return page;
}

export function mergeWatchHistoryTitleEpisodePage(
  item: WatchHistoryItem,
  page: WatchHistoryTitleEpisodesResponse,
): WatchHistoryItem {
  if (page.provider !== item.provider || page.titleKey !== item.titleKey) return item;
  const episodesByKey = new Map(
    item.seasons.flatMap((season) => season.episodes).map((episode) => [episode.episodeKey, episode]),
  );
  for (const episode of page.episodes) {
    episodesByKey.set(episode.episodeKey, episode);
  }
  const mergedEpisodes = Array.from(episodesByKey.values());
  const exactCatalog = page.catalog.state === "complete" &&
    page.catalog.title !== null && page.catalog.aggregate !== null;
  const seasons = exactCatalog
    ? mergeExactCatalogSeasons(item, page.catalog.seasons, mergedEpisodes)
        .sort((a, b) => a.order - b.order || a.seasonKey.localeCompare(b.seasonKey))
    : mergeObservedSeasons(item, mergedEpisodes, page.catalog.state);
  for (const season of seasons) {
    season.episodes.sort(
      (a, b) =>
        (a.episodeNumber ?? Number.MAX_SAFE_INTEGER) -
          (b.episodeNumber ?? Number.MAX_SAFE_INTEGER) ||
        b.lastWatchedAt.localeCompare(a.lastWatchedAt) ||
        a.episodeKey.localeCompare(b.episodeKey),
    );
  }
  return {
    ...item,
    title: exactCatalog ? page.catalog.title! : item.title,
    catalogState: page.catalog.state,
    observedEpisodeCount: page.observedEpisodeCount,
    completedEpisodeCount: page.completedEpisodeCount,
    aggregate: exactCatalog
      ? page.catalog.aggregate!
      : {
          completedEpisodes: page.completedEpisodeCount,
          availableEpisodes: null,
          progress: null,
        },
    seasons,
    episodePage: { complete: page.complete, nextCursor: page.nextCursor },
  };
}

function mergeExactCatalogSeasons(
  item: WatchHistoryItem,
  catalogSeasons: WatchHistoryTitleEpisodesResponse["catalog"]["seasons"],
  episodes: WatchHistoryEpisode[],
): WatchHistoryItem["seasons"] {
  type CatalogSeason = WatchHistoryTitleEpisodesResponse["catalog"]["seasons"][number];
  const metadataByKey = new Map<string, WatchHistoryItem["seasons"][number] | CatalogSeason>(
    item.seasons.map((season) => [season.seasonKey, season]),
  );
  for (const season of catalogSeasons) metadataByKey.set(season.seasonKey, season);
  return Array.from(metadataByKey.values())
    .map((season) => ({
      ...season,
      episodes: episodes.filter((episode) => episode.seasonKey === season.seasonKey),
    }))
    .filter((season) => season.episodes.length > 0);
}

function mergeObservedSeasons(
  item: WatchHistoryItem,
  episodes: WatchHistoryEpisode[],
  catalogState: WatchHistoryItem["catalogState"],
): WatchHistoryItem["seasons"] {
  const seasons = item.seasons.map((season) => ({
    ...season,
    aggregate: catalogState === item.catalogState
      ? season.aggregate
      : { completedEpisodes: 0, availableEpisodes: null, progress: null },
    episodes: episodes.filter(
      (episode) => (episode.seasonKey ?? "observed") === season.seasonKey,
    ),
    nextEpisode: null,
  }));
  for (const episode of episodes) {
    const seasonKey = episode.seasonKey ?? "observed";
    if (seasons.some((season) => season.seasonKey === seasonKey)) continue;
    seasons.push({
      seasonKey,
      seasonTitle: episode.seasonTitle ?? "Observed episodes",
      seasonNumber: episode.seasonNumber,
      order: seasons.length,
      aggregate: { completedEpisodes: 0, availableEpisodes: null, progress: null },
      episodes: episodes.filter(
        (candidate) => (candidate.seasonKey ?? "observed") === seasonKey,
      ),
      nextEpisode: null,
    });
  }
  return seasons.filter((season) => season.episodes.length > 0);
}

export function removeWatchHistoryTarget(history: WatchHistoryResponse, target: WatchHistoryDeleteScope, accountGeneration = history.meta.accountGeneration): WatchHistoryResponse {
  if (target.scope === "all") return { ...history, meta: { ...history.meta, accountGeneration }, items: [], totalTitleCount: 0, nextCursor: null };
  if (target.scope === "title") {
    const items = history.items.filter((item) => item.provider !== target.provider || item.titleKey !== target.titleKey);
    return { ...history, meta: { ...history.meta, accountGeneration }, items, totalTitleCount: Math.max(0, history.totalTitleCount - (items.length === history.items.length ? 0 : 1)) };
  }
  const items = history.items.flatMap((item) => {
    if (item.provider !== target.provider || item.titleKey !== target.titleKey) return [item];
    const removedEpisode = item.seasons
      .flatMap((season) => season.episodes)
      .find((episode) => episode.episodeKey === target.episodeKey);
    const seasons = item.seasons.map((season) => ({ ...season, episodes: season.episodes.filter((episode) => episode.episodeKey !== target.episodeKey) })).filter((season) => season.episodes.length > 0);
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
      seasons,
    }];
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

function clampProgress(progress: number): number {
  return Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
}

function formatProgressPercent(progress: number): string {
  return String(Number((clampProgress(progress) * 100).toFixed(2)));
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function historyAuthorityState(error: unknown): "plan-required" | "upgrade-required" | "unavailable" | null {
  if (!(error instanceof ApiError)) return null;
  switch (error.code) {
    case "HISTORY_PLAN_REQUIRED": return "plan-required";
    case "HISTORY_CLIENT_UPDATE_REQUIRED": return "upgrade-required";
    case "OWNER_MISMATCH":
    case "GENERATION_MISMATCH":
    case "HISTORY_ACCESS_CHANGED":
    case "HISTORY_ACCESS_UNAVAILABLE": return "unavailable";
    default: return null;
  }
}
