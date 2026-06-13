import type { Metadata } from "next";
import { getSession, requireAuth } from "@/lib/anidachi-auth/session";
import {
  getRoomById,
  getUserById,
  getRoomMemberCount,
  isRoomMember,
} from "@/lib/anidachi-auth/db";
import { AnidachiLogo } from "@/components/anidachi-logo";
import { ExtensionCheck } from "./extension-check";
import { WaitingRefresh } from "./waiting-refresh";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ joined?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { roomId } = await params;
  return {
    title: `Watchroom ${roomId} — AniDachi`,
    robots: { index: false, follow: false },
  };
}

function buildLaunchUrl(sourceUrl: string, roomId: string): string | null {
  try {
    const url = new URL(sourceUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    const params = new URLSearchParams(url.hash.replace(/^#/, ""));
    params.set("anidachiRoom", roomId);
    url.hash = params.toString();
    return url.toString();
  } catch {
    return null;
  }
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-950 via-slate-900 to-slate-950 px-4">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-sm">
          <div className="mb-6 flex justify-center">
            <AnidachiLogo size={48} className="ring-2 ring-white/10" />
          </div>
          {children}
        </div>
      </div>
    </main>
  );
}

export default async function RoomPage({ params, searchParams }: Props) {
  const { roomId } = await params;
  const { joined } = await searchParams;

  await requireAuth(`/room/${roomId}`);
  const session = await getSession();

  const room = await getRoomById(roomId);

  // Ended (or missing) rooms get a friendly terminal state, not a bare 404.
  if (!room || room.status === "ended") {
    return (
      <Shell>
        <div className="mb-1 flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-slate-500" />
          <span className="text-xs font-medium uppercase tracking-widest text-slate-400">
            Ended
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-bold text-white">This watchroom has ended</h1>
        <p className="mt-2 text-sm text-slate-400">
          The host closed this room. Ask them for a fresh invite link, or start your own
          watch party from the AniDachi extension on any supported video page.
        </p>
        <a
          href="https://www.anidachi.app"
          className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
        >
          Back to AniDachi
        </a>
      </Shell>
    );
  }

  const [host, memberCount, alreadyMember] = await Promise.all([
    getUserById(room.host_user_id),
    getRoomMemberCount(roomId),
    session ? isRoomMember(roomId, session.userId) : Promise.resolve(false),
  ]);

  const isHost = session?.userId === room.host_user_id;
  const isParticipant = isHost || alreadyMember;
  const launchUrl = room.source_url ? buildLaunchUrl(room.source_url, roomId) : null;
  const roomTitle = room.title ?? room.show_id ?? "Anime Watchroom";
  const justJoined = joined === "1";

  // Joined, but the host has not opened a video yet: keep the guest informed
  // and auto-upgrade to "Open watchroom" once a source URL appears.
  if (isParticipant && !launchUrl) {
    return (
      <Shell>
        <div className="mb-1 flex items-center gap-2">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />
          <span className="text-xs font-medium uppercase tracking-widest text-slate-400">
            Waiting for host
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-bold text-white">
          {justJoined ? "You're in!" : roomTitle}
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          The host hasn&apos;t opened a video yet. Keep this tab open — it updates
          automatically the moment the watch party starts.
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-400">
          <span>
            Host:{" "}
            <span className="font-medium text-slate-200">
              {host?.display_name ?? "Unknown"}
            </span>
          </span>
          <span>
            Members: <span className="font-medium text-slate-200">{memberCount}</span>
          </span>
        </div>
        <ExtensionCheck />
        <WaitingRefresh />
      </Shell>
    );
  }

  const ctaLabel = launchUrl ? "Open watchroom" : "Join room";
  const roomSubtitle = room.episode_id ?? (launchUrl ? "Ready to open in your video tab" : null);

  return (
    <Shell>
      <div className="mb-1 flex items-center gap-2">
        <span
          className={`inline-block h-2 w-2 rounded-full ${
            room.status === "live" ? "bg-emerald-400" : "bg-amber-400"
          }`}
        />
        <span className="text-xs font-medium uppercase tracking-widest text-slate-400">
          {room.status === "live" ? "Live" : "Lobby"}
        </span>
      </div>

      <h1 className="mt-3 text-2xl font-bold text-white">{roomTitle}</h1>
      {roomSubtitle && <p className="mt-1 text-sm text-slate-400">{roomSubtitle}</p>}

      <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-400">
        <span>
          Host:{" "}
          <span className="font-medium text-slate-200">{host?.display_name ?? "Unknown"}</span>
        </span>
        <span>
          Members: <span className="font-medium text-slate-200">{memberCount}</span>
        </span>
      </div>

      <form action={`/api/rooms/${roomId}/join`} method="POST" className="mt-6">
        <button
          type="submit"
          className="w-full rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow transition hover:bg-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
        >
          {ctaLabel}
        </button>
      </form>

      {isParticipant && launchUrl && (
        <p className="mt-3 text-center text-xs text-slate-500">
          You&apos;re already in this room — opening it relaunches your video tab.
        </p>
      )}

      <ExtensionCheck />
    </Shell>
  );
}
