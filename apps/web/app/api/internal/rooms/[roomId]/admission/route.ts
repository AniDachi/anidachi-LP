import { type NextRequest, NextResponse } from "next/server";
import {
	RoomHostingAdmissionSchema,
	RoomHostingAdmissionRequestSchema,
} from "@anidachi/protocol";
import { db } from "@/lib/anidachi-auth/db";
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
	const body = RoomHostingAdmissionRequestSchema.safeParse(
		await request.json().catch(() => null),
	);
	if (!body.success || !roomId || roomId.length > 128)
		return NextResponse.json(
			{ error: "Invalid admission request" },
			{ status: 400 },
		);
	try {
		const { data, error } = await db()
			.rpc("check_room_hosting_socket_v1", {
				p_room_id: roomId,
				p_user_id: body.data.userId,
			})
			.abortSignal(AbortSignal.timeout(2000));
		const result = RoomHostingAdmissionSchema.safeParse(data);
		if (error || !result.success || result.data.roomId !== roomId)
			throw new Error("authority unavailable");
		return NextResponse.json(result.data);
	} catch {
		return NextResponse.json(
			{ error: "ROOM_AUTHORITY_UNAVAILABLE" },
			{ status: 503 },
		);
	}
}
