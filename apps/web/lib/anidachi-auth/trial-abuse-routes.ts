import { type NextRequest, NextResponse } from "next/server";
import { BILLING_OWNER_HEADER } from "../billing-view";
import { allowTrialAction } from "./cardless-trial-server";
import {
	createTrialAbuseTokens,
	trialBrowserCookieName,
	TRIAL_BROWSER_MAX_AGE,
} from "./trial-abuse";
import { REFRESH_TOKEN_COOKIE } from "./cookies";
import { resolveWebsiteSession } from "./website-session";
import { readApprovedExtensionClientId } from "./extension-codes";

type Deps = {
	getUser?: (request: NextRequest) => Promise<{ id: string } | null>;
	allowRequest?: (owner: string) => Promise<boolean>;
	tokens?: (origin: string) => ReturnType<typeof createTrialAbuseTokens>;
	extensionId?: () => string | null;
};
export function createTrialContextHandler(deps: Deps = {}) {
	return async (request: NextRequest) => {
		const json = (body: unknown, status: number) =>
			NextResponse.json(body, {
				status,
				headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
			});
		try {
			if (
				request.headers.get("origin") !== request.nextUrl.origin ||
				request.headers.get("sec-fetch-site") === "cross-site" ||
				request.headers.get("content-type")?.split(";")[0]?.trim() !==
					"application/json"
			)
				return json({ error: "Open AniDachi to start your trial." }, 403);
			const user = await (
				deps.getUser ??
				((r) =>
					resolveWebsiteSession(r.cookies.get(REFRESH_TOKEN_COOKIE)?.value))
			)(request);
			if (!user) return json({ error: "Sign in to start your trial." }, 401);
			if (request.headers.get(BILLING_OWNER_HEADER) !== user.id)
				return json(
					{ error: "Your signed-in account changed. Reload this page." },
					409,
				);
			const text = await request.text();
			if (text.length > 512)
				return json({ error: "Invalid trial request." }, 400);
			let requestId: unknown;
			try {
				requestId = JSON.parse(text)?.requestId;
			} catch {
				return json({ error: "Invalid trial request." }, 400);
			}
			if (
				typeof requestId !== "string" ||
				!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
					requestId,
				)
			)
				return json({ error: "Invalid trial request." }, 400);
			if (
				!(await (deps.allowRequest ?? ((u) => allowTrialAction(u, "offer")))(
					user.id,
				))
			)
				return json({ error: "Please wait a moment and try again." }, 429);
			const tokens = (
				deps.tokens ??
				((origin) =>
					createTrialAbuseTokens(process.env.ANIDACHI_JWT_SECRET ?? "", origin))
			)(request.nextUrl.origin);
			const name = trialBrowserCookieName(request.nextUrl.origin);
			const previous = request.cookies.get(name)?.value;
			const hash = tokens.readCookie(previous);
			const cookie = hash ? previous! : tokens.issueCookie();
			const response = json(
				{
					state: "ready",
					ownerUserId: user.id,
					challenge: tokens.issueChallenge(
						hash ?? tokens.readCookie(cookie)!,
						user.id,
						requestId,
					),
					extensionId: (deps.extensionId ?? readApprovedExtensionClientId)(),
				},
				200,
			);
			if (!hash)
				response.cookies.set(name, cookie, {
					httpOnly: true,
					secure: request.nextUrl.protocol === "https:",
					sameSite: "lax",
					path: "/",
					maxAge: TRIAL_BROWSER_MAX_AGE,
				});
			return response;
		} catch {
			return json(
				{
					error:
						"Trial confirmation is temporarily unavailable. Please try again.",
				},
				503,
			);
		}
	};
}
