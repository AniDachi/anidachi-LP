"use client";

import {
  Clock3,
  Film,
  Play,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import type {
  WatchLibraryEpisode,
  WatchLibraryItem,
  WatchLibraryResponse,
  WatchLibrarySession,
} from "@/lib/anidachi-auth/watch-library";
import { api } from "@/lib/client-api";
import {
  inferCrunchyrollSeasonFromSourceUrl,
  inferSeasonNumberFromTitle,
} from "@/lib/watch-season-inference";

type Notice = {
  tone: "success" | "error";
  text: string;
};

type CreatedRoomResponse = {
  roomId: string;
  shareableLink: string;
};

type EpisodeSeasonGroup = {
  key: string;
  title: string;
  known: boolean;
  sortNumber: number | null;
  latestWatchedAt: string;
  episodes: WatchLibraryEpisode[];
};

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  plus: "Plus",
  pro: "Pro",
};

export function WatchLibraryClient({
  initialLibrary,
}: {
  initialLibrary: WatchLibraryResponse;
}) {
  const [library, setLibrary] = useState(initialLibrary);
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const episodeCount = useMemo(
    () => library.items.reduce((sum, item) => sum + item.episodes.length, 0),
    [library.items],
  );
  const sharedSessionCount = useMemo(
    () =>
      library.items.reduce(
        (sum, item) =>
          sum +
          item.episodes.reduce(
            (episodeSum, episode) =>
              episodeSum + episode.sessions.filter((session) => session.kind === "shared").length,
            0,
          ),
        0,
      ),
    [library.items],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      setLibrary(await api<WatchLibraryResponse>("/api/watch-library"));
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not refresh watch library",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const clearHistory = useCallback(async () => {
    if (!library.items.length || clearing) return;
    const confirmed = window.confirm("Clear your AniDachi watch history?");
    if (!confirmed) return;

    setClearing(true);
    setNotice(null);
    try {
      setLibrary(await api<WatchLibraryResponse>("/api/watch-library", { method: "DELETE" }));
      setNotice({ tone: "success", text: "Watch history cleared." });
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not clear watch library",
      });
    } finally {
      setClearing(false);
    }
  }, [clearing, library.items.length]);

  const createRoom = useCallback(async (session: WatchLibrarySession, sourceUrl: string) => {
    setBusySessionId(session.id);
    setNotice(null);
    try {
      const room = await api<CreatedRoomResponse>("/api/watch-library/rooms", {
        method: "POST",
        body: JSON.stringify({
          sessionId: session.id,
          clientRequestId: `watch-library:${session.id}:${Date.now()}`,
        }),
      });
      window.location.assign(buildLaunchUrl(sourceUrl, room.roomId));
    } catch (error) {
      setNotice({
        tone: "error",
        text: error instanceof Error ? error.message : "Could not create room",
      });
    } finally {
      setBusySessionId(null);
    }
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={<Film className="h-5 w-5" aria-hidden />}
          label="Tracked titles"
          value={`${library.limits.activeTrackedTitleCount}/${library.limits.maxActiveTrackedTitles}`}
        />
        <StatCard
          icon={<Clock3 className="h-5 w-5" aria-hidden />}
          label="Episodes"
          value={episodeCount}
        />
        <StatCard
          icon={<Users className="h-5 w-5" aria-hidden />}
          label="Shared sessions"
          value={sharedSessionCount}
        />
      </section>

      <section className="rounded-lg border border-brand-border bg-brand-surface p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Watch Library</h2>
            <p className="mt-1 text-sm text-foreground/50">
              {PLAN_LABELS[library.limits.planCode] ?? library.limits.planCode} keeps{" "}
              {library.limits.historyRetentionDays} days of history.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-brand-border bg-brand-surface px-4 text-sm font-semibold text-foreground transition hover:bg-brand-orange/20 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={loading || clearing}
              onClick={() => void refresh()}
              type="button"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              Refresh
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-400/25 bg-red-500/10 px-4 text-sm font-semibold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={clearing || !library.items.length}
              onClick={() => void clearHistory()}
              type="button"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
              {clearing ? "Clearing..." : "Clear history"}
            </button>
          </div>
        </div>
      </section>

      {notice ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            notice.tone === "error"
              ? "border-red-400/25 bg-red-500/10 text-red-100"
              : "border-brand-orange/25 bg-brand-orange/10 text-brand-orange"
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      {library.items.length ? (
        <div className="grid gap-4">
          {library.items.map((item) => (
            <WatchItemCard
              busySessionId={busySessionId}
              item={item}
              key={`${item.provider}:${item.itemKey}`}
              onCreateRoom={createRoom}
            />
          ))}
        </div>
      ) : (
        <section className="rounded-lg border border-brand-border bg-brand-surface p-6 text-sm text-foreground/50">
          Progress will appear here after you watch from the extension while signed in.
        </section>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-brand-border bg-brand-surface p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-orange/15 text-brand-orange">
          {icon}
        </span>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-sm text-foreground/50">{label}</p>
        </div>
      </div>
    </div>
  );
}

function WatchItemCard({
  busySessionId,
  item,
  onCreateRoom,
}: {
  busySessionId: string | null;
  item: WatchLibraryItem;
  onCreateRoom: (session: WatchLibrarySession, sourceUrl: string) => void;
}) {
  const episodesByDisplayOrder = useMemo(
    () => [...item.episodes].sort(compareEpisodesByDisplayOrder),
    [item.episodes],
  );
  const seasonGroups = useMemo(
    () => buildEpisodeSeasonGroups(episodesByDisplayOrder, item.itemTitle),
    [episodesByDisplayOrder, item.itemTitle],
  );
  const showSeasonGroups =
    item.itemKind === "series" && (seasonGroups.length > 1 || seasonGroups.some((group) => group.known));

  return (
    <section className="overflow-hidden rounded-lg border border-brand-border bg-brand-surface">
      <div className="flex items-center gap-4 border-b border-brand-border p-4">
        <Poster item={item} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-orange">
            {providerLabel(item.provider)} · {item.itemKind}
          </p>
          <h3 className="mt-1 truncate text-lg font-bold text-foreground">{item.itemTitle}</h3>
          <p className="mt-1 text-sm text-foreground/50">
            Last watched {formatDate(item.lastWatchedAt)}
          </p>
        </div>
      </div>

      {showSeasonGroups ? (
        <div className="divide-y divide-brand-border/70">
          {seasonGroups.map((group) => (
            <SeasonGroup
              busySessionId={busySessionId}
              group={group}
              key={group.key}
              onCreateRoom={onCreateRoom}
            />
          ))}
        </div>
      ) : (
        <div className="divide-y divide-brand-border/70">
          {episodesByDisplayOrder.map((episode) => (
            <EpisodeRow
              busySessionId={busySessionId}
              episode={episode}
              key={episode.episodeKey}
              onCreateRoom={onCreateRoom}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SeasonGroup({
  busySessionId,
  group,
  onCreateRoom,
}: {
  busySessionId: string | null;
  group: EpisodeSeasonGroup;
  onCreateRoom: (session: WatchLibrarySession, sourceUrl: string) => void;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-4 border-b border-brand-border/50 bg-white/[0.025] px-4 py-3">
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-brand-orange">{group.title}</h4>
          <p className="mt-0.5 text-xs text-foreground/45">
            {formatEpisodeCount(group.episodes.length)} · latest {formatDate(group.latestWatchedAt)}
          </p>
        </div>
      </div>
      <div className="divide-y divide-brand-border/50">
        {group.episodes.map((episode) => (
          <EpisodeRow
            busySessionId={busySessionId}
            episode={episode}
            key={episode.episodeKey}
            onCreateRoom={onCreateRoom}
          />
        ))}
      </div>
    </section>
  );
}

function EpisodeRow({
  busySessionId,
  episode,
  onCreateRoom,
}: {
  busySessionId: string | null;
  episode: WatchLibraryEpisode;
  onCreateRoom: (session: WatchLibrarySession, sourceUrl: string) => void;
}) {
  const latestSession = episode.sessions[0] ?? null;
  return (
    <div className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{episode.episodeTitle}</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-surface">
          <span
            className="block h-full rounded-full bg-gradient-to-r from-brand-orange to-brand-orange-bright"
            style={{ width: `${Math.round(clampProgress(episode.progress) * 100)}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-foreground/50">
          {formatClock(episode.currentTime)} / {formatClock(episode.duration)} ·{" "}
          {formatDate(episode.lastWatchedAt)}
        </p>
        {episode.sessions.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {episode.sessions.slice(0, 4).map((session) => (
              <SessionPill key={session.id} session={session} />
            ))}
          </div>
        ) : null}
      </div>

      <button
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-orange px-4 text-sm font-semibold text-foreground transition hover:bg-brand-orange-deep disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!latestSession || busySessionId === latestSession.id}
        onClick={() => latestSession && onCreateRoom(latestSession, episode.sourceUrl)}
        type="button"
      >
        <Play className="h-4 w-4" aria-hidden />
        {latestSession && busySessionId === latestSession.id ? "Creating..." : "Create room"}
      </button>
    </div>
  );
}

function SessionPill({ session }: { session: WatchLibrarySession }) {
  const label =
    session.kind === "shared"
      ? `${session.participants.length} people`
      : "Solo";
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-brand-border bg-brand-orange/5 px-3 py-1 text-xs text-foreground/70">
      <Users className="h-3.5 w-3.5 text-brand-orange" aria-hidden />
      {label} · {formatDate(session.lastWatchedAt)}
    </span>
  );
}

function Poster({ item }: { item: WatchLibraryItem }) {
  if (item.artworkUrl) {
    return (
      <img
        alt=""
        className="h-16 w-11 shrink-0 rounded-md object-cover"
        src={item.artworkUrl}
      />
    );
  }
  return (
    <span className="flex h-16 w-11 shrink-0 items-center justify-center rounded-md bg-brand-surface text-foreground/50">
      <Film className="h-5 w-5" aria-hidden />
    </span>
  );
}

function providerLabel(provider: string): string {
  if (provider === "crunchyroll") return "Crunchyroll";
  if (provider === "netflix") return "Netflix";
  if (provider === "youtube") return "YouTube";
  if (provider === "amazon") return "Amazon";
  return provider;
}

function buildEpisodeSeasonGroups(episodes: WatchLibraryEpisode[], itemTitle: string): EpisodeSeasonGroup[] {
  const groups = new Map<string, EpisodeSeasonGroup>();
  for (const episode of episodes) {
    const key = episodeSeasonKey(episode, itemTitle);
    const existing = groups.get(key);
    if (existing) {
      existing.episodes.push(episode);
      if (episode.lastWatchedAt > existing.latestWatchedAt) {
        existing.latestWatchedAt = episode.lastWatchedAt;
      }
      continue;
    }

    groups.set(key, {
      key,
      title: episodeSeasonTitle(episode, itemTitle),
      known: hasEpisodeSeason(episode, itemTitle),
      sortNumber:
        preferredEpisodeSeason(episode, itemTitle)?.seasonNumber ??
        normalizedEpisodeSeasonNumber(episode, itemTitle) ??
        getEpisodeSeasonNumber(episode.episodeTitle),
      latestWatchedAt: episode.lastWatchedAt,
      episodes: [episode],
    });
  }

  return Array.from(groups.values()).sort(compareSeasonGroups);
}

function compareSeasonGroups(a: EpisodeSeasonGroup, b: EpisodeSeasonGroup): number {
  if (a.known !== b.known) return a.known ? -1 : 1;
  if (a.sortNumber !== null && b.sortNumber !== null && a.sortNumber !== b.sortNumber) {
    return a.sortNumber - b.sortNumber;
  }
  if (a.sortNumber !== null && b.sortNumber === null) return -1;
  if (a.sortNumber === null && b.sortNumber !== null) return 1;
  return a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: "base" });
}

function compareEpisodesByDisplayOrder(a: WatchLibraryEpisode, b: WatchLibraryEpisode): number {
  const aNumber = getEpisodeNumber(a.episodeTitle);
  const bNumber = getEpisodeNumber(b.episodeTitle);
  if (aNumber !== null && bNumber !== null && aNumber !== bNumber) return aNumber - bNumber;
  if (aNumber !== null && bNumber === null) return -1;
  if (aNumber === null && bNumber !== null) return 1;
  return a.episodeTitle.localeCompare(b.episodeTitle, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function getEpisodeNumber(title: string): number | null {
  const match =
    title.match(/\bE\s?(\d+)\b/i) ??
    title.match(/\bEpisode\s+(\d+)\b/i) ??
    title.match(/\bСерия\s+(\d+)\b/i) ??
    title.match(/^(\d+)[\s.:-]/);
  if (!match) return null;
  const value = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(value) ? value : null;
}

function episodeSeasonKey(episode: WatchLibraryEpisode, itemTitle: string): string {
  const preferred = preferredEpisodeSeason(episode, itemTitle);
  if (preferred) return preferred.seasonId;
  if (episode.seasonId) return episode.seasonId;
  const normalizedSeasonNumber = normalizedEpisodeSeasonNumber(episode, itemTitle);
  if (normalizedSeasonNumber) return `season-${normalizedSeasonNumber}`;
  const titleSeasonNumber = getEpisodeSeasonNumber(episode.episodeTitle);
  if (titleSeasonNumber) return `season-${titleSeasonNumber}`;
  const normalizedSeasonTitle = normalizedEpisodeSeasonTitle(episode, itemTitle);
  if (normalizedSeasonTitle) return `season:${slugKey(normalizedSeasonTitle)}`;
  return "season:unknown";
}

function episodeSeasonTitle(episode: WatchLibraryEpisode, itemTitle: string): string {
  const preferred = preferredEpisodeSeason(episode, itemTitle);
  if (preferred) return preferred.seasonTitle;
  const normalizedSeasonTitle = normalizedEpisodeSeasonTitle(episode, itemTitle);
  if (normalizedSeasonTitle) return normalizedSeasonTitle;
  const normalizedSeasonNumber = normalizedEpisodeSeasonNumber(episode, itemTitle);
  if (normalizedSeasonNumber) return `Season ${normalizedSeasonNumber}`;
  const titleSeasonNumber = getEpisodeSeasonNumber(episode.episodeTitle);
  if (titleSeasonNumber) return `Season ${titleSeasonNumber}`;
  return "Other episodes";
}

function hasEpisodeSeason(episode: WatchLibraryEpisode, itemTitle: string): boolean {
  return Boolean(
    preferredEpisodeSeason(episode, itemTitle) ||
      episode.seasonId ||
      normalizedEpisodeSeasonTitle(episode, itemTitle) ||
      normalizedEpisodeSeasonNumber(episode, itemTitle) ||
      getEpisodeSeasonNumber(episode.episodeTitle),
  );
}

function preferredEpisodeSeason(episode: WatchLibraryEpisode, itemTitle: string) {
  const inferred = inferredEpisodeSeason(episode);
  if (!inferred) return null;
  const seasonTitle = episode.seasonTitle ?? null;
  if (!seasonTitle || isPlaceholderSeasonTitle(seasonTitle) || sameNormalizedTitle(seasonTitle, itemTitle)) {
    return inferred;
  }
  return null;
}

function normalizedEpisodeSeasonTitle(episode: WatchLibraryEpisode, itemTitle: string): string | null {
  const seasonTitle = episode.seasonTitle?.trim() || null;
  if (!seasonTitle || isPlaceholderSeasonTitle(seasonTitle) || sameNormalizedTitle(seasonTitle, itemTitle)) {
    return null;
  }
  return seasonTitle;
}

function normalizedEpisodeSeasonNumber(episode: WatchLibraryEpisode, itemTitle: string): number | null {
  const seasonTitle = episode.seasonTitle ?? null;
  if (seasonTitle && (isPlaceholderSeasonTitle(seasonTitle) || sameNormalizedTitle(seasonTitle, itemTitle))) {
    return null;
  }
  return episode.seasonNumber ?? null;
}

function inferredEpisodeSeason(episode: WatchLibraryEpisode) {
  return inferCrunchyrollSeasonFromSourceUrl(episode.sourceUrl);
}

function isPlaceholderSeasonTitle(title: string): boolean {
  const normalized = title.trim().toLowerCase();
  return normalized === "?" || normalized === "unknown" || normalized === "n/a" || normalized === "na";
}

function sameNormalizedTitle(a: string, b: string): boolean {
  return normalizeComparableTitle(a) === normalizeComparableTitle(b);
}

function normalizeComparableTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\W_]+/g, " ")
    .trim();
}

function formatEpisodeCount(count: number): string {
  return `${count} ${count === 1 ? "episode" : "episodes"}`;
}

function slugKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function getEpisodeSeasonNumber(title: string): number | null {
  return inferSeasonNumberFromTitle(title);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatClock(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const rest = safeSeconds % 60;
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${rest.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.max(0, Math.min(1, progress));
}

function buildLaunchUrl(sourceUrl: string, roomId: string): string {
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Unsupported URL");
    }
    const params = new URLSearchParams(url.hash.replace(/^#/, ""));
    params.set("anidachiRoom", roomId);
    url.hash = params.toString();
    return url.toString();
  } catch {
    return `/room/${encodeURIComponent(roomId)}`;
  }
}
