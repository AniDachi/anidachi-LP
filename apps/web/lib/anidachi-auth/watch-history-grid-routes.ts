import { WATCH_HISTORY_OWNER_HEADER } from "../watch-history-owner";
import {
	getAccountAccessSession,
	HISTORY_PRIVATE_HEADERS,
} from "./watch-history-access";
import { type NextRequest, NextResponse } from "next/server";
import { WatchHistoryGridQuerySchema } from "@anidachi/protocol";
import { readWatchHistoryGrid } from "./watch-history-grid";
import { WatchHistoryV3ApiError } from "./watch-history-v3";

export function createWatchHistoryGridGet(
	dependencies = {
		getSession: getAccountAccessSession,
		read: readWatchHistoryGrid,
	},
) {
	return async (request: NextRequest) => {
		const headers = HISTORY_PRIVATE_HEADERS;
		const session = await dependencies.getSession(request);
		if (!session)
			return NextResponse.json(
				{ error: "Unauthorized" },
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
				if (key in input)
					throw new WatchHistoryV3ApiError(
						400,
						"INVALID_REQUEST",
						"Duplicate query parameter",
					);
				input[key] = key === "limit" ? Number(value) : value;
			}
			const parsed = WatchHistoryGridQuerySchema.safeParse(input);
			if (!parsed.success)
				throw new WatchHistoryV3ApiError(
					400,
					"INVALID_REQUEST",
					"Invalid catalog query",
				);
			return NextResponse.json(
				await dependencies.read({ userId: session.userId, input: parsed.data }),
				{ headers },
			);
		} catch (error) {
			const known = error instanceof WatchHistoryV3ApiError;
			return NextResponse.json(
				{
					error: "Could not load episode catalog",
					code: known ? error.code : "INVALID_RESPONSE",
				},
				{ status: known ? error.status : 502, headers },
			);
		}
	};
}
export const handleWatchHistoryGridGet = createWatchHistoryGridGet();
