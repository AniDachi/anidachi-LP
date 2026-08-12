import { MarkAccountInboxSeenRequestSchema } from "@anidachi/protocol";
import { type NextRequest, NextResponse } from "next/server";
import { markAccountInboxItemsSeen } from "@/lib/anidachi-auth/account-inbox";
import {
	accountInboxErrorResponse,
	accountInboxPageLimit,
} from "@/lib/anidachi-auth/account-inbox-routes";
import { getApiSession } from "@/lib/anidachi-auth/api-session";
import { readJsonBody } from "@/lib/anidachi-auth/social-routes";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
	const session = await getApiSession(request);
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const payload = MarkAccountInboxSeenRequestSchema.safeParse(
		await readJsonBody(request),
	);
	if (!payload.success) {
		return NextResponse.json({ error: "Invalid inbox items" }, { status: 400 });
	}

	try {
		return NextResponse.json(
			await markAccountInboxItemsSeen({
				ownerUserId: session.userId,
				items: payload.data.items,
				limit: accountInboxPageLimit(request.nextUrl.searchParams.get("limit")),
			}),
		);
	} catch (error) {
		return accountInboxErrorResponse(error);
	}
}
