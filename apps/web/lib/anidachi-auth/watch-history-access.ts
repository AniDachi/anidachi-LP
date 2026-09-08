import { type NextRequest, NextResponse } from "next/server";
import type { ApiSession } from "./api-session";
import { getExtensionSessionFromAuthorization } from "./extension-session";
import { getSession as getCookieSession } from "./session";
import { WATCH_HISTORY_OWNER_HEADER } from "../watch-history-owner";
import {
	HistoryAccessError,
	resolveAccountEntitlements,
	type AccountEntitlements,
} from "./account-entitlements";
import { getPlanEntitlements } from "./plan-entitlements";

export { HistoryAccessError } from "./account-entitlements";
export const HISTORY_PRIVATE_HEADERS = {
	"Cache-Control": "private, no-store",
	Vary: "Cookie, Authorization",
};
/** A route preflight; writers must recheck access/epochs in their DB transaction. */
export async function requirePersonalHistoryAccess(
	userId: string,
	now = new Date(),
	resolve = resolveAccountEntitlements,
) {
	const result = await resolve(userId, now);
	if (result.history.state !== "allowed")
		throw new HistoryAccessError("HISTORY_PLAN_REQUIRED", 403);
	return result;
}
/** Preserve the established account-entitlements bearer-first identity selection. */
export async function getAccountAccessSession(
	request: NextRequest,
	readCookieSession = getCookieSession,
): Promise<ApiSession | null> {
	const extension = await getExtensionSessionFromAuthorization(
		request.headers.get("authorization"),
	);
	if (extension)
		return {
			userId: extension.sub,
			email: extension.email,
			plan: extension.plan,
			source: "extension",
		};
	// Missing or invalid bearer falls back to the verified website cookie, as before.
	const cookie = await readCookieSession();
	return cookie ? { ...cookie, source: "cookie" } : null;
}

export function createAccountAccessHandlers(
	deps: {
		getSession?(request: NextRequest): Promise<ApiSession | null>;
		getCookieSession?: typeof getCookieSession;
		resolve(userId: string, now: Date): Promise<AccountEntitlements>;
	} = { resolve: resolveAccountEntitlements },
) {
	const handle = async (request: NextRequest, metadata: boolean) => {
		try {
			const session = await (deps.getSession
				? deps.getSession(request)
				: getAccountAccessSession(request, deps.getCookieSession));
			if (!session) throw new HistoryAccessError("UNAUTHORIZED", 401);
			const expectedOwner = request.headers.get(WATCH_HISTORY_OWNER_HEADER);
			if (expectedOwner && expectedOwner !== session.userId)
				throw new HistoryAccessError("HISTORY_ACCESS_CHANGED", 409);
			const result = await deps.resolve(session.userId, new Date());
			const body = metadata
				? {
						entitlementsVersion: 1,
						ownerUserId: session.userId,
						serverTime: result.history.serverTime,
						planCode: result.policy.planCode,
						entitlements: getPlanEntitlements(result.policy.planCode),
						policy: result.policy,
					}
				: result.history;
			return NextResponse.json(body, { headers: HISTORY_PRIVATE_HEADERS });
		} catch (error) {
			const failure =
				error instanceof HistoryAccessError
					? error
					: new HistoryAccessError("HISTORY_ACCESS_UNAVAILABLE", 503);
			return NextResponse.json(
				{ error: failure.code, code: failure.code },
				{ status: failure.status, headers: HISTORY_PRIVATE_HEADERS },
			);
		}
	};
	return {
		getAccess: (request: NextRequest) => handle(request, false),
		getEntitlements: (request: NextRequest) => handle(request, true),
	};
}
