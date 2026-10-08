import { useEffect, useRef } from "react";
import {
	WatchHistoryBrowseResponseSchema,
	type WatchHistoryBrowseQuery,
	type WatchHistoryBrowseResponse,
} from "@anidachi/protocol";
import { usePopupWatchBrowse } from "./popup-watch-browse";
import { readPopupHistoryView, writePopupTitlePages } from "./popup-view-state";
import type { PopupWatchHistoryClient } from "./popup-watch-history";

const meta = (page: WatchHistoryBrowseResponse) => page.history.meta;
const cursor = (page: WatchHistoryBrowseResponse) => page.history.nextCursor;
type Options = {
	client: PopupWatchHistoryClient;
	ownerUserId: string;
	input: WatchHistoryBrowseQuery;
	generation?: number;
	refresh: number;
	forceRefresh: number;
	enabled: boolean;
	discard: boolean;
};
function useProviderBrowse(
	provider: "youtube" | "crunchyroll" | "netflix",
	options: Options,
) {
	const {
		client,
		ownerUserId,
		generation,
		refresh,
		forceRefresh,
		enabled,
		discard,
	} = options;
	const input = { ...options.input, providerVersion: 2 as const, provider, limit: 20 };
	const query = JSON.stringify(input);
	const saved = readPopupHistoryView(ownerUserId, generation);
	const result = usePopupWatchBrowse({
		client,
		message: {
			type: "ANIDACHI_WATCH_HISTORY_V3",
			command: "browse",
			expectedOwnerUserId: ownerUserId,
			input,
		},
		parser: WatchHistoryBrowseResponseSchema,
		meta,
		cursor,
		generation,
		refresh,
		forceRefresh,
		enabled,
		discard,
		initialPageCount: saved.titleStreams?.[query] ?? 1,
	});
	useEffect(() => {
		if (!discard && !result.loading && !result.error && result.pages.length)
			writePopupTitlePages(ownerUserId, generation, query, result.pages.length);
	}, [
		discard,
		result.loading,
		result.error,
		result.pages.length,
		ownerUserId,
		generation,
		query,
	]);
	return result;
}

/** Each provider has its own server query, cursor, cache and user-loaded depth.
 * Search/date conditions are sent to all streams before server pagination. */
export function usePopupProviderBrowse(options: Options) {
	const crunchyroll = useProviderBrowse("crunchyroll", options);
	const youtube = useProviderBrowse("youtube", options);
	const netflix = useProviderBrowse("netflix", options);
	const streams = [crunchyroll, youtube, netflix];
	const failures = streams.filter((stream) => stream.errorStatus);
	// One stale authority must not be hidden behind the other stream's network error.
	const failure =
		failures.find((stream) => stream.errorStatus === "generation-mismatch") ??
		failures.find((stream) =>
			[
				"unauthenticated",
				"rejected",
				"deleted-history",
				"plan-required",
				"access-changed",
				"upgrade-required",
				"access-unavailable",
			].includes(stream.errorStatus!),
		) ??
		failures[0];
	const authorityFailure = failures.some((stream) =>
		[
			"generation-mismatch",
			"unauthenticated",
			"rejected",
			"deleted-history",
			"plan-required",
			"access-changed",
			"upgrade-required",
			"access-unavailable",
		].includes(stream.errorStatus!),
	);
	const authorityKey = JSON.stringify([
		options.ownerUserId,
		options.generation,
		options.discard,
	]);
	const invalidated = useRef<{
		key: string;
		client: PopupWatchHistoryClient;
		revisions: number[];
		error: string | null;
		errorStatus: string | null;
	} | null>(null);
	if (
		invalidated.current?.key !== authorityKey ||
		invalidated.current.client !== options.client
	)
		invalidated.current = null;
	if (authorityFailure && !invalidated.current)
		invalidated.current = {
			key: authorityKey,
			client: options.client,
			revisions: streams.map((stream) => stream.successRevision),
			error: failure!.error,
			errorStatus: failure!.errorStatus,
		};
	if (invalidated.current && failure?.errorStatus === "generation-mismatch") {
		invalidated.current.errorStatus = failure.errorStatus;
		invalidated.current.error = failure.error;
	}
	// Clearing a request error is not proof that shared account authority recovered.
	// Keep all lists hidden until all streams complete newer validated network reads (cache is not proof).
	if (
		invalidated.current &&
		!failures.length &&
		streams.every(
			(stream, index) =>
				!stream.loading &&
				stream.pages.length > 0 &&
				stream.successRevision > invalidated.current!.revisions[index]!,
		)
	)
		invalidated.current = null;
	const authorityInvalid = invalidated.current !== null;
	const visible = (stream: typeof youtube) =>
		authorityInvalid ? { ...stream, pages: [], nextCursor: null } : stream;
	return {
		authorityInvalid,
		providers: { crunchyroll: visible(crunchyroll), youtube: visible(youtube), netflix: visible(netflix) },
		pages: authorityInvalid ? [] : streams.flatMap((stream) => stream.pages),
		loading: streams.some((stream) => stream.loading),
		error: failure?.error ?? invalidated.current?.error ?? null,
		errorStatus:
			invalidated.current?.errorStatus ?? failure?.errorStatus ?? null,
		total: authorityInvalid
			? 0
			: streams.reduce(
					(sum, stream) =>
						sum + (stream.pages[0]?.history.totalTitleCount ?? 0),
					0,
				),
		reload: () => {
			for (const stream of authorityInvalid || !failures.length
				? streams
				: failures)
				stream.reload();
		},
	};
}
