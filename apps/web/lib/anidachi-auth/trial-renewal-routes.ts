import { type NextRequest, NextResponse } from "next/server";
import { BILLING_OWNER_HEADER } from "../billing-view";
import { allowTrialAction } from "./cardless-trial-server";
import { REFRESH_TOKEN_COOKIE } from "./cookies";
import {
	type RenewalQuoteInput,
	type RenewalResult,
	type RenewalSetupResult,
	TrialRenewalError,
	type TrialRenewalQuote,
	validRenewalQuoteInput,
	validTrialOperationId,
} from "./trial-renewal";
import { trialRenewalService } from "./trial-renewal-server";
import { resolveWebsiteSession } from "./website-session";
export type RenewalAction = "quote" | "setup" | "complete" | "cancel";
type Body =
	| RenewalQuoteInput
	| { quoteId: string; requestId: string }
	| { operationId: string }
	| { requestId: string };
type Output =
	| RenewalResult
	| RenewalSetupResult
	| (TrialRenewalQuote & { state: "quoted" });
type Deps = {
	getUser?: (request: NextRequest) => Promise<{ id: string } | null>;
	allowRequest?: (userId: string, action: RenewalAction) => Promise<boolean>;
	execute?: (userId: string, body: Body, origin: string) => Promise<Output>;
};
function validBody(action: RenewalAction, value: unknown): value is Body {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const v = value as Record<string, unknown>;
	return action === "quote"
		? validRenewalQuoteInput(value)
		: action === "setup"
			? validTrialOperationId(v.quoteId) && validTrialOperationId(v.requestId)
			: action === "complete"
				? validTrialOperationId(v.operationId)
				: validTrialOperationId(v.requestId);
}
export function createTrialRenewalHandler(
	action: RenewalAction,
	deps: Deps = {},
) {
	let service: ReturnType<typeof trialRenewalService> | undefined;
	const execute =
		deps.execute ??
		(async (user: string, body: Body, origin: string): Promise<Output> => {
			if (!service) service = trialRenewalService();
			if (action === "quote")
				return {
					...(await service.quoteTrialRenewal(user, body as RenewalQuoteInput)),
					state: "quoted",
				};
			if (action === "setup") {
				const b = body as { quoteId: string; requestId: string };
				return service.beginTrialRenewal(user, b.quoteId, b.requestId, origin);
			}
			if (action === "complete")
				return service.completeTrialRenewal(
					user,
					(body as { operationId: string }).operationId,
				);
			return service.cancelTrialRenewal(
				user,
				(body as { requestId: string }).requestId,
			);
		});
	return async (request: NextRequest) => {
		const json = (body: unknown, status: number, extra = {}) =>
			NextResponse.json(body, {
				status,
				headers: {
					"Cache-Control": "private, no-store",
					Vary: "Cookie",
					...extra,
				},
			});
		let ownerUserId: string | undefined;
		try {
			if (
				request.headers.get("origin") !== request.nextUrl.origin ||
				request.headers.get("sec-fetch-site") === "cross-site" ||
				request.headers.get("content-type")?.split(";")[0]?.trim() !==
					"application/json"
			)
				return json({ error: "Open AniDachi to manage trial renewal." }, 403);
			const user = await (
				deps.getUser ??
				((r: NextRequest) =>
					resolveWebsiteSession(r.cookies.get(REFRESH_TOKEN_COOKIE)?.value))
			)(request);
			if (!user) return json({ error: "Sign in to manage your trial." }, 401);
			if (request.headers.get(BILLING_OWNER_HEADER) !== user.id)
				return json(
					{ error: "Your signed-in account changed. Reload this page." },
					409,
				);
			ownerUserId = user.id;
			const raw = await request.text();
			if (raw.length > 4096)
				return json({ error: "Invalid trial renewal request." }, 400);
			let body: unknown;
			try {
				body = JSON.parse(raw);
			} catch {
				return json({ error: "Invalid trial renewal request." }, 400);
			}
			if (!validBody(action, body))
				return json({ error: "Review your trial renewal first." }, 400);
			if (!(await (deps.allowRequest ?? allowTrialAction)(user.id, action)))
				return json({ error: "Please wait a moment and try again." }, 429, {
					"Retry-After": "60",
				});
			const result = await execute(user.id, body, request.nextUrl.origin);
			return json(
				{ ...result, ownerUserId },
				result.state === "pending"
					? 202
					: result.state === "unavailable"
						? 503
						: ["expired", "offer_changed", "superseded"].includes(result.state)
							? 409
							: 200,
			);
		} catch (e) {
			const state = e instanceof TrialRenewalError ? e.state : "unavailable";
			return json(
				{
					state,
					...(ownerUserId ? { ownerUserId } : {}),
					error:
						"Trial renewal could not be confirmed. Refresh its status before trying again.",
				},
				state === "pending" ? 202 : state === "unavailable" ? 503 : 409,
			);
		}
	};
}
