import { type NextRequest, NextResponse } from "next/server";
import { BILLING_OWNER_HEADER } from "../billing-view";
import type { PricingOffer } from "../pricing-offer";
import { allowTrialAction } from "./cardless-trial-server";
import { REFRESH_TOKEN_COOKIE } from "./cookies";
import { db } from "./db";
import { getPricingOffer } from "./pricing-offer";
import { resolveWebsiteSession } from "./website-session";
import { restrictTrialOffer } from "./trial-abuse-offer";
import {
	createTrialAbuseTokens,
	trialBrowserCookieName,
	trialDenialCookieName,
	TRIAL_DENIAL_MAX_AGE,
	type TrialAbuseMarkers,
} from "./trial-abuse";

type MarkerStatus = "available" | "used" | "busy" | "account_changed";
async function readMarkerStatus(
	owner: string,
	markers: TrialAbuseMarkers,
): Promise<MarkerStatus> {
	const { data, error } = await db()
		.rpc("read_trial_marker_status_v1", {
			p_user_id: owner,
			p_browser_hash: markers.browser,
			p_installation_hash: markers.installation ?? null,
		})
		.abortSignal(AbortSignal.timeout(8000));
	if (error || !["available", "used", "busy", "account_changed"].includes(data))
		throw new Error("Trial offer unavailable");
	return data as MarkerStatus;
}
type Deps = {
	getUser?: (request: NextRequest) => Promise<{ id: string } | null>;
	getOffer?: (owner: string) => Promise<PricingOffer>;
	readMarkers?: (
		owner: string,
		markers: TrialAbuseMarkers,
	) => Promise<MarkerStatus>;
	allowRequest?: (owner: string) => Promise<boolean>;
	tokens?: (origin: string) => ReturnType<typeof createTrialAbuseTokens>;
};
/** Read-only eligibility display; never calls the activation or Stripe services. */
export function createTrialOfferHandler(deps: Deps = {}) {
	return async (request: NextRequest) => {
		let owner: string | undefined;
		const json = (body: Record<string, unknown>, status = 200) =>
			NextResponse.json(
				{ ...body, ...(owner ? { ownerUserId: owner } : {}) },
				{
					status,
					headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
				},
			);
		try {
			if (
				request.headers.get("origin") !== request.nextUrl.origin ||
				request.headers.get("sec-fetch-site") === "cross-site" ||
				request.headers.get("content-type")?.split(";")[0]?.trim() !==
					"application/json"
			)
				return json({ error: "Open AniDachi to view your plans." }, 403);
			const user = await (
				deps.getUser ??
				((r) =>
					resolveWebsiteSession(r.cookies.get(REFRESH_TOKEN_COOKIE)?.value))
			)(request);
			if (!user) return json({ error: "Sign in to view your plans." }, 401);
			owner = user.id;
			if (request.headers.get(BILLING_OWNER_HEADER) !== owner)
				return json(
					{ error: "Your signed-in account changed. Reload this page." },
					409,
				);
			const text = await request.text();
			if (text.length > 6144)
				return json({ error: "Invalid trial request." }, 400);
			let input: { requestId?: unknown; extensionProof?: unknown };
			try {
				input = JSON.parse(text);
			} catch {
				return json({ error: "Invalid trial request." }, 400);
			}
			if (
				!input ||
				typeof input.requestId !== "string" ||
				!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
					input.requestId,
				)
			)
				return json({ error: "Invalid trial request." }, 400);
			if (
				!(await (deps.allowRequest ?? ((u) => allowTrialAction(u, "offer")))(
					owner,
				))
			)
				return json({ error: "Please wait a moment and try again." }, 429);
			const getOffer = deps.getOffer ?? getPricingOffer;
			let offer = await getOffer(owner);
			if (offer.ownerUserId !== owner) throw new Error("Account mismatch");
			if (
				offer.action !== "trial" ||
				offer.trialMode !== "cardless" ||
				offer.pendingTrialActivation
			)
				return json({ state: "ready", offer });
			const origin = request.nextUrl.origin;
			const tokens = (
				deps.tokens ??
				((o) =>
					createTrialAbuseTokens(process.env.ANIDACHI_JWT_SECRET ?? "", o))
			)(origin);
			let markers: TrialAbuseMarkers;
			try {
				markers = await tokens.markers(
					request.cookies.get(trialBrowserCookieName(origin))?.value,
					owner,
					input.requestId,
					input.extensionProof,
				);
			} catch {
				return json({ state: "context_required" }, 409);
			}
			const result = await (deps.readMarkers ?? readMarkerStatus)(
				owner,
				markers,
			);
			if (result === "busy") return json({ state: "trial_busy" }, 409);
			if (result === "account_changed") {
				offer = await getOffer(owner);
				if (offer.ownerUserId !== owner || offer.action === "trial")
					throw new Error("Account offer changed");
				return json({ state: "ready", offer });
			}
			if (result !== "available" && result !== "used")
				throw new Error("Invalid marker result");
			const response = json({
				state: "ready",
				offer: restrictTrialOffer(offer, result === "used"),
			});
			if (result === "used")
				response.cookies.set(
					trialDenialCookieName(origin),
					tokens.issueDenial(markers.browser, owner),
					{
						httpOnly: true,
						secure: request.nextUrl.protocol === "https:",
						sameSite: "lax",
						path: "/",
						maxAge: TRIAL_DENIAL_MAX_AGE,
					},
				);
			return response;
		} catch {
			return json(
				{
					state: "unavailable",
					error: "We could not load your plans. Please try again.",
				},
				503,
			);
		}
	};
}
