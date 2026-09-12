import { type NextRequest, NextResponse } from "next/server";
import { BILLING_OWNER_HEADER } from "../billing-view";
import {
	BillingError,
	type BillingService,
	createBillingService,
} from "./billing";
import { REFRESH_TOKEN_COOKIE } from "./cookies";
import { resolveWebsiteSession } from "./website-session";

const PRIVATE_HEADERS = {
	"Cache-Control": "private, no-store",
	Vary: "Cookie",
};

export function createBillingHandlers(
	deps: {
		service?: BillingService;
		getUser?: (request: NextRequest) => Promise<{ id: string } | null>;
	} = {},
) {
	const service = deps.service ?? createBillingService();
	const getUser =
		deps.getUser ??
		((request: NextRequest) =>
			resolveWebsiteSession(request.cookies.get(REFRESH_TOKEN_COOKIE)?.value));

	async function handle(
		request: NextRequest,
		action: "overview" | "refresh" | "cancel",
	) {
		try {
			if (
				action !== "overview" &&
				(request.headers.get("origin") !== request.nextUrl.origin ||
					request.headers.get("sec-fetch-site") === "cross-site" ||
					request.headers.get("content-type")?.split(";")[0]?.trim() !==
						"application/json")
			)
				throw new BillingError(
					403,
					"Open your account to manage your subscription.",
				);
			const user = await getUser(request);
			if (!user)
				throw new BillingError(401, "Sign in to manage your subscription.");
			if (request.headers.get(BILLING_OWNER_HEADER) !== user.id) {
				throw new BillingError(
					409,
					"Your signed-in account changed. Reload this page.",
				);
			}
			if (action === "cancel") {
				const body = await request.json().catch(() => null);
				if (
					typeof body?.subscriptionId !== "string" ||
					!body.subscriptionId ||
					body.subscriptionId.length > 100
				) {
					throw new BillingError(
						400,
						"Select a subscription from your account.",
					);
				}
				const returnUrl = new URL(
					"/account/billing?billing=return",
					request.nextUrl.origin,
				).toString();
				const url = await service.cancellationPortal(
					user.id,
					body.subscriptionId,
					returnUrl,
				);
				return NextResponse.json(
					{ url, ownerUserId: user.id },
					{ headers: PRIVATE_HEADERS },
				);
			}
			if (action === "refresh") await service.refresh(user.id);
			return NextResponse.json(await service.overview(user.id), {
				headers: PRIVATE_HEADERS,
			});
		} catch (error) {
			// Never log Stripe session URLs, customer identifiers, or upstream error payloads.
			const failure =
				error instanceof BillingError
					? error
					: new BillingError(
							503,
							"Billing is temporarily unavailable. Please try again or contact support.",
						);
			return NextResponse.json(
				{ error: failure.message },
				{ status: failure.status, headers: PRIVATE_HEADERS },
			);
		}
	}
	return {
		getOverview: (request: NextRequest) => handle(request, "overview"),
		refresh: (request: NextRequest) => handle(request, "refresh"),
		cancellationPortal: (request: NextRequest) => handle(request, "cancel"),
	};
}
