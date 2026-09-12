import { type NextRequest, NextResponse } from "next/server";
import {
	endHostLobbyForActiveSession,
	getActiveRoomSessionAssignment,
	releaseActiveRoomSession,
} from "@/lib/anidachi-auth/db";
import { getExtensionSessionFromAuthorization } from "@/lib/anidachi-auth/extension-session";
import {
	handleActiveRoomRecoveryDeparture,
	reportRoomDepartureOutcome,
} from "@/lib/anidachi-auth/active-room-session-routes";
import {
	syncParticipantDepartureToWorker,
	syncParticipantDetachToWorker,
} from "@/lib/anidachi-auth/room-lifecycle";
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
	if (!session) {
		return NextResponse.json(
			{ code: "AUTH_REQUIRED", message: "Sign in again before leaving." },
			{ status: 401 },
		);
	}
	const response = await handleActiveRoomRecoveryDeparture({
		userId: session.userId,
		value: await request.json().catch(() => null),
		requestedAt: Date.now(),
		dependencies: {
			getActiveAssignment: getActiveRoomSessionAssignment,
			releaseGuest: releaseActiveRoomSession,
			detachGuest: syncParticipantDetachToWorker,
			syncHostDeparture: syncParticipantDepartureToWorker,
			endHostLobby: endHostLobbyForActiveSession,
			report: reportRoomDepartureOutcome,
		},
	});
	return NextResponse.json(response.body, { status: response.status });
}
