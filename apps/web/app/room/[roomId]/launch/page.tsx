import { redirect } from "next/navigation";
import { getSession } from "@/lib/anidachi-auth/session";
import { getRoomById, isRoomMember } from "@/lib/anidachi-auth/db";
import { deriveDurableRoomSource } from "@/lib/anidachi-auth/room-source";
import { readApprovedExtensionClientId } from "@/lib/anidachi-auth/extension-codes";
import { PrimeRoomLaunch } from "./prime-room-launch";
export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
export default async function RoomLaunch({
	params,
}: {
	params: Promise<{ roomId: string }>;
}) {
	const { roomId } = await params;
	const session = await getSession();
	if (!session)
		redirect(`/login?next=${encodeURIComponent(`/room/${roomId}`)}`);
	const room = await getRoomById(roomId);
	if (
		!room ||
		room.status === "ended" ||
		!(
			room.host_user_id === session.userId ||
			(await isRoomMember(roomId, session.userId))
		)
	)
		redirect(`/room/${encodeURIComponent(roomId)}`);
	const source = deriveDurableRoomSource(room)?.source;
	if (!source || source.provider !== "primevideo")
		redirect(`/room/${encodeURIComponent(roomId)}`);
	return (
		<PrimeRoomLaunch
			roomId={roomId}
			source={source}
			owner={session.userId}
			extensionId={readApprovedExtensionClientId()}
		/>
	);
}
