import { type NextRequest, NextResponse } from "next/server";
import { drainRoomHostingCutover } from "@/lib/anidachi-auth/room-hosting-cutover";
import { hasValidInternalServiceAuthorization } from "@/lib/internal-service-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
	if (
		!hasValidInternalServiceAuthorization(
			request.headers.get("authorization"),
			process.env.ANIDACHI_HOSTING_CUTOVER_DRAIN_SECRET ?? "",
		)
	) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	try {
		// Payloads cannot select rooms or issue commands: only committed SQL targets.
		const summary = await drainRoomHostingCutover();
		console.info("[anidachi/hosting-cutover] drain", summary);
		if (!summary.errors && !summary.pending)
			return NextResponse.json({ ok: true });
	} catch {
		console.error("[anidachi/hosting-cutover] drain unavailable");
	}
	return NextResponse.json(
		{ error: "Cutover drain unavailable" },
		{ status: 503 },
	);
}
