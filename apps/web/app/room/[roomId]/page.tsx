import { roomTicketDetails } from "@/lib/room-ticket";
import { InviteTicket } from "@/components/invite-ticket";
import ticket from "@/components/invite-ticket.module.css";
import { roomLobbyDestination } from "@/lib/room-lobby";
import type { Metadata } from "next";
import { TrackOnView } from "@/components/track-on-view";
import { headers } from "next/headers";
import { getSession, requireAuth } from "@/lib/anidachi-auth/session";
import {
  getRoomById,
  getUserById,
  isRoomMember,
} from "@/lib/anidachi-auth/db";
import { RoomInviteShell as Shell, RoomInviteView } from "./room-invite-view";
import { Button } from "@/components/ui/button";
import { RoomInviteExtensionStep } from "@/components/room-invite-extension-step";
import { readApprovedExtensionClientId } from "@/lib/anidachi-auth/extension-codes";
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
  searchParams: Promise<{ joined?: string; lobby?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { roomId } = await params;
  return {
    title: `Watchroom ${roomId} — AniDachi`,
    robots: { index: false, follow: false },
  };
}

export default async function RoomPage({ params, searchParams }: Props) {
  const { roomId } = await params;
  const { joined, lobby } = await searchParams;
  const lobbyQuery = roomLobbyDestination(roomId, lobby) ? `?lobby=${lobby}` : "";
  const initialMobile = isMobileUserAgent((await headers()).get("user-agent"));

  await requireAuth(`/room/${roomId}${lobbyQuery}`);
  const session = await getSession();

  const room = await getRoomById(roomId);

  // Ended (or missing) rooms get a friendly terminal state, not a bare 404.
  if (!room || room.status === "ended") {
    return (
      <Shell>
        <TrackOnView event="invite_viewed" params={{ state: "ended", mobile: initialMobile }} />
        <div className="mb-1 flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-ani-muted" />
          <span className="text-xs font-medium tracking-[-0.01em] text-ani-muted">
            Ended
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-ani-text">This watchroom has ended</h1>
        <p className="mt-2 text-sm text-ani-muted">
          Ask the host for a fresh invite link, or start your own
          watch party from the AniDachi extension on any supported video page.
        </p>
        <Button variant="cream" size="control" className="mt-6 w-full" asChild>
          <a href="https://www.anidachi.app">Back to AniDachi</a>
        </Button>
      </Shell>
    );
  }

  const [host, alreadyMember] = await Promise.all([
    getUserById(room.host_user_id),
    session ? isRoomMember(roomId, session.userId) : Promise.resolve(false),
  ]);

  const isHost = session?.userId === room.host_user_id;
  const isParticipant = isHost || alreadyMember;
  const source = deriveDurableRoomSource(room);
  const launchUrl = source
    ? buildRoomSourceLaunchUrl(source.source, roomId)
    : roomLobbyDestination(roomId, room.lobby_provider ?? lobby, room.lobby_marketplace);
  const details = roomTicketDetails({ ...room, source_provider: source?.source.provider ?? room.source_provider }, host?.display_name ?? null, lobby);
  const extensionId = readApprovedExtensionClientId();
  const justJoined = joined === "1";

  // Joined, but the host has not opened a video yet: keep the guest informed
  // and auto-upgrade to "Open watchroom" once a source URL appears.
  if (isParticipant && !launchUrl) {
    return (
      <>
        <TrackOnView event="invite_viewed" params={{ state: "waiting_for_host", mobile: initialMobile }} />
        <InviteTicket details={details}>
          <RoomInviteExtensionStep extensionId={extensionId} initialMobile={initialMobile}>
            <h2>{justJoined ? "You’re in!" : "Waiting for host"}</h2>
            <p className={ticket.note}>Keep this tab open. It updates when the host opens a video.</p>
            {!extensionId && <ExtensionCheck initialMobile={initialMobile} />}
            <RoomMobileHandoff variant="waiting" initialMobile={initialMobile} />
          </RoomInviteExtensionStep>
        </InviteTicket>
        <WaitingRefresh roomId={roomId} />
      </>
    );
  }


  return (
    <>
      <TrackOnView
        event="invite_viewed"
        params={{
          state: isParticipant ? "ready_to_open" : "ready_to_join",
          mobile: initialMobile,
        }}
      />
      <RoomInviteView
        status={room.status}
        roomTitle={details.title}
        roomSubtitle={details.episode ?? null}
        hostName={details.host ?? null}
        extensionId={extensionId}
        sourceProvider={details.provider ?? undefined}
        joinAction={`/api/rooms/${roomId}/join${lobbyQuery}`}
        isParticipant={isParticipant}
        hasLaunchUrl={Boolean(launchUrl)}
        initialMobile={initialMobile}
      />
    </>
  );
}
