import {
	CompletedRoomCursorSchema,
	CompletedRoomSchema,
} from "@anidachi/protocol";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/anidachi-auth/db";
import { getExtensionSessionFromAuthorization } from "@/lib/anidachi-auth/extension-session";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
	const session = await getExtensionSessionFromAuthorization(
		request.headers.get("authorization"),
	);
	if (!session)
		return NextResponse.json(
			{ error: "Unauthorized" },
			{ status: 401, headers },
		);
	const params = request.nextUrl.searchParams;
	const paginated = params.has("before") || params.has("roomId");
	const cursor = CompletedRoomCursorSchema.safeParse({
		endedAt: params.get("before"),
		roomId: params.get("roomId"),
	});
	if (paginated && !cursor.success)
		return NextResponse.json(
			{ error: "Invalid cursor" },
			{ status: 400, headers },
		);
	const limit = paginated ? 24 : 3;
	try {
		const { data, error } = await db().rpc("list_completed_rooms_v1", {
			p_owner: session.sub,
			p_before: cursor.data?.endedAt ?? null,
			p_before_id: cursor.data?.roomId ?? null,
			p_limit: limit + 1,
		});
		if (error) throw error;
		const rows = CompletedRoomSchema.array().parse(data);
		const rooms = rows.slice(0, limit);
		const last = rooms.at(-1);
		const next =
			rows.length > limit && last
				? { endedAt: last.endedAt, roomId: last.roomId }
				: null;
		return NextResponse.json(
			{ ownerUserId: session.sub, rooms, next },
			{ headers },
		);
	} catch {
		return NextResponse.json(
			{ error: "Room history is temporarily unavailable." },
			{ status: 503, headers },
		);
	}
}
