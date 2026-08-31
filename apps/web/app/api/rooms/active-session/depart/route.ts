import { type NextRequest, NextResponse } from "next/server";
import {
	endHostLobbyForActiveSession,
	getActiveRoomSessionAssignment,
	releaseActiveRoomSession,
} from "@/lib/anidachi-auth/db";
import { getExtensionSessionFromAuthorization } from "@/lib/anidachi-auth/extension-session";
import { handleActiveRoomRecoveryDeparture } from "@/lib/anidachi-auth/active-room-session-routes";
import { syncParticipantDepartureToWorker } from "@/lib/anidachi-auth/room-lifecycle";
import { getSession } from "@/lib/anidachi-auth/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
	const cookieSession = await getSession();
	const extensionSession = cookieSession
		? null
		: await getExtensionSessionFromAuthorization(
				request.headers.get("authorization"),
			);
	const session =
		cookieSession ??
		(extensionSession
			? {
					userId: extensionSession.sub,
					email: extensionSession.email,
					plan: extensionSession.plan,
				}
			: null);
	const response = await handleActiveRoomRecoveryDeparture({
		userId: session?.userId ?? null,
		value: await request.json().catch(() => null),
		requestedAt: Date.now(),
		dependencies: {
			getActiveAssignment: getActiveRoomSessionAssignment,
			syncWorker: syncParticipantDepartureToWorker,
			releaseGuest: releaseActiveRoomSession,
			endHostLobby: endHostLobbyForActiveSession,
		},
	});
	return NextResponse.json(response.body, { status: response.status });
}
