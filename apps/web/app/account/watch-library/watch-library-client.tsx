"use client";

import {
  Clock3,
  Film,
  Play,
  RefreshCw,
  Users,
} from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import type {
  WatchLibraryEpisode,
  WatchLibraryItem,
  WatchLibraryResponse,
  WatchLibrarySession,
} from "@/lib/anidachi-auth/watch-library";

type Notice = {
  tone: "success" | "error";
  text: string;
};

type CreatedRoomResponse = {
  roomId: string;
  shareableLink: string;
};

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  plus: "Plus",
  pro: "Pro",
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(path, { ...init, headers });
  const body = (await response.json().catch(() => null)) as
    | T
    | { error?: unknown; message?: unknown }
    | null;
  if (!response.ok) {
    const message =
      body && typeof body === "object"
        ? String(
            (body as { message?: unknown; error?: unknown }).message ??
              (body as { message?: unknown; error?: unknown }).error ??
              `Request failed (${response.status})`
          )
        : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return body as T;
}

export function WatchLibraryClient({
  initialLibrary,
}: {
  initialLibrary: WatchLibraryResponse;
}) {
  const [library, setLibrary] = useState(initialLibrary);
  const [busySessionId, setBusySessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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

      <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-lg font-semibold text-white">Watch Library</h2>
            <p className="mt-1 text-sm text-slate-400">
              {PLAN_LABELS[library.limits.planCode] ?? library.limits.planCode} keeps{" "}
              {library.limits.historyRetentionDays} days of history.
            </p>
          </div>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loading}
            onClick={() => void refresh()}
            type="button"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Refresh
          </button>
        </div>
      </section>

      {notice ? (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            notice.tone === "error"
              ? "border-red-400/25 bg-red-500/10 text-red-100"
              : "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
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
        <section className="rounded-lg border border-white/10 bg-white/[0.04] p-6 text-sm text-slate-400">
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
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/15 text-violet-200">
          {icon}
        </span>
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-sm text-slate-400">{label}</p>
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
  return (
    <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
      <div className="flex items-center gap-4 border-b border-white/10 p-4">
        <Poster item={item} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-300">
            {providerLabel(item.provider)} · {item.itemKind}
          </p>
          <h3 className="mt-1 truncate text-lg font-bold text-white">{item.itemTitle}</h3>
          <p className="mt-1 text-sm text-slate-400">
            Last watched {formatDate(item.lastWatchedAt)}
          </p>
        </div>
      </div>

      <div className="divide-y divide-white/10">
        {item.episodes.map((episode) => (
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
        <p className="truncate text-sm font-semibold text-white">{episode.episodeTitle}</p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
          <span
            className="block h-full rounded-full bg-gradient-to-r from-violet-400 to-blue-400"
            style={{ width: `${Math.round(clampProgress(episode.progress) * 100)}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">
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
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-violet-500 px-4 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
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
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
      <Users className="h-3.5 w-3.5 text-violet-200" aria-hidden />
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
    <span className="flex h-16 w-11 shrink-0 items-center justify-center rounded-md bg-white/10 text-slate-400">
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
