export type ResourceProvider = "crunchyroll" | "netflix" | "youtube" | "amazon";

export type WatchProgressKind = "movie" | "episode";

export interface WatchProgressEntry {
  provider: ResourceProvider;
  kind: WatchProgressKind;
  itemId: string;
  itemTitle: string;
  contentId?: string;
  seriesId?: string;
  episodeId?: string;
  episodeTitle?: string;
  artworkUrl?: string;
  sourceUrl: string;
  currentTime: number;
  duration: number;
  roomId?: string;
  watchedWithCount: number;
}

export interface StoredEpisodeProgress {
  id: string;
  title: string;
  sourceUrl: string;
  currentTime: number;
  duration: number;
  progress: number;
  lastRoomId?: string;
  watchedWithCount: number;
  lastWatchedAt: number;
}

export interface StoredWatchItem {
  id: string;
  kind: "movie" | "series";
  title: string;
  provider: ResourceProvider;
  contentId?: string;
  seriesId?: string;
  artworkUrl?: string;
  sourceUrl: string;
  currentTime: number;
  duration: number;
  progress: number;
  lastRoomId?: string;
  watchedWithCount: number;
  lastWatchedAt: number;
  episodes?: Record<string, StoredEpisodeProgress>;
}

export interface WatchProgressStore {
  version: 1;
  providers: Record<ResourceProvider, { items: Record<string, StoredWatchItem> }>;
}

export interface ProviderFolder {
  provider: ResourceProvider;
  label: string;
  items: StoredWatchItem[];
}

export const WATCH_PROGRESS_STORAGE_KEY = "anidachi.watchProgress.v1";
const WATCH_PROGRESS_RESET_STORAGE_KEY = "anidachi.watchProgress.reset.crunchyroll-regroup.v1";

export const RESOURCE_PROVIDER_LABELS: Record<ResourceProvider, string> = {
  crunchyroll: "Crunchyroll",
  netflix: "Netflix",
  youtube: "YouTube",
  amazon: "Amazon",
};

const RESOURCE_PROVIDER_ORDER: ResourceProvider[] = ["crunchyroll", "netflix", "youtube", "amazon"];

export function createEmptyWatchProgressStore(): WatchProgressStore {
  return {
    version: 1,
    providers: {
      crunchyroll: { items: {} },
      netflix: { items: {} },
      youtube: { items: {} },
      amazon: { items: {} },
    },
  };
}

export function recordWatchProgressInStore(
  store: WatchProgressStore,
  entry: WatchProgressEntry,
  now = Date.now(),
): WatchProgressStore {
  const currentTime = clampTime(entry.currentTime, entry.duration);
  const duration = normalizeDuration(entry.duration);
  const progress = getProgress(currentTime, duration);
  const provider = store.providers[entry.provider] ?? { items: {} };
  const previous = provider.items[entry.itemId];
  const lastRoomId = entry.roomId || previous?.lastRoomId;
  const providerItems = { ...provider.items };

  if (entry.kind === "episode" && entry.provider === "crunchyroll" && entry.episodeId) {
    delete providerItems[`crunchyroll-movie:${entry.episodeId}`];
  }

  const nextItem: StoredWatchItem = {
    id: entry.itemId,
    kind: entry.kind === "episode" ? "series" : "movie",
    title: entry.itemTitle,
    provider: entry.provider,
    ...(entry.contentId || previous?.contentId
      ? { contentId: entry.contentId ?? previous?.contentId }
      : {}),
    ...(entry.seriesId || previous?.seriesId
      ? { seriesId: entry.seriesId ?? previous?.seriesId }
      : {}),
    ...getArtworkForStoredItem(entry, previous),
    sourceUrl: entry.sourceUrl,
    currentTime,
    duration,
    progress,
    ...(lastRoomId ? { lastRoomId } : {}),
    watchedWithCount: entry.watchedWithCount,
    lastWatchedAt: now,
    ...(previous?.episodes ? { episodes: { ...previous.episodes } } : {}),
  };

  if (entry.kind === "episode") {
    const episodeId = entry.episodeId ?? entry.itemId;
    const episodes = nextItem.episodes ?? {};
    episodes[episodeId] = {
      id: episodeId,
      title: entry.episodeTitle ?? entry.itemTitle,
      sourceUrl: entry.sourceUrl,
      currentTime,
      duration,
      progress,
      ...(lastRoomId ? { lastRoomId } : {}),
      watchedWithCount: entry.watchedWithCount,
      lastWatchedAt: now,
    };
    nextItem.episodes = episodes;
    nextItem.progress = averageProgress(Object.values(episodes));
  }

  return {
    version: 1,
    providers: {
      ...store.providers,
      [entry.provider]: {
        items: {
          ...providerItems,
          [entry.itemId]: nextItem,
        },
      },
    },
  };
}

export function getStoredItemForEntry(
  store: WatchProgressStore,
  entry: WatchProgressEntry | null,
): StoredWatchItem | null {
  if (!entry) {
    return null;
  }

  return store.providers[entry.provider]?.items[entry.itemId] ?? null;
}

export function buildProviderFolders(store: WatchProgressStore): ProviderFolder[] {
  return RESOURCE_PROVIDER_ORDER.map((provider) => ({
    provider,
    label: RESOURCE_PROVIDER_LABELS[provider],
    items: Object.values(store.providers[provider]?.items ?? {}).sort(
      (a, b) => b.lastWatchedAt - a.lastWatchedAt,
    ),
  }));
}

export async function loadWatchProgressStore(): Promise<WatchProgressStore> {
  await clearLegacyWatchProgressIfNeeded();
  const raw = await chrome.storage.local.get(WATCH_PROGRESS_STORAGE_KEY);
  return normalizeWatchProgressStore(raw[WATCH_PROGRESS_STORAGE_KEY]);
}

export async function saveWatchProgressStore(store: WatchProgressStore): Promise<void> {
  await chrome.storage.local.set({ [WATCH_PROGRESS_STORAGE_KEY]: store });
}

export async function recordWatchProgress(entry: WatchProgressEntry): Promise<WatchProgressStore> {
  const store = await loadWatchProgressStore();
  const next = recordWatchProgressInStore(store, entry);
  await saveWatchProgressStore(next);
  return next;
}

export function normalizeWatchProgressStore(value: unknown): WatchProgressStore {
  const empty = createEmptyWatchProgressStore();
  if (!value || typeof value !== "object") {
    return empty;
  }

  const candidate = value as Partial<WatchProgressStore>;
  return {
    version: 1,
    providers: {
      crunchyroll: normalizeProvider(
        candidate.providers?.crunchyroll,
        empty.providers.crunchyroll,
        "crunchyroll",
      ),
      netflix: normalizeProvider(candidate.providers?.netflix, empty.providers.netflix, "netflix"),
      youtube: normalizeProvider(candidate.providers?.youtube, empty.providers.youtube, "youtube"),
      amazon: normalizeProvider(candidate.providers?.amazon, empty.providers.amazon, "amazon"),
    },
  };
}

async function clearLegacyWatchProgressIfNeeded(): Promise<void> {
  const marker = await chrome.storage.local.get(WATCH_PROGRESS_RESET_STORAGE_KEY);
  if (marker[WATCH_PROGRESS_RESET_STORAGE_KEY]) {
    return;
  }

  await chrome.storage.local.remove(WATCH_PROGRESS_STORAGE_KEY);
  await chrome.storage.local.set({ [WATCH_PROGRESS_RESET_STORAGE_KEY]: Date.now() });
}

export function formatProgressClock(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const rest = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${rest.toString().padStart(2, "0")}`;
  }

  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

function normalizeProvider(
  provider: { items?: Record<string, StoredWatchItem> } | undefined,
  fallback: { items: Record<string, StoredWatchItem> },
  providerId: ResourceProvider,
): { items: Record<string, StoredWatchItem> } {
  if (!provider || typeof provider !== "object" || !provider.items) {
    return fallback;
  }

  const items: Record<string, StoredWatchItem> = {};
  for (const item of Object.values(provider.items)) {
    const normalized = normalizeStoredWatchItem(item, providerId);
    const existing = items[normalized.id];
    items[normalized.id] = existing ? mergeStoredWatchItems(existing, normalized) : normalized;
  }

  return { items };
}

function normalizeStoredWatchItem(
  item: StoredWatchItem,
  provider: ResourceProvider,
): StoredWatchItem {
  if (provider !== "crunchyroll" || item.kind !== "series") {
    return item;
  }

  const seriesInfo = getCrunchyrollSeriesUrlInfo(item.title);
  if (!seriesInfo) {
    return item;
  }
  const seriesSlug = slugify(seriesInfo.slug) || seriesInfo.slug;

  return {
    ...item,
    id: `crunchyroll-series:${seriesSlug}`,
    seriesId: seriesInfo.seriesId,
    title: toTitle(seriesInfo.slug),
    ...getArtworkForNormalizedItem(item),
  };
}

function mergeStoredWatchItems(first: StoredWatchItem, second: StoredWatchItem): StoredWatchItem {
  const newest = second.lastWatchedAt >= first.lastWatchedAt ? second : first;
  const oldest = newest === second ? first : second;
  const episodes = { ...oldest.episodes, ...newest.episodes };

  return {
    ...oldest,
    ...newest,
    ...(Object.keys(episodes).length
      ? {
          episodes,
          progress: averageProgress(Object.values(episodes)),
        }
      : {}),
    ...getArtworkForMergedItem(newest.artworkUrl, oldest.artworkUrl),
    contentId: newest.contentId ?? oldest.contentId,
    seriesId: newest.seriesId ?? oldest.seriesId,
  };
}

function getCrunchyrollSeriesUrlInfo(value: string): { seriesId: string; slug: string } | null {
  const match = value.match(/\/series\/([^/?#]+)\/?([^/?#]*)?/);
  if (!match?.[1]) {
    return null;
  }

  return {
    seriesId: match[1],
    slug: match[2] || match[1],
  };
}

function getArtworkForStoredItem(
  entry: WatchProgressEntry,
  previous: StoredWatchItem | undefined,
): Pick<StoredWatchItem, "artworkUrl"> {
  const artworkUrl = entry.artworkUrl ?? getReusableArtworkUrl(previous?.artworkUrl);
  return artworkUrl ? { artworkUrl } : {};
}

function getArtworkForNormalizedItem(item: StoredWatchItem): Pick<StoredWatchItem, "artworkUrl"> {
  const artworkUrl = getReusableArtworkUrl(item.artworkUrl);
  return artworkUrl ? { artworkUrl } : {};
}

function getArtworkForMergedItem(
  newestArtworkUrl: string | undefined,
  oldestArtworkUrl: string | undefined,
): Pick<StoredWatchItem, "artworkUrl"> {
  const artworkUrl =
    getReusableArtworkUrl(newestArtworkUrl) ?? getReusableArtworkUrl(oldestArtworkUrl);
  return artworkUrl ? { artworkUrl } : {};
}

function getReusableArtworkUrl(artworkUrl: string | undefined): string | undefined {
  if (!artworkUrl || isGeneratedCrunchyrollBackdropArtwork(artworkUrl)) {
    return undefined;
  }

  return artworkUrl;
}

function isGeneratedCrunchyrollBackdropArtwork(artworkUrl: string): boolean {
  return /\/keyart\/[^/?#]+-backdrop_wide\b/.test(artworkUrl);
}

function toTitle(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\p{L}/gu, (char) => char.toLocaleUpperCase())
    .trim();
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function clampTime(currentTime: number, duration: number): number {
  if (!Number.isFinite(currentTime)) {
    return 0;
  }

  if (!Number.isFinite(duration) || duration <= 0) {
    return Math.max(0, currentTime);
  }

  return Math.max(0, Math.min(duration, currentTime));
}

function normalizeDuration(duration: number): number {
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

function getProgress(currentTime: number, duration: number): number {
  if (duration <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(1, currentTime / duration));
}

function averageProgress(episodes: StoredEpisodeProgress[]): number {
  if (!episodes.length) {
    return 0;
  }

  return episodes.reduce((sum, episode) => sum + episode.progress, 0) / episodes.length;
}
