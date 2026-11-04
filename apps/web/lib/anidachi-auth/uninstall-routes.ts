import { createHmac } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { REFRESH_TOKEN_COOKIE } from "./cookies";
import { getJwtSecret } from "./jwt";
import { SubscriptionCheckoutError } from "./subscription-trial";
import {
	UNINSTALL_OFFER_VALID_FOR_MS,
	UNINSTALL_REASONS,
	type UninstallCheckoutInput,
	UninstallError,
	type UninstallFeedbackInput,
} from "./uninstall-offer";
import { uninstallService } from "./uninstall-offer-server";
import { storeUninstallFeedback } from "./uninstall-store";
import { resolveWebsiteSession } from "./website-session";

const PRIVATE_HEADERS = {
	"Cache-Control": "private, no-store",
	Vary: "Cookie",
	"X-Robots-Tag": "noindex, nofollow",
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function boundedBody(
	request: NextRequest,
): Promise<Record<string, unknown>> {
	if (Number(request.headers.get("content-length")) > 8192)
		throw new UninstallError(413, "Your response is too long.");
	const reader = request.body?.getReader();
	if (!reader) throw new UninstallError(400, "Request body required.");
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		for (;;) {
			const { value, done } = await reader.read();
			if (done) break;
			size += value.length;
			if (size > 8192) {
				await reader.cancel();
				throw new UninstallError(413, "Your response is too long.");
			}
			chunks.push(value);
		}
		const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
		if (!body || typeof body !== "object" || Array.isArray(body))
			throw new Error();
		return body;
	} catch (e) {
		if (e instanceof UninstallError) throw e;
		throw new UninstallError(400, "Invalid request.");
	} finally {
		reader.releaseLock();
	}
}
export function createUninstallHandlers(
	deps: {
		service?: ReturnType<typeof uninstallService>;
		getUser?: (request: NextRequest) => Promise<{ id: string } | null>;
		feedback?: typeof storeUninstallFeedback;
		actorHash?: (request: NextRequest, userId: string | null) => string;
	} = {},
) {
	const getUser =
		deps.getUser ??
		((r: NextRequest) =>
			resolveWebsiteSession(r.cookies.get(REFRESH_TOKEN_COOKIE)?.value));
	async function handle(
		request: NextRequest,
		action: "offer" | "checkout" | "claim" | "feedback",
	) {
		let ownerUserId: string | null = null;
		try {
			if (
				action !== "offer" &&
				(request.headers.get("origin") !== request.nextUrl.origin ||
					request.headers.get("sec-fetch-site") === "cross-site" ||
					request.headers.get("content-type")?.split(";")[0].trim() !==
						"application/json")
			)
				throw new UninstallError(403, "Open the uninstall page to continue.");
			const user = await getUser(request);
			ownerUserId = user?.id ?? null;
			if (action === "offer" && !user)
				return NextResponse.json(
					{
						kind: "sign_in",
						ownerUserId: null,
						validForMs: UNINSTALL_OFFER_VALID_FOR_MS,
						loginUrl: "/login?next=%2Funinstall",
					},
					{ headers: PRIVATE_HEADERS },
				);
			if (action === "offer")
				return NextResponse.json(
					await (deps.service ?? uninstallService()).offer(ownerUserId),
					{ headers: PRIVATE_HEADERS },
				);
			const body = await boundedBody(request);
			if (action === "feedback") {
				if (
					typeof body.submissionId !== "string" ||
					!uuid.test(body.submissionId) ||
					!UNINSTALL_REASONS.includes(body.reason as never) ||
					(body.note !== undefined &&
						(typeof body.note !== "string" ||
							body.note.length > 500 ||
							Buffer.byteLength(body.note) > 2000)) ||
					Object.keys(body).some(
						(k) => !["submissionId", "reason", "note"].includes(k),
					)
				)
					throw new UninstallError(
						400,
						"Choose one reason and a note of up to 500 characters.",
					);
				const actorHash =
					deps.actorHash?.(request, ownerUserId) ??
					createHmac("sha256", getJwtSecret())
						.update(
							"uninstall-feedback-v1\0" +
								(ownerUserId
									? "user:" + ownerUserId
									: "ip:" +
										(request.headers
											.get("x-forwarded-for")
											?.split(",")[0]
											?.trim() ||
											request.headers.get("x-real-ip") ||
											"unknown")),
						)
						.digest("hex");
				return NextResponse.json(
					await (deps.feedback ?? storeUninstallFeedback)(
						body as UninstallFeedbackInput,
						ownerUserId,
						actorHash,
					),
					{ headers: PRIVATE_HEADERS },
				);
			}
			if (!user) throw new UninstallError(401, "Sign in to review this offer.");
			if (body.expectedOwnerUserId !== user.id)
				throw new UninstallError(
					409,
					"Your account changed. Reload the offer.",
				);
			if (
				typeof body.revision !== "string" ||
				body.revision.length > 128 ||
				!body.revision
			)
				throw new UninstallError(400, "Review the current offer first.");
			const service = deps.service ?? uninstallService();
			if (action === "claim") {
				if (
					Object.keys(body).some(
						(k) => !["expectedOwnerUserId", "revision"].includes(k),
					)
				)
					throw new UninstallError(400, "Invalid claim request.");
				return NextResponse.json(
					await service.claim(user.id, {
						expectedOwnerUserId: user.id,
						revision: body.revision,
					}),
					{ headers: PRIVATE_HEADERS },
				);
			}
			if (
				!["plus", "pro"].includes(body.planCode as string) ||
				typeof body.requestId !== "string" ||
				!uuid.test(body.requestId) ||
				!body.expectedPrice ||
				typeof body.expectedPrice !== "object" ||
				Array.isArray(body.expectedPrice) ||
				Object.keys(body).some(
					(k) =>
						![
							"expectedOwnerUserId",
							"revision",
							"planCode",
							"requestId",
							"expectedPrice",
						].includes(k),
				)
			)
				throw new UninstallError(400, "Review a monthly plan before checkout.");
			return NextResponse.json(
				await service.checkout(
					user.id,
					body as UninstallCheckoutInput,
					request.nextUrl.origin,
				),
				{ headers: PRIVATE_HEADERS },
			);
		} catch (e) {
			const status =
				e instanceof UninstallError || e instanceof SubscriptionCheckoutError
					? e.status
					: 503;
			const message =
				e instanceof UninstallError
					? e.message
					: "We could not confirm the result. Please retry or reload the offer.";
			return NextResponse.json(
				{ error: message, ownerUserId },
				{ status, headers: PRIVATE_HEADERS },
			);
		}
	}
	return {
		offer: (r: NextRequest) => handle(r, "offer"),
		checkout: (r: NextRequest) => handle(r, "checkout"),
		claim: (r: NextRequest) => handle(r, "claim"),
		feedback: (r: NextRequest) => handle(r, "feedback"),
	};
}
