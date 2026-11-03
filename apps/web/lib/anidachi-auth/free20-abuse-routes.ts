import {
	ACCOUNT_HOSTING_OWNER_HEADER,
	FREE20_CHALLENGE_TTL_SECONDS,
	FREE20_CONTEXT_REQUEST_MAX_BYTES,
	FREE20_CONTEXT_TTL_SECONDS,
	Free20ContextRequestSchema,
	Free20ContextResponseSchema,
} from "@anidachi/protocol";
import { type NextRequest, NextResponse } from "next/server";
import { getResolvedSiteOrigin } from "../site-url";
import { allowTrialAction } from "./cardless-trial-server";
import { readApprovedExtensionClientId } from "./extension-codes";
import {
	createFree20AbuseTokens,
	Free20ContextError,
	free20ContextCookieName,
} from "./free20-abuse";
import {
	free20AbuseEnabled,
	free20AllowedOrigin,
} from "./free20-abuse-context";
import { boundedFree20, readBoundedFree20Json } from "./free20-abuse-http";
import {
	createTrialAbuseTokens,
	TRIAL_BROWSER_MAX_AGE,
	trialBrowserCookieName,
} from "./trial-abuse";
import { getAccountAccessSession } from "./watch-history-access";

type Dependencies = {
	enabled: () => boolean;
	siteOrigin: () => string;
	extensionId: () => string | null;
	getSession: typeof getAccountAccessSession;
	allowRequest: (owner: string) => Promise<boolean>;
	tokens: (origin: string) => ReturnType<typeof createFree20AbuseTokens>;
	browserTokens: (origin: string) => ReturnType<typeof createTrialAbuseTokens>;
	now: () => number;
};
export function createFree20ContextHandler(
	overrides: Partial<Dependencies> = {},
) {
	const deps: Dependencies = {
		enabled: free20AbuseEnabled,
		siteOrigin: getResolvedSiteOrigin,
		extensionId: readApprovedExtensionClientId,
		getSession: getAccountAccessSession,
		allowRequest: (owner) => allowTrialAction(owner, "context"),
		tokens: (origin) =>
			createFree20AbuseTokens(process.env.ANIDACHI_JWT_SECRET ?? "", origin),
		browserTokens: (origin) =>
			createTrialAbuseTokens(process.env.ANIDACHI_JWT_SECRET ?? "", origin),
		now: Date.now,
		...overrides,
	};
	return async (request: NextRequest) => {
		const json = (body: unknown, status: number) =>
			NextResponse.json(body, {
				status,
				headers: {
					"Cache-Control": "private, no-store",
					Vary: `Cookie, Authorization, Origin, ${ACCOUNT_HOSTING_OWNER_HEADER}`,
				},
			});
		const failure = (code: string, status: number) => json({ code }, status);
		try {
			return await boundedFree20(10_000, async (signal) => {
				signal.throwIfAborted();
				if (!deps.enabled()) return failure("FREE20_DISABLED", 404);
				const origin = deps.siteOrigin();
				if (
					request.nextUrl.origin !== origin ||
					(request.headers.has("origin") &&
						!free20AllowedOrigin(
							request.headers.get("origin"),
							origin,
							deps.extensionId(),
						)) ||
					request.headers.get("content-type")?.split(";")[0]?.trim() !==
						"application/json"
				)
					return failure("FREE20_CONTEXT_ORIGIN_INVALID", 403);
				const session = await deps.getSession(request);
				signal.throwIfAborted();
				if (!session) return failure("UNAUTHORIZED", 401);
				if (!request.headers.has("origin") && session.source !== "extension")
					return failure("FREE20_CONTEXT_ORIGIN_INVALID", 403);
				if (
					request.headers.get(ACCOUNT_HOSTING_OWNER_HEADER) !== session.userId
				)
					return failure("HOSTING_OWNER_CHANGED", 409);
				let raw: unknown;
				try {
					raw = await readBoundedFree20Json(
						request.body,
						FREE20_CONTEXT_REQUEST_MAX_BYTES,
						signal,
					);
				} catch {
					signal.throwIfAborted();
					return failure("INVALID_REQUEST", 400);
				}
				signal.throwIfAborted();
				const parsed = Free20ContextRequestSchema.safeParse(raw);
				if (!parsed.success)
					return failure(
						(raw as { action?: unknown })?.action === "complete"
							? "FREE20_CONTEXT_REQUIRED"
							: "INVALID_REQUEST",
						(raw as { action?: unknown })?.action === "complete" ? 428 : 400,
					);
				const allowed = await deps.allowRequest(session.userId);
				signal.throwIfAborted();
				if (!allowed) return failure("FREE20_CONTEXT_RATE_LIMITED", 429);
				const input = parsed.data,
					tokens = deps.tokens(origin),
					browser = deps.browserTokens(origin),
					name = trialBrowserCookieName(origin);
				const previous = request.cookies.get(name)?.value;
				const cookieOptions = {
					httpOnly: true,
					secure: new URL(origin).protocol === "https:",
					sameSite: "lax" as const,
					path: "/",
				};
				if (input.action === "challenge") {
					const valid = browser.readCookie(previous);
					const cookie = valid ? previous! : browser.issueCookie();
					const response = json(
						Free20ContextResponseSchema.parse({
							action: "challenge",
							challenge: tokens.issueChallenge(
								cookie,
								session.userId,
								input.requestId,
							),
							expiresAt:
								Math.floor(deps.now() / 1000) * 1000 +
								FREE20_CHALLENGE_TTL_SECONDS * 1000,
						}),
						200,
					);
					if (!valid)
						response.cookies.set(name, cookie, {
							...cookieOptions,
							maxAge: TRIAL_BROWSER_MAX_AGE,
						});
					return response;
				}
				// The complete request must itself present the previously signed browser cookie.
				const result = await tokens.complete(
					previous,
					session.userId,
					input.requestId,
					input.proof,
				);
				signal.throwIfAborted();
				const response = json(
					Free20ContextResponseSchema.parse({ action: "complete", ...result }),
					200,
				);
				response.cookies.set(free20ContextCookieName(origin), result.context, {
					...cookieOptions,
					maxAge: FREE20_CONTEXT_TTL_SECONDS,
				});
				return response;
			});
		} catch (error) {
			return error instanceof Free20ContextError
				? failure("FREE20_CONTEXT_REQUIRED", 428)
				: failure("ROOM_AUTHORITY_UNAVAILABLE", 503);
		}
	};
}
