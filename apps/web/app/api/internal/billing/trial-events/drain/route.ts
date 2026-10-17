import { type NextRequest, NextResponse } from "next/server";
import {
	drainTrialConversionEvents,
	resolveTrialAnalyticsEnvironment,
} from "@/lib/anidachi-auth/trial-conversion-events";
import { hasValidInternalServiceAuthorization } from "@/lib/internal-service-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
	return NextResponse.json(
		{ error: "Method not allowed" },
		{ status: 405, headers: { ...headers, Allow: "POST" } },
	);
}

export async function POST(request: NextRequest) {
	if (
		!hasValidInternalServiceAuthorization(
			request.headers.get("authorization"),
			process.env.ANIDACHI_TRIAL_EVENT_DRAIN_SECRET ?? "",
		)
	) {
		return NextResponse.json(
			{ error: "Unauthorized" },
			{ status: 401, headers },
		);
	}
	const environment = resolveTrialAnalyticsEnvironment();
	if (environment) {
		try {
			const result = await drainTrialConversionEvents({ environment });
			console.info("[anidachi/trial-events] drain", { environment, ...result });
			if (result.errors === 0)
				return NextResponse.json({ ok: true }, { headers });
		} catch {
			/* Retry from the durable SQL queue, without logging private data. */
		}
	}
	return NextResponse.json(
		{ error: "Trial event drain unavailable" },
		{ status: 503, headers },
	);
}
