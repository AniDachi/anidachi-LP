import type { Metadata } from "next";
import { headers } from "next/headers";
import { getSession, requireAuth } from "@/lib/anidachi-auth/session";
import { getRoomById, getUserById, isRoomMember } from "@/lib/anidachi-auth/db";
import { RoomInviteShell as Shell, RoomInviteView } from "./room-invite-view";
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
					<span className="inline-block h-2 w-2 rounded-full bg-foreground/30" />
					<span className="text-xs font-medium uppercase tracking-widest text-foreground/50">
						Ended
					</span>
				</div>
				<h1 className="mt-3 text-2xl font-bold text-foreground">
					This watchroom has ended
				</h1>
				<p className="mt-2 text-sm text-foreground/50">
					The host closed this room. Ask them for a fresh invite link, or start
					your own watch party from the AniDachi extension on any supported
					video page.
				</p>
				<a
					href="https://www.anidachi.app"
					className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand-surface px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-brand-orange/20"
				>
					Back to AniDachi
				</a>
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
					<span className="text-xs font-medium uppercase tracking-widest text-foreground/50">
						Waiting for host
					</span>
				</div>
				<h1 className="mt-3 text-2xl font-bold text-foreground">
					{justJoined ? "You're in!" : roomTitle}
				</h1>
				<p className="mt-2 text-sm text-foreground/50">
					The host hasn&apos;t opened a video yet. Keep this tab open — it
					updates automatically the moment the watch party starts.
				</p>
				<div className="mt-4 flex flex-wrap gap-4 text-sm text-foreground/50">
					<span>
						Host:{" "}
						<span className="font-medium text-foreground/80">
							{host?.display_name ?? "Unknown"}
						</span>
					</span>
				</div>
				<ExtensionCheck initialMobile={initialMobile} />
				<RoomMobileHandoff variant="waiting" initialMobile={initialMobile} />
				<WaitingRefresh roomId={roomId} />
			</Shell>
		);
	}

	const roomSubtitle = room.episode_id ?? null;

	return (
		<RoomInviteView
			status={room.status}
			roomTitle={roomTitle}
			roomSubtitle={roomSubtitle}
			hostName={host?.display_name ?? "Unknown"}
			sourceProvider={source?.source.provider}
			joinAction={`/api/rooms/${roomId}/join`}
			isParticipant={isParticipant}
			hasLaunchUrl={Boolean(launchUrl)}
			initialMobile={initialMobile}
		/>
	);
}
