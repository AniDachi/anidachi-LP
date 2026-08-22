import { type NextRequest, NextResponse } from "next/server";
import { persistRoomSource } from "@/lib/anidachi-auth/db";
import { handleInternalRoomSourcePost } from "@/lib/anidachi-auth/room-source";

export const dynamic = "force-dynamic";

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ roomId: string }> },
) {
	const { roomId } = await params;
	const response = await handleInternalRoomSourcePost({
		authorization: request.headers.get("authorization"),
		roomId,
		readJson: () => request.json(),
		persist: persistRoomSource,
	});
	return NextResponse.json(response.body, { status: response.status });
}
