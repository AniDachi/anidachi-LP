import {
	PERSONAL_HISTORY_RESUME_HASH,
	canonicalizeRoomSourceUrl,
	parsePersonalHistoryResumeUrl,
	personalHistoryResumeOwnerBinding,
	type PersonalHistoryResume,
} from "@anidachi/protocol";
import type { VideoAdapter } from "./source-adapters/core/types";
import {
	canReadWatchHistory,
	type WatchHistoryLease,
} from "./watch-history-access";

export function takePersonalHistoryResume(
	location: Pick<Location, "href">,
	replace: (url: string) => void,
	now = Date.now(),
): PersonalHistoryResume | null {
	const url = new URL(location.href);
	const params = new URLSearchParams(url.hash.slice(1));
	if (!params.has(PERSONAL_HISTORY_RESUME_HASH)) return null;
	const intent = parsePersonalHistoryResumeUrl(url.toString(), now);
	params.delete(PERSONAL_HISTORY_RESUME_HASH);
	url.hash = params.toString();
	replace(url.toString());
	return intent;
}

export async function applyPersonalHistoryResume(
	intent: PersonalHistoryResume,
	input: {
		adapter: VideoAdapter;
		getOwner(): string | null;
		roomActive(): boolean;
		getLease(): Promise<WatchHistoryLease | null>;
		claim(): Promise<boolean>;
		isCurrent(): boolean;
		beforeSeek?(): void;
		now?: () => number;
	},
): Promise<"waiting" | "consumed" | "cancelled"> {
	const now = input.now ?? Date.now;
	const owner = input.getOwner();
	if (
		!owner ||
		input.roomActive() ||
		!input.isCurrent() ||
		now() >= intent.expiresAt ||
		now() < intent.issuedAt
	)
		return "cancelled";
	const binding = await personalHistoryResumeOwnerBinding(
		owner,
		intent.intentId,
	);
	if (binding !== intent.ownerBinding) return "cancelled";
	const matches = () =>
		input.isCurrent() &&
		input.getOwner() === owner &&
		!input.roomActive() &&
		now() < intent.expiresAt &&
		(() => {
			const source = canonicalizeRoomSourceUrl(
				input.adapter.getSourceDescriptor()?.sourceUrl ?? "",
				intent.provider,
			);
			return source.ok && source.source.sourceUrl === intent.sourceUrl;
		})() &&
		input.adapter.provider === intent.provider;
	const ready = () =>
		input.adapter.getPlaybackSnapshot().phase === "content" &&
		input.adapter.video.readyState >= 1 &&
		Number.isFinite(input.adapter.video.duration) &&
		input.adapter.video.duration > 0 &&
		intent.currentTime <= input.adapter.video.duration;
	if (!matches()) return "cancelled";
	if (!ready()) return "waiting";
	if (intent.provider === "crunchyroll") {
		if (
			!input.adapter.getPersonalResumeReadiness ||
			!input.adapter.seekPersonalResume
		)
			return "waiting";
		const providerReady =
			await input.adapter.getPersonalResumeReadiness(intent);
		if (!matches()) return "cancelled";
		if (providerReady !== "ready") return providerReady;
	}
	const lease = await input.getLease();
	if (
		!matches() ||
		!canReadWatchHistory(lease, owner, now()) ||
		lease?.access.accountGeneration !== intent.accountGeneration
	)
		return "cancelled";
	if (
		!(await input.claim()) ||
		!matches() ||
		!ready() ||
		!canReadWatchHistory(lease, owner, now())
	)
		return "cancelled";
	const currentLease = await input.getLease();
	if (
		!matches() ||
		!ready() ||
		!canReadWatchHistory(currentLease, owner, now()) ||
		currentLease?.access.accountGeneration !== intent.accountGeneration ||
		currentLease.access.accessEpoch !== lease.access.accessEpoch
	)
		return "cancelled";
	const guard = () => {
		if (
			!matches() ||
			!ready() ||
			!canReadWatchHistory(currentLease, owner, now())
		)
			return false;
		input.beforeSeek?.();
		return true;
	};
	if (input.adapter.seekPersonalResume)
		return input.adapter.seekPersonalResume(intent, guard);
	if (!guard()) return "cancelled";
	input.adapter.seek(intent.currentTime, { resumeIfPlaying: false });
	return "consumed";
}
