import { type NextRequest, NextResponse } from "next/server";
import { RoomUsageSummarySchema } from "@anidachi/protocol";
import { issueRoomPolicy } from "@/lib/anidachi-auth/room-capability";
import {
	commitRoomUsageDay,
	finalizeRoomUsage,
	getRoomById,
} from "@/lib/anidachi-auth/db";
import {
  completeInternalRoomEnd,
  parseInternalRoomEndCommand,
} from "@/lib/anidachi-auth/room-lifecycle";
import { hasValidInternalServiceAuthorization } from "@/lib/internal-service-auth";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
	if (
		!hasValidInternalServiceAuthorization(request.headers.get("authorization"))
	) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { roomId } = await params;
	const body = await request.json().catch(() => null);
	if (body?.operation === "room_policy_v2") {
		if (
			body.roomGeneration !== 1 ||
			!Array.isArray(body.usage) ||
			body.usage.length > 2
		)
			return NextResponse.json({ error: "Invalid usage" }, { status: 400 });
		const usages = RoomUsageSummarySchema.array().max(2).safeParse(body.usage);
		if (!usages.success)
			return NextResponse.json({ error: "Invalid usage" }, { status: 400 });
		try {
			const acknowledged = [];
			for (const usage of usages.data)
				acknowledged.push(await commitRoomUsageDay(roomId, usage));
			const policy =
				body.settleOnly === true ? null : await issueRoomPolicy(roomId);
			return NextResponse.json({
				ok: true,
    roomId,
				roomGeneration: 1,
				acknowledged,
				policy,
			});
		} catch {
			return NextResponse.json(
				{ code: "ROOM_ACCOUNTING_UNAVAILABLE" },
				{ status: 503 },
  );
		}
	}
	const command = await parseInternalRoomEndCommand(roomId, body);
  if (!command) {
		return NextResponse.json(
			{ error: "Invalid room end command" },
			{ status: 400 },
		);
  }
  const room = await getRoomById(roomId);
	if (!room)
		return NextResponse.json({ error: "Room not found" }, { status: 404 });
  const endedAt = new Date(command.endedAt);
  const result = await completeInternalRoomEnd({
    alreadyEnded: room.status === "ended",
    command,
    dependencies: {
      finalize: async (usage) => {
        await finalizeRoomUsage(roomId, endedAt.toISOString(), usage);
      },
    },
  });
	return NextResponse.json({ ok: true, usageFinalized: true, ...result });
}
