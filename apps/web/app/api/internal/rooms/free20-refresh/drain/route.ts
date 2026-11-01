import { type NextRequest, NextResponse } from "next/server";
import { drainFree20PurchaseDelivery } from "@/lib/anidachi-auth/free20-purchase-delivery";
import { hasValidInternalServiceAuthorization } from "@/lib/internal-service-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
	const headers = { "Cache-Control": "private, no-store" };
	if (
		!hasValidInternalServiceAuthorization(request.headers.get("authorization"))
	)
		return NextResponse.json(
			{ error: "Unauthorized" },
			{ status: 401, headers },
		);
	if (process.env.ANIDACHI_FREE20_ACCOUNTING_ENABLED !== "true")
		return NextResponse.json(
			{ error: "FREE20_ACCOUNTING_DISABLED" },
			{ status: 503, headers },
		);
	try {
		// Caller payload is irrelevant: only committed SQL work can be drained.
		const summary = await drainFree20PurchaseDelivery();
		if (!summary.errors && !summary.pending)
			return NextResponse.json({ ok: true }, { headers });
	} catch {
		console.error("[anidachi/free20-refresh] drain unavailable");
	}
	return NextResponse.json(
		{ error: "Free20 refresh drain unavailable" },
		{ status: 503, headers },
	);
}
