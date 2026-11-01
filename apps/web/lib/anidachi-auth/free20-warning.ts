import {
	ACCOUNT_HOSTING_OWNER_HEADER,
	FREE20_WARNING_MAX_BODY_BYTES,
	FREE20_WARNING_MAX_AGE_MS,
	FREE20_WARNING_THRESHOLD_SECONDS,
	Free20LiveStatusSchema,
	Free20WarningContextSchema,
	Free20WarningRequestSchema,
	Free20WarningResponseSchema,
	type Free20LiveStatus,
	type Free20WarningContext,
	type Free20WarningResponse,
} from "@anidachi/protocol";
import { NextResponse, type NextRequest } from "next/server";
import {
	readFree20StatusAuthority,
	readLiveFree20Status,
	validateFree20StatusAuthority,
} from "./account-hosting-status";
import { db } from "./db";
import { getAccountAccessSession } from "./watch-history-access";
import { readBoundedJson } from "./watch-history-v3-routes";

class WarningFailure extends Error {
	constructor(
		readonly code: string,
		readonly status: number,
	) {
		super(code);
	}
}
export async function claimFree20Warning(
	userId: string,
	context: Free20WarningContext,
	live: Free20LiveStatus,
): Promise<unknown> {
	const { data, error } = await db()
		.rpc("claim_free20_daily_warning_v1", {
			p_user_id: userId,
			p_expected_context: context,
			p_live: live,
		})
		.abortSignal(AbortSignal.timeout(2000));
	if (error) {
		if (error.message === "HOSTING_WARNING_CONTEXT_CHANGED")
			throw new WarningFailure(error.message, 409);
		if (error.message === "FREE20_DISABLED")
			throw new WarningFailure(error.message, 404);
		throw new Error("Warning claim unavailable");
	}
	return data;
}
type Dependencies = {
	getSession: typeof getAccountAccessSession;
	enabled: () => boolean;
	readAuthority: typeof readFree20StatusAuthority;
	readLive: typeof readLiveFree20Status;
	claim: typeof claimFree20Warning;
	clock: () => number;
};
export function createFree20WarningHandler(
	overrides: Partial<Dependencies> = {},
) {
	const deps: Dependencies = {
		getSession: getAccountAccessSession,
		enabled: () => process.env.ANIDACHI_FREE20_ACCOUNTING_ENABLED === "true",
		readAuthority: readFree20StatusAuthority,
		readLive: readLiveFree20Status,
		claim: claimFree20Warning,
		clock: () => performance.now(),
		...overrides,
	};
	return async (request: NextRequest) => {
		const headers = {
			"Cache-Control": "private, no-store",
			Vary: "Cookie, Authorization, x-anidachi-hosting-owner",
		};
		const fail = (code: string, status: number) =>
			NextResponse.json({ code }, { status, headers });
		const started = deps.clock();
		try {
			const session = await deps.getSession(request);
			if (!session) return fail("UNAUTHORIZED", 401);
			if (request.headers.get(ACCOUNT_HOSTING_OWNER_HEADER) !== session.userId)
				return fail("HOSTING_OWNER_CHANGED", 409);
			if (!deps.enabled()) return fail("FREE20_DISABLED", 404);
			let input;
			try {
				input = Free20WarningRequestSchema.parse(
					await readBoundedJson(request, FREE20_WARNING_MAX_BODY_BYTES),
				);
			} catch {
				return fail("INVALID_HOSTING_WARNING_REQUEST", 400);
			}
			const owner = session.userId;
			const authority = validateFree20StatusAuthority(
				owner,
				await deps.readAuthority(owner),
			);
			if (!authority) return fail("FREE20_DISABLED", 404);
			const day = new Date(authority.serverTime).toISOString().slice(0, 10);
			const assigned = authority.assignment;
			if (
				input.utcDay !== day ||
				(assigned &&
					(input.roomId !== assigned.roomId ||
						input.roomGeneration !== assigned.roomGeneration))
			)
				return fail("HOSTING_WARNING_CONTEXT_CHANGED", 409);
			const negative = (
				serverTime: number,
				validUntil: number,
			): Free20WarningResponse =>
				Free20WarningResponseSchema.parse({
					...input,
					ownerUserId: owner,
					decision: "not_eligible",
					serverTime,
					validUntil: Math.min(
						validUntil,
						serverTime + FREE20_WARNING_MAX_AGE_MS,
						authority.resetAt,
					),
				});
			let result: Free20WarningResponse;
			if (
				authority.planCode !== "free" ||
				!assigned ||
				assigned.role !== "host" ||
				assigned.status === "ended" ||
				assigned.hostingTimeMode !== "daily_free20"
			) {
				result = negative(authority.serverTime, authority.refreshBy);
			} else {
				const context = Free20WarningContextSchema.parse({
					ownerUserId: owner,
					accountGeneration: authority.accountGeneration,
					accessEpoch: authority.accessEpoch,
					planCode: authority.planCode,
					grant: authority.grant,
					utcDay: day,
					serverTime: authority.serverTime,
					refreshBy: authority.refreshBy,
					resetAt: authority.resetAt,
					assignment: assigned,
				});
				const live = Free20LiveStatusSchema.parse(
					await deps.readLive({
						ownerUserId: owner,
						roomId: assigned.roomId,
						roomGeneration: assigned.roomGeneration,
					}),
				);
				// DO already combines durable and unsettled usage. Never add committedSeconds.
				if (
					live.ownerUserId !== owner ||
					live.roomId !== assigned.roomId ||
					live.roomGeneration !== assigned.roomGeneration ||
					live.utcDay !== day ||
					live.serverTime < authority.serverTime ||
					live.serverTime >= authority.refreshBy
				)
					throw new Error("Stale live context");
				if (
					live.access.remainingSeconds === 0 ||
					live.access.remainingSeconds > FREE20_WARNING_THRESHOLD_SECONDS
				) {
					result = negative(
						live.serverTime,
						Math.min(live.validUntil, authority.refreshBy),
					);
				} else {
					result = Free20WarningResponseSchema.parse(
						await deps.claim(owner, context, live),
					);
					if (
						result.ownerUserId !== owner ||
						result.roomId !== input.roomId ||
						result.roomGeneration !== input.roomGeneration ||
						result.utcDay !== day ||
						result.serverTime < live.serverTime ||
						result.validUntil >
							Math.min(live.validUntil, authority.refreshBy) ||
						(result.decision === "show" &&
							live.access.metering &&
							result.validUntil >
								live.serverTime + live.access.remainingSeconds * 1000)
					)
						throw new Error("Invalid claim context");
				}
			}
			// Include the whole monotonic request duration conservatively, even work
			// before SQL measured time. Lost/expired replies never reissue the marker.
			const elapsed = deps.clock() - started;
			if (!Number.isFinite(elapsed) || elapsed < 0)
				throw new Error("Invalid elapsed time");
			result = Free20WarningResponseSchema.parse({
				...result,
				validUntil: Math.floor(result.validUntil - elapsed),
			});
			return NextResponse.json(result, { headers });
		} catch (error) {
			return error instanceof WarningFailure
				? fail(error.code, error.status)
				: fail("HOSTING_WARNING_UNAVAILABLE", 503);
		}
	};
}
