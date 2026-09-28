import { NextRequest, NextResponse } from "next/server";
import { REFRESH_TOKEN_COOKIE } from "@/lib/anidachi-auth/cookies";
import { resolveWebsiteSession } from "@/lib/anidachi-auth/website-session";
import { getPricingOffer } from "@/lib/anidachi-auth/pricing-offer";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
	const headers = { "Cache-Control": "private, no-store" };
	try {
		const user = await resolveWebsiteSession(
			request.cookies.get(REFRESH_TOKEN_COOKIE)?.value,
		);
		return NextResponse.json(await getPricingOffer(user?.id ?? null), {
			headers,
		});
	} catch {
		return NextResponse.json(
			{ error: "We could not load current plans. Please try again." },
			{ status: 503, headers },
		);
	}
}
