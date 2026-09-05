import { type NextRequest, NextResponse } from "next/server";
import { getApiSession, type ApiSession } from "./api-session";
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
	} = { getSession: getApiSession, browse: readWatchHistoryBrowseV3 },
) {
	return async (request: NextRequest) => {
		const headers = { "Cache-Control": "private, no-store" };
		const session = await dependencies.getSession(request);
		if (!session)
			return NextResponse.json(
				{ error: "Authentication required", code: "UNAUTHORIZED" },
				{ status: 401, headers },
			);
		try {
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
				input[key] = key === "limit" ? Number(value) : value;
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
