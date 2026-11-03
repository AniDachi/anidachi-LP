import type { NextRequest } from "next/server";
import { db } from "@/lib/anidachi-auth/db";
import { handleFree20ContextAttach } from "@/lib/anidachi-auth/free20-context-attach";
import { hasValidInternalServiceAuthorization } from "@/lib/internal-service-auth";
export const dynamic = "force-dynamic";
export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ roomId: string }> },
) {
	const { roomId } = await params;
	return handleFree20ContextAttach(request, roomId, {
		authorize: hasValidInternalServiceAuthorization,
		attach: async (command) => {
			const { data, error } = await db().rpc("attach_free20_room_context_v1", {
				p_user_id: command.ownerUserId,
				p_room_id: command.roomId,
				p_browser_hash: command.browserHash,
				p_installation_hash: command.installationHash,
			});
			if (error)
				throw new Error(
					error.message === "FREE20_CONTEXT_BUSY"
						? "FREE20_CONTEXT_BUSY"
						: "ROOM_AUTHORITY_UNAVAILABLE",
				);
			if (
				!data ||
				data.roomId !== command.roomId ||
				!Number.isSafeInteger(data.committedSeconds) ||
				data.committedSeconds < 0 ||
				typeof data.serverTime !== "string" ||
				!Number.isFinite(Date.parse(data.serverTime))
			)
				throw new Error("ROOM_AUTHORITY_UNAVAILABLE");
		},
	});
}
