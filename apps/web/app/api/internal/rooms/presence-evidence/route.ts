import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/anidachi-auth/db";
import { handleInternalRoomPresencePost } from "@/lib/anidachi-auth/room-presence-evidence";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest) {
	const result = await handleInternalRoomPresencePost({
		authorization: request.headers.get("authorization"),
		readJson: () => request.json(),
		persist: async (evidence) => {
			const { data, error } = await db().rpc("record_recent_room_presence_v1", {
				p_evidence: evidence,
			});
			if (error) throw new Error("Presence persistence failed");
			return data;
		},
	});
	return NextResponse.json(result.body, {
		status: result.status,
		headers: { "Cache-Control": "private, no-store" },
	});
}
