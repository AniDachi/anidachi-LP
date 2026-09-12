import { WATCH_HISTORY_OWNER_HEADER } from "../watch-history-owner";
import {
	getAccountAccessSession,
	HISTORY_PRIVATE_HEADERS,
} from "./watch-history-access";
import { type NextRequest, NextResponse } from "next/server";
import { type ApiSession } from "./api-session";
import {
	parseWatchHistoryBrowseQuery,
	readWatchHistoryBrowseV3,
	type WatchHistoryBrowseScope,
} from "./watch-history-browse";
import { WatchHistoryV3ApiError } from "./watch-history-v3";

export function createWatchHistoryBrowseHandler(
	scope: WatchHistoryBrowseScope,
	dependencies: {
		getSession(request: NextRequest): Promise<ApiSession | null>;
		browse(
			params: { userId: string; input: unknown },
			scope: WatchHistoryBrowseScope,
		): Promise<unknown>;
	} = { getSession: getAccountAccessSession, browse: readWatchHistoryBrowseV3 },
) {
	return async (request: NextRequest) => {
		const headers = HISTORY_PRIVATE_HEADERS;
		const session = await dependencies.getSession(request);
		if (!session)
			return NextResponse.json(
				{ error: "Authentication required", code: "UNAUTHORIZED" },
				{ status: 401, headers },
			);
		try {
			const expectedOwner = request.headers.get(WATCH_HISTORY_OWNER_HEADER);
			if (expectedOwner && expectedOwner !== session.userId)
				throw new WatchHistoryV3ApiError(
					409,
					"OWNER_MISMATCH",
					"Watch history owner changed",
				);
			const input: Record<string, unknown> = {};
			for (const [key, value] of request.nextUrl.searchParams) {
				if (
					Object.hasOwn(input, key) ||
					(key === "limit" && !/^\d{1,2}$/.test(value))
				)
					throw new WatchHistoryV3ApiError(
						400,
						"INVALID_QUERY",
						"History filters are invalid",
					);
				input[key] =
					key === "limit"
						? Number(value)
						: key === "includeEpisodePreviews" && value === "true"
							? true
							: value;
			}
			const query = parseWatchHistoryBrowseQuery(input, scope);
			return NextResponse.json(
				await dependencies.browse(
					{ userId: session.userId, input: query },
					scope,
				),
				{ headers },
			);
		} catch (error) {
			return NextResponse.json(
				{
					error:
						error instanceof WatchHistoryV3ApiError
							? error.message
							: "Watch history is temporarily unavailable",
					code:
						error instanceof WatchHistoryV3ApiError
							? error.code
							: "HISTORY_UNAVAILABLE",
				},
				{
					status: error instanceof WatchHistoryV3ApiError ? error.status : 503,
					headers,
				},
			);
		}
	};
}
