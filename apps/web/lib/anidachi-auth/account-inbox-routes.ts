import { NextResponse } from "next/server";
import { AccountInboxApiError } from "./account-inbox";

export function accountInboxErrorResponse(error: unknown): NextResponse {
	if (error instanceof AccountInboxApiError) {
		return NextResponse.json(
			{ error: error.message },
			{ status: error.status },
		);
	}
	console.error("[anidachi/account-inbox] Unexpected API error:", error);
	return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export function accountInboxPageLimit(
	value: string | null,
): number | undefined {
	if (value === null || value === "") return undefined;
	if (!/^\d{1,3}$/.test(value)) {
		throw new AccountInboxApiError(400, "Invalid inbox limit");
	}
	const limit = Number(value);
	if (limit < 1 || limit > 100) {
		throw new AccountInboxApiError(400, "Invalid inbox limit");
	}
	return limit;
}
