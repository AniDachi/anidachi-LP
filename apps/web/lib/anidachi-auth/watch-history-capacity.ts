import {
	WatchHistoryCapacitySchema,
	WatchHistoryCapacityV2Schema,
	type WatchHistoryCapacityCompatible,
} from "@anidachi/protocol";
import { type NextRequest, NextResponse } from "next/server";
import type { ApiSession } from "./api-session";
import { db } from "./db";
import { WATCH_HISTORY_OWNER_HEADER } from "../watch-history-owner";
import { getAccountAccessSession, HISTORY_PRIVATE_HEADERS } from "./watch-history-access";
import { publicDatabaseError, WatchHistoryV3ApiError } from "./watch-history-v3";

export type WatchHistoryCapacityStore = {
	load(userId: string, accountGeneration: number | null, capacityVersion: 1 | 2): Promise<unknown>;
};
const productionStore: WatchHistoryCapacityStore = {
	async load(userId, accountGeneration, capacityVersion) {
		const result = await db().rpc(capacityVersion === 2 ? "get_watch_history_capacity_v2" : "get_watch_history_capacity_v1", {
			p_user_id: userId,
			p_history_generation: accountGeneration,
		}).abortSignal(AbortSignal.timeout(10_000));
		if (result.error) throw result.error;
		return result.data;
	},
};

/** One database snapshot; no plan gate, mutation, cache, or paginated truncation. */
export async function getWatchHistoryCapacity(params: {
	userId: string;
	accountGeneration?: number | null;
	capacityVersion?: 1 | 2;
	store?: WatchHistoryCapacityStore;
}): Promise<WatchHistoryCapacityCompatible> {
	try {
		const generation = params.accountGeneration ?? null;
		if (generation !== null && (!Number.isSafeInteger(generation) || generation < 1))
			throw new WatchHistoryV3ApiError(400, "INVALID_QUERY", "Invalid history generation");
		const schema = params.capacityVersion === 2 ? WatchHistoryCapacityV2Schema : WatchHistoryCapacitySchema;
		const result = schema.safeParse(
			await (params.store ?? productionStore).load(params.userId, generation, params.capacityVersion ?? 1),
		);
		if (!result.success || result.data.ownerUserId !== params.userId)
			throw new WatchHistoryV3ApiError(502, "INVALID_DATABASE_RESPONSE", "Invalid history capacity response");
		if (generation !== null && result.data.accountGeneration !== generation)
			throw new WatchHistoryV3ApiError(409, "GENERATION_MISMATCH", "Watch history generation changed");
		return result.data;
	} catch (error) {
		throw publicDatabaseError(error);
	}
}

export function createWatchHistoryCapacityHandler(deps: {
	getSession?(request: NextRequest): Promise<ApiSession | null>;
	store?: WatchHistoryCapacityStore;
} = {}) {
	return async (request: NextRequest) => {
		try {
			const session = await (deps.getSession ?? getAccountAccessSession)(request);
			if (!session) throw new WatchHistoryV3ApiError(401, "UNAUTHORIZED", "Authentication required");
			const owner = request.headers.get(WATCH_HISTORY_OWNER_HEADER);
			if (owner && owner !== session.userId)
				throw new WatchHistoryV3ApiError(409, "HISTORY_ACCESS_CHANGED", "History owner changed");
			const raw = request.nextUrl.searchParams.get("accountGeneration");
			if (raw !== null && !/^[1-9][0-9]*$/.test(raw))
				throw new WatchHistoryV3ApiError(400, "INVALID_QUERY", "Invalid history generation");
			const version = request.nextUrl.searchParams.get("capacityVersion");
			if (version !== null && version !== "1" && version !== "2")
				throw new WatchHistoryV3ApiError(400, "INVALID_QUERY", "Invalid capacity version");
			const result = await getWatchHistoryCapacity({
				capacityVersion: version === "2" ? 2 : 1,
				userId: session.userId,
				accountGeneration: raw === null ? null : Number(raw),
				store: deps.store,
			});
			return NextResponse.json(result, { headers: HISTORY_PRIVATE_HEADERS });
		} catch (error) {
			const failure = publicDatabaseError(error);
			return NextResponse.json({ error: failure.code, code: failure.code }, {
				status: failure.status, headers: HISTORY_PRIVATE_HEADERS,
			});
		}
	};
}
