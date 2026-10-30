import { type NextRequest, NextResponse } from "next/server";
import {
	Free20RoomBudgetRequestSchema,
	Free20RoomBudgetResponseSchema,
} from "@anidachi/protocol";
import { hasValidInternalServiceAuthorization } from "@/lib/internal-service-auth";
import { settleFree20RoomBudget } from "@/lib/anidachi-auth/free20-room-budget";
import { issueRoomPolicy } from "@/lib/anidachi-auth/room-capability";

export const dynamic = "force-dynamic";

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ roomId: string }> },
) {
	if (
		!hasValidInternalServiceAuthorization(request.headers.get("authorization"))
	)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (process.env.ANIDACHI_FREE20_ACCOUNTING_ENABLED !== "true")
		return NextResponse.json(
			{ code: "FREE20_ACCOUNTING_DISABLED" },
			{ status: 503 },
		);
	const { roomId } = await params;
	const input = Free20RoomBudgetRequestSchema.safeParse(
		await request.json().catch(() => null),
	);
	if (
		!input.success ||
		input.data.roomId !== roomId ||
		input.data.roomGeneration !== 1
	)
		return NextResponse.json(
			{ error: "Invalid Free20 request" },
			{ status: 400 },
		);
	try {
		const checkpoint = await settleFree20RoomBudget(input.data, new Date());
		// Reuse pinned media authority, but never read or return the legacy quota.
		const policy = await issueRoomPolicy(roomId, false);
		return NextResponse.json(
			Free20RoomBudgetResponseSchema.parse({ checkpoint, policy }),
		);
	} catch {
		return NextResponse.json(
			{ code: "ROOM_ACCOUNTING_UNAVAILABLE" },
			{ status: 503 },
		);
	}
}
