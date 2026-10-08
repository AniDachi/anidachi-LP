import type { Metadata } from "next";
import { headers } from "next/headers";
import { getSession, requireAuth } from "@/lib/anidachi-auth/session";
import {
  getRoomById,
  getUserById,
  getRoomMemberCount,
  isRoomMember,
} from "@/lib/anidachi-auth/db";
import { AuthPageCard, AuthPageShell } from "@/components/auth-page-shell";
import { Button } from "@/components/ui/button";
import { AnidachiLogo } from "@/components/anidachi-logo";
import { ExtensionCheck } from "./extension-check";
import { RoomMobileHandoff } from "./room-mobile-handoff";
import { WaitingRefresh } from "./waiting-refresh";
import {
  buildRoomSourceLaunchUrl,
  deriveDurableRoomSource,
} from "@/lib/anidachi-auth/room-source";
import { isMobileUserAgent } from "@/lib/mobile-user-agent";

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

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <AuthPageShell maxWidth="max-w-md">
      <AuthPageCard>
        <div className="mb-6 flex justify-center">
          <AnidachiLogo size={48} />
        </div>
        {children}
      </AuthPageCard>
    </AuthPageShell>
  );
}

export default async function RoomPage({ params, searchParams }: Props) {
  const { roomId } = await params;
  const { joined } = await searchParams;
  const initialMobile = isMobileUserAgent((await headers()).get("user-agent"));

  await requireAuth(`/room/${roomId}`);
  const session = await getSession();

  const room = await getRoomById(roomId);

  // Ended (or missing) rooms get a friendly terminal state, not a bare 404.
  if (!room || room.status === "ended") {
    return (
      <Shell>
        <div className="mb-1 flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-ani-muted" />
          <span className="text-xs font-medium tracking-[-0.01em] text-ani-muted">
            Ended
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-ani-text">This watchroom has ended</h1>
        <p className="mt-2 text-sm text-ani-muted">
          The host closed this room. Ask them for a fresh invite link, or start your own
          watch party from the AniDachi extension on any supported video page.
        </p>
        <Button variant="cream" size="control" className="mt-6 w-full" asChild>
          <a href="https://www.anidachi.app">Back to AniDachi</a>
        </Button>
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
  const source = deriveDurableRoomSource(room);
  const launchUrl = source
    ? buildRoomSourceLaunchUrl(source.source, roomId)
    : null;
  const roomTitle = room.title ?? room.show_id ?? "Anime Watchroom";
  const justJoined = joined === "1";

  // Joined, but the host has not opened a video yet: keep the guest informed
  // and auto-upgrade to "Open watchroom" once a source URL appears.
  if (isParticipant && !launchUrl) {
    return (
      <Shell>
        <div className="mb-1 flex items-center gap-2">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-brand-orange" />
          <span className="text-xs font-medium tracking-[-0.01em] text-ani-muted">
            Waiting for host
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-ani-text">
          {justJoined ? "You're in!" : roomTitle}
        </h1>
        <p className="mt-2 text-sm text-ani-muted">
          The host hasn&apos;t opened a video yet. Keep this tab open — it updates
          automatically the moment the watch party starts.
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-ani-muted">
          <span>
            Host:{" "}
            <span className="font-medium text-ani-text">
              {host?.display_name ?? "Unknown"}
            </span>
          </span>
          <span>
            Members: <span className="font-medium text-ani-text">{memberCount}</span>
          </span>
        </div>
        <ExtensionCheck initialMobile={initialMobile} />
        <RoomMobileHandoff variant="waiting" initialMobile={initialMobile} />
        <WaitingRefresh roomId={roomId} />
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
            room.status === "live" ? "bg-brand-orange" : "bg-brand-orange/50"
          }`}
        />
        <span className="text-xs font-medium tracking-[-0.01em] text-ani-muted">
          {room.status === "live" ? "Live" : "Lobby"}
        </span>
      </div>

      <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-ani-text">{roomTitle}</h1>
      {roomSubtitle && <p className="mt-1 text-sm text-ani-muted">{roomSubtitle}</p>}

      <div className="mt-4 flex flex-wrap gap-4 text-sm text-ani-muted">
        <span>
          Host:{" "}
          <span className="font-medium text-ani-text">{host?.display_name ?? "Unknown"}</span>
        </span>
        <span>
          Members: <span className="font-medium text-ani-text">{memberCount}</span>
        </span>
      </div>

      <form action={`/api/rooms/${roomId}/join`} method="POST" className="mt-6">
        <Button type="submit" variant="cream" size="control" className="w-full">
          {ctaLabel}
        </Button>
      </form>

      <RoomMobileHandoff
        variant={isParticipant && launchUrl ? "joined" : "ready"}
        initialMobile={initialMobile}
      />

      {isParticipant && launchUrl && (
        <p className="mt-3 text-center text-xs text-ani-muted">
          You&apos;re already in this room — opening it relaunches your video tab.
        </p>
      )}

      <ExtensionCheck initialMobile={initialMobile} />
    </Shell>
  );
}
