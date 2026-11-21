import {
	WatchHistoryCapacitySchema,
	WatchHistoryCapacityV2Schema,
	WatchHistoryCapacityV3Schema,
	WatchHistoryCapacityV4Schema,
	type WatchHistoryCapacityCompatible,
} from "@anidachi/protocol";
import { type NextRequest, NextResponse } from "next/server";
import type { ApiSession } from "./api-session";
import { db } from "./db";
import { WATCH_HISTORY_OWNER_HEADER } from "../watch-history-owner";
import { getAccountAccessSession, HISTORY_PRIVATE_HEADERS } from "./watch-history-access";
import { publicDatabaseError, WatchHistoryV3ApiError } from "./watch-history-v3";

const capacitySchemas = {
  1: WatchHistoryCapacitySchema, 2: WatchHistoryCapacityV2Schema,
  3: WatchHistoryCapacityV3Schema, 4: WatchHistoryCapacityV4Schema,
};
type CapacityVersion = keyof typeof capacitySchemas;

export type WatchHistoryCapacityStore = {
	load(userId: string, accountGeneration: number | null, capacityVersion: CapacityVersion): Promise<unknown>;
};
const productionStore: WatchHistoryCapacityStore = {
	async load(userId, accountGeneration, capacityVersion) {
		const result = await db().rpc(`get_watch_history_capacity_v${capacityVersion}`, {
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
	capacityVersion?: CapacityVersion;
	store?: WatchHistoryCapacityStore;
}): Promise<WatchHistoryCapacityCompatible> {
	try {
		const generation = params.accountGeneration ?? null;
		if (generation !== null && (!Number.isSafeInteger(generation) || generation < 1))
			throw new WatchHistoryV3ApiError(400, "INVALID_QUERY", "Invalid history generation");
		const schema = capacitySchemas[params.capacityVersion ?? 1];
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
			if (version !== null && version !== "1" && version !== "2" && version !== "3" && version !== "4")
				throw new WatchHistoryV3ApiError(400, "INVALID_QUERY", "Invalid capacity version");
			const result = await getWatchHistoryCapacity({
				capacityVersion: Number(version ?? 1) as CapacityVersion,
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
