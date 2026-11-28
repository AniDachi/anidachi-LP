import { NextRequest, NextResponse } from "next/server";
import { boundedFree20, readBoundedFree20Json } from "./anidachi-auth/free20-abuse-http";

export function emailJson(body: object, status = 200): NextResponse {
	return NextResponse.json(body, {
		status,
		headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
	});
}
export function guardEmailRequest(request: NextRequest, origin = request.nextUrl.origin): NextResponse | null {
	if (
		request.headers.get("origin") !== origin ||
		![null, "same-origin"].includes(request.headers.get("sec-fetch-site"))
	)
		return emailJson({ error: "forbidden" }, 403);
	if (
		request.headers.get("content-type")?.split(";")[0].trim() !==
		"application/json"
	)
		return emailJson({ error: "invalid_request" }, 400);
	return null;
}
export async function readEmailBody(
	request: NextRequest,
): Promise<Record<string, unknown> | null> {
	try {
		const value = await boundedFree20(3000, (signal) =>
			readBoundedFree20Json(request.body, 6144, signal),
		);
		return value && typeof value === "object" && !Array.isArray(value)
			? (value as Record<string, unknown>)
			: null;
	} catch {
		return null;
	}
}
