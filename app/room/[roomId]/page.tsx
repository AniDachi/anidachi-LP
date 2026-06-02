import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireAuth } from "@/lib/anidachi-auth/session";
import {
  getRoomById,
  getUserById,
  getRoomMemberCount,
} from "@/lib/anidachi-auth/db";
import { AnidachiLogo } from "@/components/anidachi-logo";
import { ExtensionCheck } from "./extension-check";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ roomId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { roomId } = await params;
  return {
    title: `Watchroom ${roomId} — AniDachi`,
    robots: { index: false, follow: false },
  };
}

export default async function RoomPage({ params }: Props) {
  const { roomId } = await params;

  await requireAuth(`/room/${roomId}`);

  const room = await getRoomById(roomId);
  if (!room || room.status === "ended") notFound();

  const [host, memberCount] = await Promise.all([
    getUserById(room.host_user_id),
    getRoomMemberCount(roomId),
  ]);
  const roomTitle = room.title ?? room.show_id ?? "Anime Watchroom";
  const roomSubtitle = room.episode_id ?? (room.source_url ? "Ready to open in your video tab" : null);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-violet-950 via-slate-900 to-slate-950 px-4">
      <div className="mx-auto w-full max-w-md">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-sm">
          <div className="mb-6 flex justify-center">
            <AnidachiLogo size={48} className="ring-2 ring-white/10" />
          </div>
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

          {roomSubtitle && (
            <p className="mt-1 text-sm text-slate-400">{roomSubtitle}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-400">
            <span>
              Host:{" "}
              <span className="font-medium text-slate-200">
                {host?.display_name ?? "Unknown"}
              </span>
            </span>
            <span>
              Members:{" "}
              <span className="font-medium text-slate-200">{memberCount}</span>
            </span>
          </div>

          <form action={`/api/rooms/${roomId}/join`} method="POST" className="mt-6">
            <button
              type="submit"
              className="w-full rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white shadow transition hover:bg-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
            >
              Join room
            </button>
          </form>

          <ExtensionCheck />
        </div>
      </div>
    </main>
  );
}
