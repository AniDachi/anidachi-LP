import {
  WATCH_HISTORY_TITLE_EPISODE_SLICE_LIMIT,
  type WatchHistoryItem,
  type WatchHistoryPreferences,
  type WatchHistoryResponse,
  WatchHistoryResponseSchema,
  type WatchProgressEvent,
  WatchProgressEventSchema,
} from "@anidachi/protocol";
export { PopupWatchHistoryPanel } from "./popup-watch-drawer";
import {
  createListWatchHistoryMessage,
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
    listener: (snapshot: PopupWatchHistorySnapshot | null, refreshResult?: WatchHistoryMessageResponse) => void,
  ): () => void;
  confirmDiscard(message: string): boolean;
  openUrl(url: string): Promise<void>;
};

const LOCAL_CACHE_REFRESH_CURSOR = "local_cache_refresh_required";

export const defaultPopupWatchHistoryClient: PopupWatchHistoryClient = {
  loadCached: loadConfirmedPopupWatchHistorySnapshot,
  request: requestWatchHistory,
  subscribe: subscribeToPopupWatchHistorySnapshot,
  confirmDiscard: (message) => window.confirm(message),
  openUrl: async (url) => {
    await chrome.tabs.create({ url });
  },
};

export async function requestPopupWatchHistory(
  client: PopupWatchHistoryClient,
  message: WatchHistoryMessage,
): Promise<WatchHistoryMessageResponse> {
  try {
    return await client.request(message);
  } catch {
    return { ok: false, status: "retryable" };
  }
}

export function isSameHistoryRevision(
  current: WatchHistoryResponse | null,
  next: WatchHistoryResponse,
): boolean {
  return current === next || Boolean(
    current &&
    current.meta.ownerUserId === next.meta.ownerUserId &&
    current.meta.accountGeneration === next.meta.accountGeneration &&
    current.meta.serverTime === next.meta.serverTime &&
    current.generatedAt === next.generatedAt &&
    current.totalTitleCount === next.totalTitleCount &&
    JSON.stringify(current.items) === JSON.stringify(next.items),
  );
}

export type PopupProviderGroup = {
  provider: WatchHistoryItem["provider"];
  label: string;
  items: WatchHistoryItem[];
};

export type PopupHistoryLayout = {
  scope: string;
  titleKeys: string[];
  defaults: Record<string, boolean>;
};

export function reconcileHistoryLayout(
  previous: PopupHistoryLayout | null,
  items: WatchHistoryItem[],
  scope: string,
): PopupHistoryLayout {
  const current = previous?.scope === scope ? previous : null;
  const byKey = new Map(items.map((item) => [pendingTitleKey(item.provider, item.titleKey), item]));
  const keys = [...byKey.keys()];
  const present = new Set(keys);
  const retained = current?.titleKeys.filter((key) => present.has(key)) ?? [];
  const known = new Set(retained);
  const titleKeys = [...retained, ...keys.filter((key) => !known.has(key))];
  const defaults: Record<string, boolean> = {};
  const providers = new Set<string>();
  for (const key of titleKeys) {
    const item = byKey.get(key);
    if (!item) continue;
    const titleBranch = JSON.stringify([item.provider, item.titleKey]);
    defaults[titleBranch] = current?.defaults[titleBranch] ?? !providers.has(item.provider);
    providers.add(item.provider);

  }
  if (current && titleKeys.length === current.titleKeys.length &&
    titleKeys.every((key, index) => key === current.titleKeys[index]) &&
    Object.keys(defaults).length === Object.keys(current.defaults).length &&
    Object.entries(defaults).every(([key, value]) => current.defaults[key] === value)) return current;
  return { scope, titleKeys, defaults };
}

export function projectPendingWatchHistoryItems(
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
    let item = projected[itemIndex];
    if (item && !item.artworkUrl && event.artworkUrl) {
      const enriched = { ...item, artworkUrl: event.artworkUrl };
      projected = projected.map((candidate, index) => index === itemIndex ? enriched : candidate);
      item = enriched;
    }
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
    .filter((season) => season.episodes.length > 0);
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

export function pendingWatchHistoryEpisode(
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

export function watchHistoryOverallProgress(item: WatchHistoryItem): {
  accessibleSuffix: string;
  label: string;
  progress: number | null;
} {
  const available = item.aggregate.availableEpisodes;
  const progress = item.aggregate.progress;
  if (item.catalogState !== "complete" || available === null || progress === null) {
    const observed = item.observedEpisodeCount;
    return {
      accessibleSuffix: "",
      label: `${observed} observed ${observed === 1 ? "episode" : "episodes"}`,
      progress: null,
    };
  }
  if (available === 0) {
    return {
      accessibleSuffix: ", Not currently available",
      label: "Not currently available",
      progress: null,
    };
  }
  const percent = formatProgressPercent(progress);
  return {
    accessibleSuffix: `, ${item.aggregate.completedEpisodes} of ${available} episodes watched, ${percent} percent`,
    label: `${item.aggregate.completedEpisodes} / ${available} episodes · ${percent}%`,
    progress,
  };
}

export function formatProgressPercent(progress: number): string {
  const bounded = Math.max(0, Math.min(1, progress));
  return bounded > 0 && bounded < 0.01 ? "<1" : String(bounded === 1 ? 100 : Math.min(99, Math.round(bounded * 100)));
}

export function groupWatchHistoryItems(items: WatchHistoryItem[]): PopupProviderGroup[] {
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

export function ProviderLogo({ label, provider }: { label: string; provider: string }) {
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

export function subscribeToPopupWatchHistorySnapshot(
  ownerUserId: string,
  listener: (snapshot: PopupWatchHistorySnapshot | null, refreshResult?: WatchHistoryMessageResponse) => void,
  dependencies: {
    onChanged?: Pick<typeof chrome.storage.onChanged, "addListener" | "removeListener">;
    load?: typeof loadConfirmedPopupWatchHistorySnapshot;
    refresh?: typeof requestWatchHistory;
  } = {},
): () => void {
  let disposed = false;
  let sequence = 0;
  let scheduled = false;
  let refreshing = false;
  let requestedRevision = "";
  let latestRevision = "";
  let needsRefresh = false;
  const onChanged = dependencies.onChanged ?? chrome.storage.onChanged;
  const load = dependencies.load ?? loadConfirmedPopupWatchHistorySnapshot;
  const refresh = dependencies.refresh ?? requestWatchHistory;
  const scheduleRefresh = () => {
    if (disposed || scheduled || refreshing || !needsRefresh || latestRevision === requestedRevision) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (disposed || !needsRefresh) return;
      refreshing = true;
      requestedRevision = latestRevision;
      void (async () => {
        let result: WatchHistoryMessageResponse;
        try { result = await refresh(createListWatchHistoryMessage({ limit: 100 })); }
        catch { result = { ok: false, status: "retryable" }; }
        const currentSequence = ++sequence;
        const snapshot = await load(ownerUserId).catch(() => null);
        // A newer storage notification can retire this snapshot, not the
        // completed request's outcome (which clears a recovered read error).
        if (!disposed) listener(currentSequence === sequence ? snapshot : null, result);
      })().finally(() => {
        refreshing = false;
        // At most one follow-up for mutations received during this request.
        // A failed revision is retried by a new mutation or the user's Retry,
        // never by a timer or by our own cache write notifications.
        scheduleRefresh();
      });
    });
  };
  const handleStorageChange = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ) => {
    if (disposed || areaName !== "local" || !changes[WATCH_HISTORY_STORAGE_KEY]) return;
    const root = changes[WATCH_HISTORY_STORAGE_KEY].newValue as WatchHistoryStorageRoot | undefined;
    const generation = root?.schemaVersion === 3 ? root.activeGenerations?.[ownerUserId] : undefined;
    const partition = generation === undefined ? undefined : root?.partitions?.[watchHistoryPartitionKey(ownerUserId, generation)];
    const invalidation = partition?.invalidationRevision ?? 0;
    latestRevision = `${generation}:${invalidation}`;
    needsRefresh = partition?.ownerUserId === ownerUserId && invalidation > (partition.cacheRevision ?? 0);
    scheduleRefresh();
    const currentSequence = ++sequence;
    void load(ownerUserId)
      .then((snapshot) => {
        if (!disposed && currentSequence === sequence) listener(snapshot);
      })
      .catch(() => undefined);
  };
  onChanged.addListener(handleStorageChange);
  return () => {
    disposed = true;
    sequence += 1;
    onChanged.removeListener(handleStorageChange);
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
  const parsed = WatchHistoryResponseSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
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

export function latestPendingByEpisode(events: WatchProgressEvent[]): Map<string, WatchProgressEvent> {
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

export function reconcilePopupPendingEvents(
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

export function pendingEpisodeKey(provider: string, titleKey: string, episodeKey: string): string {
  return `${provider}\u0000${titleKey}\u0000${episodeKey}`;
}

export function pendingTitleKey(provider: string, titleKey: string): string {
  return `${provider}\u0000${titleKey}`;
}

export function formatClock(seconds: number): string {
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value / 3_600);
  const minutes = Math.floor((value % 3_600) / 60);
  const rest = value % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
    : `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function withRoomHash(sourceUrl: string, roomId: string): string {
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
