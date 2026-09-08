import type {
	WatchHistoryAccess,
	WatchHistoryPreferencesResponse,
	WatchHistoryResponse,
} from "@anidachi/protocol";

type Dependencies = {
	access(userId: string): Promise<WatchHistoryAccess>;
	preferences(userId: string): Promise<WatchHistoryPreferencesResponse>;
	history(userId: string): Promise<WatchHistoryResponse>;
};
/** All plans may read saved rows; discard loaded rows if their authority moves. */
export async function loadWatchLibraryData(userId: string, deps: Dependencies) {
	const before = await deps.access(userId);
	if (before.ownerUserId !== userId) throw new Error("HISTORY_ACCESS_CHANGED");
	const preferences = await deps.preferences(userId);
	if (
		preferences.meta.ownerUserId !== userId ||
		preferences.meta.accountGeneration !== before.accountGeneration
	)
		throw new Error("HISTORY_ACCESS_CHANGED");
	const history = await deps.history(userId);
	const after = await deps.access(userId);
	if (
		after.ownerUserId !== userId ||
		before.state !== after.state ||
		before.accountGeneration !== after.accountGeneration ||
		before.accessEpoch !== after.accessEpoch ||
		history.meta.ownerUserId !== userId ||
		history.meta.accountGeneration !== after.accountGeneration
	)
		throw new Error("HISTORY_ACCESS_CHANGED");
	return { history, preferences, access: after };
}
