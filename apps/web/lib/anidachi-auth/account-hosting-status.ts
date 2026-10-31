import {
	ACCOUNT_HOSTING_OWNER_HEADER,
	AccountHostingStatusSchema,
	Free20LiveStatusSchema,
	Free20AccountAuthoritySchema,
	type Free20AccountAuthority as Authority,
	type AccountHostingStatus,
	type Free20LiveStatusRequest,
} from "@anidachi/protocol";
import { NextResponse, type NextRequest } from "next/server";
import { internalServiceAuthorization } from "../internal-service-auth";
import { db } from "./db";
import { getAccountAccessSession } from "./watch-history-access";

function authorityFor(owner: string, raw: unknown): Authority | null {
	if (
		raw &&
		typeof raw === "object" &&
		!Array.isArray(raw) &&
		Object.keys(raw).length === 1 &&
		(raw as { enabled?: unknown }).enabled === false
	)
		return null;
	const value = Free20AccountAuthoritySchema.parse(raw);
	const midnight = (Math.floor(value.serverTime / 86_400_000) + 1) * 86_400_000;
	if (
		value.ownerUserId !== owner ||
		value.resetAt !== midnight ||
		value.refreshBy <= value.serverTime ||
		value.refreshBy > Math.min(midnight, value.serverTime + 300_000) ||
		(value.planCode === "free") !== (value.grant === null) ||
		(value.grant?.validUntil === null && value.grant.source !== "manual") ||
		(value.grant?.validUntil != null &&
			value.refreshBy > value.grant.validUntil) ||
		(value.assignment?.role === "host" && value.assignment.hostUserId !== owner)
	)
		throw new Error("Inconsistent account authority");
	return value;
}

export async function readFree20StatusAuthority(
	userId: string,
): Promise<unknown> {
	const { data, error } = await db()
		.rpc("read_free20_account_status_v1", { p_user_id: userId })
		.abortSignal(AbortSignal.timeout(2000));
	if (error) throw new Error("Account hosting authority unavailable");
	return data;
}
export async function readLiveFree20Status(
	request: Free20LiveStatusRequest,
): Promise<unknown> {
	const base = process.env.ANIDACHI_API_INTERNAL_BASE_URL;
	const secret = process.env.ANIDACHI_INTERNAL_API_SECRET;
	if (!base || !secret) throw new Error("Live status is not configured");
	const response = await fetch(
		new URL(
			`/internal/rooms/${encodeURIComponent(request.roomId)}/free20-status`,
			base,
		),
		{
			method: "POST",
			headers: {
				Authorization: internalServiceAuthorization(secret),
				"Content-Type": "application/json",
			},
			body: JSON.stringify(request),
			cache: "no-store",
			redirect: "error",
			signal: AbortSignal.timeout(2000),
		},
	);
	if (response.status !== 200)
		throw new Error("Live hosting status unavailable");
	return response.json();
}

type Dependencies = {
	getSession: typeof getAccountAccessSession;
	enabled: () => boolean;
	readAuthority: typeof readFree20StatusAuthority;
	readLive: typeof readLiveFree20Status;
	/** Monotonic elapsed request time, never the user's clock. */
	clock: () => number;
};
function sameAuthority(a: Authority, b: Authority) {
	return (
		a.ownerUserId === b.ownerUserId &&
		a.planCode === b.planCode &&
		a.resetAt === b.resetAt &&
		a.accountGeneration === b.accountGeneration &&
		a.accessEpoch === b.accessEpoch &&
		JSON.stringify(a.grant) === JSON.stringify(b.grant) &&
		JSON.stringify(a.assignment) === JSON.stringify(b.assignment)
	);
}

async function resolveStatus(
	owner: string,
	deps: Dependencies,
): Promise<AccountHostingStatus | null> {
	const first = authorityFor(owner, await deps.readAuthority(owner));
	if (!first) return null;
	const activeRoom = first.assignment
		? { roomId: first.assignment.roomId, role: first.assignment.role }
		: null;
	const context = {
		accountHostingVersion: 1 as const,
		ownerUserId: owner,
		planCode: first.planCode,
		serverTime: first.serverTime,
		validUntil: first.refreshBy,
		period: {
			utcDay: new Date(first.serverTime).toISOString().slice(0, 10),
			resetAt: first.resetAt,
		},
		activeRoom,
	};
	if (first.grant)
		return AccountHostingStatusSchema.parse({
			...context,
			access: { kind: "confirmed_unlimited", ...first.grant },
			canCreateRoom: activeRoom === null,
		});
	if (first.assignment?.role === "host") {
		const assignment = first.assignment;
		if (
			assignment.hostingTimeMode !== "daily_free20" ||
			assignment.status === "ended"
		)
			throw new Error("Unsettled or legacy hosting assignment");
		const live = Free20LiveStatusSchema.parse(
			await deps.readLive({
				ownerUserId: owner,
				roomId: assignment.roomId,
				roomGeneration: assignment.roomGeneration,
			}),
		);
		if (
			live.ownerUserId !== owner ||
			live.roomId !== assignment.roomId ||
			live.roomGeneration !== assignment.roomGeneration ||
			live.utcDay !== context.period.utcDay
		)
			throw new Error("Live status binding changed");
		const current = authorityFor(owner, await deps.readAuthority(owner));
		if (!current || !sameAuthority(first, current))
			throw new Error("Account context changed during live read");
		// The live view already includes the account checkpoint plus unsettled room
		// time. Never add the SQL total again or subtract a newer independent ACK.
		return AccountHostingStatusSchema.parse({
			...context,
			serverTime: live.serverTime,
			validUntil: Math.min(first.refreshBy, current.refreshBy, live.validUntil),
			access: live.access,
			canCreateRoom: false,
		});
	}
	const used = Math.min(1200, first.committedSeconds);
	return AccountHostingStatusSchema.parse({
		...context,
		access: {
			kind: "daily_free",
			budgetSeconds: 1200,
			usedSeconds: used,
			remainingSeconds: 1200 - used,
			metering: false,
		},
		canCreateRoom: activeRoom === null && used < 1200,
	});
}

/** Explicit on-demand display read; existing clients/requests do not call it.
 * Unknown data denies a successful snapshot. All room actions recheck authority.
 */
export function createAccountHostingStatusHandler(
	overrides: Partial<Dependencies> = {},
) {
	const deps: Dependencies = {
		getSession: getAccountAccessSession,
		enabled: () => process.env.ANIDACHI_FREE20_ACCOUNTING_ENABLED === "true",
		readAuthority: readFree20StatusAuthority,
		readLive: readLiveFree20Status,
		clock: () => performance.now(),
		...overrides,
	};
	return async (request: NextRequest) => {
		const headers = {
			"Cache-Control": "private, no-store",
			Vary: "Cookie, Authorization, x-anidachi-hosting-owner",
		};
		const failure = (code: string, status: number) =>
			NextResponse.json({ code }, { status, headers });
		const started = deps.clock();
		try {
			const session = await deps.getSession(request);
			if (!session) return failure("UNAUTHORIZED", 401);
			if (request.headers.get(ACCOUNT_HOSTING_OWNER_HEADER) !== session.userId)
				return failure("HOSTING_OWNER_CHANGED", 409);
			if (!deps.enabled()) return failure("FREE20_DISABLED", 404);
			const status = await resolveStatus(session.userId, deps);
			if (!status) return failure("FREE20_DISABLED", 404);
			// Conservatively include all work, even before the authority measured its
			// clock, so a short-lived grant cannot expire during response assembly.
			const elapsed = deps.clock() - started;
			if (
				!Number.isFinite(elapsed) ||
				elapsed < 0 ||
				status.validUntil - status.serverTime <= elapsed
			)
				throw new Error("Hosting status expired during read");
			return NextResponse.json(status, { headers });
		} catch {
			return failure("HOSTING_STATUS_UNAVAILABLE", 503);
		}
	};
}
