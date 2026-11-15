import { NextRequest, NextResponse } from "next/server";
import { boundedFree20, readBoundedFree20Json } from "./free20-abuse-http";
import {
	createEmailChallenge,
	EMAIL_BROWSER_SECRET,
	EMAIL_CHALLENGE_ID,
	EMAIL_CODE_TTL_SECONDS,
	EMAIL_RESEND_SECONDS,
	emailCookieName,
	emailLoginEnabled,
	emailLoginHash,
	emailLoginReturnTo,
	emailRequestIp,
	normalizeLoginEmail,
} from "./email-login";
import {
	reserveEmailChallenge,
	markEmailChallengeSent,
	consumeEmailChallenge,
} from "./email-login-server";
import { sendEmailLoginCode } from "./email-login-mail";
import { issueTokenPair } from "./tokens";
import { setAuthCookies } from "./session";
import { getUserIdentityById } from "./db";
import { needsProfileName } from "../profile-name";
import {
	emitServerEvent,
	readFirstTouch,
	SIGNUP_FLAG_COOKIE,
} from "../analytics-server-events";

type Dependencies = {
	enabled: () => boolean;
	reserve: typeof reserveEmailChallenge;
	sent: typeof markEmailChallengeSent;
	send: typeof sendEmailLoginCode;
	consume: typeof consumeEmailChallenge;
	issueTokens: typeof issueTokenPair;
	getUser: typeof getUserIdentityById;
};
const defaults: Dependencies = {
	enabled: emailLoginEnabled,
	reserve: reserveEmailChallenge,
	sent: markEmailChallengeSent,
	send: sendEmailLoginCode,
	consume: consumeEmailChallenge,
	issueTokens: issueTokenPair,
	getUser: getUserIdentityById,
};
function json(body: object, status = 200): NextResponse {
	return NextResponse.json(body, {
		status,
		headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
	});
}
function guard(request: NextRequest, enabled: boolean): NextResponse | null {
	if (!enabled) return json({ error: "unavailable" }, 503);
	if (
		request.headers.get("origin") !== request.nextUrl.origin ||
		![null, "same-origin"].includes(request.headers.get("sec-fetch-site"))
	)
		return json({ error: "forbidden" }, 403);
	if (
		request.headers.get("content-type")?.split(";")[0].trim() !==
		"application/json"
	)
		return json({ error: "invalid_request" }, 400);
	return null;
}
async function body(
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
const cookieOptions = () => ({
	path: "/",
	httpOnly: true,
	secure: process.env.NODE_ENV === "production",
	sameSite: "strict" as const,
});

export function createEmailLoginRoutes(overrides: Partial<Dependencies> = {}) {
	const deps = { ...defaults, ...overrides };
	return {
		async send(request: NextRequest): Promise<NextResponse> {
			const blocked = guard(request, deps.enabled());
			if (blocked) return blocked;
			const input = await body(request);
			const email = normalizeLoginEmail(input?.email);
			if (!input || !email) return json({ error: "invalid_email" }, 400);
			try {
				const challenge = createEmailChallenge(email, input.returnTo);
				const retryAfter = await deps.reserve(
					challenge,
					emailLoginHash("ip", emailRequestIp(request.headers)),
				);
				if (retryAfter) {
					const response = json({ error: "rate_limited", retryAfter }, 429);
					response.headers.set("Retry-After", String(retryAfter));
					return response;
				}
				await deps.send(email, challenge.code, challenge.id);
				await deps.sent(challenge.id);
				const response = json({
					challengeId: challenge.id,
					expiresAt: Date.now() + EMAIL_CODE_TTL_SECONDS * 1000,
					retryAfter: EMAIL_RESEND_SECONDS,
				});
				response.cookies.set(
					emailCookieName(challenge.id),
					challenge.browserSecret,
					{ ...cookieOptions(), maxAge: EMAIL_CODE_TTL_SECONDS },
				);
				return response;
			} catch {
				// No emails, codes, provider bodies or auth secrets in logs/errors.
				return json({ error: "unavailable" }, 503);
			}
		},
		async verify(request: NextRequest): Promise<NextResponse> {
			const blocked = guard(request, deps.enabled());
			if (blocked) return blocked;
			const input = await body(request);
			const id = input?.challengeId;
			const code = input?.code;
			if (
				typeof id !== "string" ||
				!EMAIL_CHALLENGE_ID.test(id) ||
				typeof code !== "string" ||
				!/^\d{6}$/.test(code)
			)
				return json({ error: "invalid_code" }, 400);
			const browser = request.cookies.get(emailCookieName(id))?.value;
			if (!browser || !EMAIL_BROWSER_SECRET.test(browser))
				return json({ error: "invalid_code" }, 400);
			try {
				const result = await deps.consume(
					id,
					emailLoginHash("browser", browser),
					emailLoginHash("code", `${id}:${code}`),
				);
				if (result.outcome === "invalid")
					return json({ error: "invalid_code" }, 400);
				if (result.outcome === "provider_required") {
					const response = json({ error: "provider_required" }, 409);
					response.cookies.set(emailCookieName(id), "", {
						...cookieOptions(),
						maxAge: 0,
					});
					return response;
				}
				const user = await deps.getUser(result.user_id!);
				if (!user) throw new Error("Email login unavailable");
				const tokens = await deps.issueTokens(result.user_id!);
				const returnTo = emailLoginReturnTo(result.return_to) || "/account";
				const redirectTo = needsProfileName(user.display_name)
					? `/login/name?next=${encodeURIComponent(returnTo)}`
					: returnTo;
				const response = json({ redirectTo });
				setAuthCookies(response, tokens.accessToken, tokens.refreshToken);
				response.cookies.set(emailCookieName(id), "", {
					...cookieOptions(),
					maxAge: 0,
				});
				const flow = returnTo.startsWith("/extension/connect")
					? "extension"
					: "website";
				emitServerEvent({
					eventType: result.is_new ? "sign_up" : "login",
					userId: result.user_id,
					request,
					properties: {
						provider: "email",
						flow,
						...(result.is_new
							? readFirstTouch(request.headers.get("cookie"))
							: {}),
					},
				});
				if (result.is_new)
					response.cookies.set(SIGNUP_FLAG_COOKIE, `email.${flow}`, {
						path: "/",
						maxAge: 600,
						sameSite: "lax",
						secure: process.env.NODE_ENV === "production",
					});
				return response;
			} catch {
				return json({ error: "unavailable" }, 503);
			}
		},
	};
}
