import { type NextRequest, NextResponse } from "next/server";
import { BILLING_OWNER_HEADER } from "../billing-view";
import {
	type TrialStartInput,
	type TrialStartResult,
	validTrialStartInput,
} from "./cardless-trial";
import {
	allowTrialAction,
	cardlessTrialService,
} from "./cardless-trial-server";
import { REFRESH_TOKEN_COOKIE } from "./cookies";
import { resolveWebsiteSession } from "./website-session";

const PRIVATE_HEADERS = {
	"Cache-Control": "private, no-store",
	Vary: "Cookie",
};
type StartDeps = {
	getUser?: (request: NextRequest) => Promise<{ id: string } | null>;
	allowRequest?: (userId: string) => Promise<boolean>;
	start?: (userId: string, input: TrialStartInput) => Promise<TrialStartResult>;
	recover?: (userId: string, operationId?: string) => Promise<TrialStartResult>;
};
export function createCardlessTrialStartHandler(deps: StartDeps = {}) {
	return createCardlessTrialHandler("start", deps);
}
export function createCardlessTrialRecoveryHandler(deps: StartDeps = {}) {
	return createCardlessTrialHandler("recover", deps);
}
function validRecoveryInput(value: unknown): value is { operationId?: string } {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false;
	const id = (value as Record<string, unknown>).operationId;
	return (
		id === undefined ||
		(typeof id === "string" &&
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
				id,
			))
	);
}
function createCardlessTrialHandler(
	action: "start" | "recover",
	deps: StartDeps,
) {
	let service: ReturnType<typeof cardlessTrialService> | undefined;
	const start =
		deps.start ??
		((userId: string, input: TrialStartInput) => {
			if (!service) service = cardlessTrialService();
			return service.startCardlessTrial(userId, input);
		});
	const recover =
		deps.recover ??
		((userId: string, operationId?: string) => {
			if (!service) service = cardlessTrialService();
			return service.recoverCardlessTrial(userId, operationId);
		});
	return async (request: NextRequest) => {
		const json = (
			body: unknown,
			status: number,
			extra: Record<string, string> = {},
		) =>
			NextResponse.json(body, {
				status,
				headers: { ...PRIVATE_HEADERS, ...extra },
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
				((r: NextRequest) =>
					resolveWebsiteSession(r.cookies.get(REFRESH_TOKEN_COOKIE)?.value))
			)(request);
			if (!user) return json({ error: "Sign in to start your trial." }, 401);
			if (request.headers.get(BILLING_OWNER_HEADER) !== user.id)
				return json(
					{ error: "Your signed-in account changed. Reload this page." },
					409,
				);
			const text = await request.text();
			if (text.length > 4096)
				return json({ error: "Invalid trial request." }, 400);
			let body: unknown;
			try {
				body = JSON.parse(text);
			} catch {
				return json({ error: "Invalid trial request." }, 400);
			}
			if (
				!(action === "start"
					? validTrialStartInput(body)
					: validRecoveryInput(body))
			)
				return json({ error: "Review your trial offer first." }, 400);
			if (
				!(await (
					deps.allowRequest ?? ((id: string) => allowTrialAction(id, "start"))
				)(user.id))
			)
				return json({ error: "Please wait a moment and try again." }, 429, {
					"Retry-After": "60",
				});
			const result =
				action === "start"
					? await start(user.id, body as TrialStartInput)
					: await recover(
							user.id,
							(body as { operationId?: string }).operationId,
						);
			return json(
				{ ...result, ownerUserId: user.id },
				result.state === "active"
					? 200
					: result.state === "pending"
						? 202
						: result.state === "unavailable"
							? 503
							: 409,
			);
		} catch {
			return json(
				{
					state: "unavailable",
					error: "Your trial is temporarily unavailable. Please try again.",
				},
				503,
			);
		}
	};
}
