import { type NextRequest, NextResponse } from "next/server";
import { listAccountInbox } from "@/lib/anidachi-auth/account-inbox";
import {
	accountInboxErrorResponse,
	accountInboxPageLimit,
} from "@/lib/anidachi-auth/account-inbox-routes";
import { getApiSession } from "@/lib/anidachi-auth/api-session";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
	const session = await getApiSession(request);
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		return NextResponse.json(
			await listAccountInbox({
				ownerUserId: session.userId,
				cursor: request.nextUrl.searchParams.get("cursor"),
				limit: accountInboxPageLimit(request.nextUrl.searchParams.get("limit")),
			}),
		);
	} catch (error) {
		return accountInboxErrorResponse(error);
	}
}
