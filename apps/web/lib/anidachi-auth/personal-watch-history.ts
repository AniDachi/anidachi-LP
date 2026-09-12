import {
	PersonalWatchProgressRequestSchema,
	WatchProgressAckSchema,
	type PersonalWatchProgressRequest,
	type WatchProgressAck,
} from "@anidachi/protocol";
import { db } from "./db";
import {
	publicDatabaseError,
	WatchHistoryV3ApiError,
} from "./watch-history-v3";
export type PersonalWatchHistoryStore = {
	apply(userId: string, input: PersonalWatchProgressRequest): Promise<unknown>;
};
const productionStore: PersonalWatchHistoryStore = {
	async apply(userId, input) {
		const result = await db()
			.rpc("apply_personal_watch_progress_v1", {
				p_user_id: userId,
				p_input: input,
			})
			.abortSignal(AbortSignal.timeout(10_000));
		if (result.error) throw result.error;
		return result.data;
	},
};
export async function applyPersonalWatchProgress(params: {
	userId: string;
	input: unknown;
	store?: PersonalWatchHistoryStore;
}): Promise<WatchProgressAck> {
	if (
		params.input &&
		typeof params.input === "object" &&
		!("captureVersion" in params.input)
	)
		throw new WatchHistoryV3ApiError(
			426,
			"HISTORY_CLIENT_UPDATE_REQUIRED",
			"Update the extension to continue personal history",
		);
	const parsed = PersonalWatchProgressRequestSchema.safeParse(params.input);
	if (!parsed.success)
		throw new WatchHistoryV3ApiError(
			400,
			"INVALID_REQUEST",
			"Invalid personal progress envelope",
		);
	try {
		const result = WatchProgressAckSchema.safeParse(
			await (params.store ?? productionStore).apply(params.userId, parsed.data),
		);
		if (
			!result.success ||
			result.data.meta.ownerUserId !== params.userId ||
			result.data.acceptedEventId !== parsed.data.event.clientEventId ||
			result.data.accountGeneration !== parsed.data.event.accountGeneration
		)
			throw new WatchHistoryV3ApiError(
				502,
				"INVALID_DATABASE_RESPONSE",
				"Invalid personal history acknowledgement",
			);
		return result.data;
	} catch (error) {
		throw publicDatabaseError(error);
	}
}
