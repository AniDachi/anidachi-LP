import {
	WatchHistoryBrowseQuerySchema,
	WatchHistoryBrowseResponseSchema,
	WatchHistoryBrowseTitleEpisodesQuerySchema,
	WatchHistoryBrowseTitleEpisodesResponseSchema,
	WatchHistoryBrowseSessionsQuerySchema,
	WatchHistoryBrowseSessionsResponseSchema,
	WatchHistoryBrowseOptionsQuerySchema,
	WatchHistoryBrowseOptionsResponseSchema,
	WatchHistoryBrowseDatabasePageSchema,
	WatchHistoryBrowseDatabaseOptionsSchema,
	type WatchHistoryBrowseResponse,
	type WatchHistoryBrowseTitleEpisodesResponse,
	type WatchHistoryBrowseSessionsResponse,
	type WatchHistoryBrowseOptionsResponse,
} from "@anidachi/protocol";
import { db } from "./db";
import {
	buildWatchHistoryV3Response,
	buildWatchHistoryTitleEpisodesV3Response,
	loadCanonicalSessions,
	WatchHistoryV3ApiError,
} from "./watch-history-v3";

export type WatchHistoryBrowseScope =
	| "titles"
	| "episodes"
	| "sessions"
	| "options";
export type WatchHistoryBrowseStore = {
	browse(
		userId: string,
		query: Record<string, unknown>,
		scope: WatchHistoryBrowseScope,
	): Promise<unknown>;
};
type Params = {
	userId: string;
	input: unknown;
	store?: WatchHistoryBrowseStore;
	now?: Date;
};
export const browseQuerySchemas = {
	titles: WatchHistoryBrowseQuerySchema,
	episodes: WatchHistoryBrowseTitleEpisodesQuerySchema,
	sessions: WatchHistoryBrowseSessionsQuerySchema,
	options: WatchHistoryBrowseOptionsQuerySchema,
};
function invalidDatabase(): never {
	throw new WatchHistoryV3ApiError(
		502,
		"INVALID_DATABASE_RESPONSE",
		"Watch history response is invalid",
	);
}
function parseDatabase<T>(
	schema: {
		safeParse(value: unknown): { success: true; data: T } | { success: false };
	},
	value: unknown,
): T {
	const result = schema.safeParse(value);
	return result.success ? result.data : invalidDatabase();
}
export function parseWatchHistoryBrowseQuery(
	input: unknown,
	scope: WatchHistoryBrowseScope,
) {
	const parsed = browseQuerySchemas[scope].safeParse(input);
	if (!parsed.success)
		throw new WatchHistoryV3ApiError(
			400,
			"INVALID_QUERY",
			"History filters are invalid",
		);
	if (parsed.data.cursor) {
		try {
			if (!/^(?:[0-9a-f]{2})+$/.test(parsed.data.cursor))
				throw new Error("invalid");
			const cursor: unknown = JSON.parse(
				Buffer.from(parsed.data.cursor, "hex").toString("utf8"),
			);
			if (
				!Array.isArray(cursor) ||
				cursor.length !== 3 ||
				typeof cursor[0] !== "string" ||
				!/^[0-9a-f]{32}$/.test(cursor[0]) ||
				typeof cursor[1] !== "string" ||
				!Number.isFinite(Date.parse(cursor[1])) ||
				typeof cursor[2] !== "string" ||
				cursor[2].length > 50
			)
				throw new Error("invalid");
		} catch {
			throw new WatchHistoryV3ApiError(
				400,
				"INVALID_CURSOR",
				"History cursor is invalid",
			);
		}
	}
	return parsed.data;
}
export const supabaseWatchHistoryBrowseStore: WatchHistoryBrowseStore = {
	async browse(userId, query, scope) {
		const result = await db().rpc("browse_watch_history_v3", {
			p_user_id: userId,
			p_query: query,
			p_scope: scope,
		});
		if (result.error) throw result.error;
		if (scope === "options") return result.data;
		const raw = WatchHistoryBrowseDatabasePageSchema.safeParse({
			...result.data,
			sessions: [],
		});
		if (!raw.success) return invalidDatabase();
		const sessions = await loadCanonicalSessions(userId, raw.data.sessionIds);
		const settings = await db()
			.from("user_watch_settings")
			.select("history_generation")
			.eq("user_id", userId)
			.maybeSingle();
		if (settings.error) throw settings.error;
		if (
			(settings.data?.history_generation ?? 1) !== raw.data.accountGeneration ||
			sessions.some(
				(r) => !r.session.participants.some((p) => p.user.userId === userId),
			)
		)
			throw new WatchHistoryV3ApiError(
				409,
				"GENERATION_MISMATCH",
				"History changed; refresh the result",
			);
		return { ...result.data, sessions };
	},
};

export async function readWatchHistoryBrowseV3(
	params: Params,
	scope: WatchHistoryBrowseScope,
): Promise<
	| WatchHistoryBrowseResponse
	| WatchHistoryBrowseTitleEpisodesResponse
	| WatchHistoryBrowseSessionsResponse
	| WatchHistoryBrowseOptionsResponse
> {
	const query = parseWatchHistoryBrowseQuery(params.input, scope);
	if (
		!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
			params.userId,
		)
	)
		throw new WatchHistoryV3ApiError(
			400,
			"INVALID_QUERY",
			"History owner is invalid",
		);
	try {
		const value = await (
			params.store ?? supabaseWatchHistoryBrowseStore
		).browse(params.userId, query, scope);
		const now = params.now ?? new Date();
		if (scope === "options") {
			const raw = parseDatabase(WatchHistoryBrowseDatabaseOptionsSchema, value);
			const meta = {
				serverTime: now.toISOString(),
				schemaVersion: 3 as const,
				ownerUserId: params.userId,
				accountGeneration: raw.accountGeneration,
			};
			return parseDatabase(WatchHistoryBrowseOptionsResponseSchema, {
				meta,
				options: raw.options,
				nextCursor: raw.nextCursor,
			});
		}
		const raw = parseDatabase(WatchHistoryBrowseDatabasePageSchema, value);
		const meta = {
			serverTime: now.toISOString(),
			schemaVersion: 3 as const,
			ownerUserId: params.userId,
			accountGeneration: raw.accountGeneration,
		};
		if (
			raw.hasMore !== (raw.nextCursor !== null) ||
			raw.sessionIds.length !== new Set(raw.sessionIds).size ||
			raw.sessions.length !== raw.sessionIds.length ||
			raw.sessions.some(
				(r) =>
					!raw.sessionIds.includes(r.session.id) ||
					!r.session.participants.some((p) => p.user.userId === params.userId),
			)
		)
			return invalidDatabase();
		const times = new Map(
			raw.sessionTimes.map((t) => [t.sessionId, t.lastWatchedAt]),
		);
		if (
			times.size !== raw.sessionIds.length ||
			raw.sessionIds.some((id) => !times.has(id))
		)
			return invalidDatabase();
		raw.sessions = raw.sessions
			.map((record) => ({
				...record,
				session: {
					...record.session,
					lastWatchedAt: times.get(record.session.id) ?? invalidDatabase(),
				},
			}))
			.sort(
				(a, b) =>
					raw.sessionIds.indexOf(a.session.id) -
					raw.sessionIds.indexOf(b.session.id),
			);
		if (scope === "titles") {
			const history = buildWatchHistoryV3Response({
				userId: params.userId,
				accountGeneration: raw.accountGeneration,
				progressRows: raw.progressRows,
				sessions: raw.sessions,
				limit: query.limit,
				totalTitleCount: raw.totalTitleCount,
				hasMore: raw.hasMore,
				titleSummaries: raw.titleSummaries,
				generatedAt: now,
			});
			history.nextCursor = raw.nextCursor;
			const response = parseDatabase(WatchHistoryBrowseResponseSchema, {
				history,
				matches: raw.matches,
			});
			if (
				response.matches.length !== history.items.length ||
				response.matches.some(
					(m, i) =>
						m.provider !== history.items[i]?.provider ||
						m.titleKey !== history.items[i]?.titleKey,
				)
			)
				return invalidDatabase();
			return response;
		}
		if (scope === "episodes") {
			const detailQuery =
				WatchHistoryBrowseTitleEpisodesQuerySchema.parse(query);
			if (raw.catalog === null) return invalidDatabase();
			const detail = buildWatchHistoryTitleEpisodesV3Response({
				userId: params.userId,
				generatedAt: now,
				page: {
					accountGeneration: raw.accountGeneration,
					provider: detailQuery.provider,
					titleKey: detailQuery.titleKey,
					observedEpisodeCount: raw.observedEpisodeCount,
					completedEpisodeCount: raw.completedEpisodeCount,
					progressRows: raw.progressRows,
					sessions: raw.sessions,
					complete: !raw.hasMore,
					nextCursor: raw.nextCursor,
					catalog: raw.catalog,
				},
			});
			const response = parseDatabase(
				WatchHistoryBrowseTitleEpisodesResponseSchema,
				{ detail, matches: raw.matches, groups: raw.groups },
			);
			if (
				response.matches.length !== detail.episodes.length ||
				response.matches.some(
					(m, i) => m.episodeKey !== detail.episodes[i]?.episodeKey,
				)
			)
				return invalidDatabase();
			return response;
		}
		return parseDatabase(WatchHistoryBrowseSessionsResponseSchema, {
			meta,
			sessions: raw.sessions.map((r) => r.session),
			groups: raw.groups,
			totalSessionCount: raw.totalSessionCount,
			nextCursor: raw.nextCursor,
		});
	} catch (error) {
		if (error instanceof WatchHistoryV3ApiError) throw error;
		const message =
			error && typeof error === "object" && "message" in error
				? String(error.message)
				: "";
		if (message.includes("watch_history_browse_cursor_invalid"))
			throw new WatchHistoryV3ApiError(
				400,
				"INVALID_CURSOR",
				"History cursor is invalid",
			);
		if (message.includes("watch_history_browse_invalid"))
			throw new WatchHistoryV3ApiError(
				400,
				"INVALID_QUERY",
				"History filters are invalid",
			);
		throw new WatchHistoryV3ApiError(
			503,
			"HISTORY_UNAVAILABLE",
			"Watch history is temporarily unavailable",
		);
	}
}
export async function browseWatchHistoryV3(
	params: Params,
): Promise<WatchHistoryBrowseResponse> {
	return (await readWatchHistoryBrowseV3(
		params,
		"titles",
	)) as WatchHistoryBrowseResponse;
}
export async function browseWatchHistoryTitleEpisodesV3(
	params: Params,
): Promise<WatchHistoryBrowseTitleEpisodesResponse> {
	return (await readWatchHistoryBrowseV3(
		params,
		"episodes",
	)) as WatchHistoryBrowseTitleEpisodesResponse;
}
export async function browseWatchHistorySessionsV3(
	params: Params,
): Promise<WatchHistoryBrowseSessionsResponse> {
	return (await readWatchHistoryBrowseV3(
		params,
		"sessions",
	)) as WatchHistoryBrowseSessionsResponse;
}
export async function browseWatchHistoryOptionsV3(
	params: Params,
): Promise<WatchHistoryBrowseOptionsResponse> {
	return (await readWatchHistoryBrowseV3(
		params,
		"options",
	)) as WatchHistoryBrowseOptionsResponse;
}
