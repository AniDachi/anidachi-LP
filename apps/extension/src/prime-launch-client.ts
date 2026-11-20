import { catalogPlayerProvider, catalogRoomProvider, supportsCatalogRoom } from "./catalog-room-routes";
import {
	parsePersonalHistoryResumeUrl,
	primeVideoSourceUrl,
	type PrimeNavigation,
	type WatchSourceDescriptor,
} from "@anidachi/protocol";
import { PrimePendingSchema } from "./prime-launch-session";
import {
	suppressedPrimeLaunch,
	type PrimeLaunchHandoff,
} from "./prime-launch-capture";
import { PRIME_NAVIGATING, readCurrentPrimePlayerBinding, readPrimeBinding } from "./source-adapters/primevideo/contract";
import { runPrimeCommand } from "./source-adapters/primevideo/bridge-client";
import type { VideoAdapter } from "./source-adapters/core/types";

// Both commands are safe to repeat if Chrome restarts the worker mid-message.
async function sendRoomIntentCommand(command: { action: "pending-room" } | { action: "take"; contentId: string; intentId: string }) {
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const reply = await chrome.runtime.sendMessage({ type: "ANIDACHI_PRIME_LAUNCH", ...command });
			if (reply?.status === "ready" || reply?.status === "blocked" || reply?.status === "empty") return reply;
		} catch { /* The service worker may restart between the write and its reply. */ }
	}
	return null;
}

/** Record only which pending room a native close could cancel before the SDK is ready. */
export function preparePrimeRoomDismissal() {
	const receipt = typeof chrome !== "undefined" && typeof chrome.runtime?.sendMessage === "function"
		? sendRoomIntentCommand({ action: "pending-room" })
		: Promise.resolve(null);
	return async () => {
		const target = await receipt;
		if (target?.status === "ready") await sendRoomIntentCommand({ action: "take", contentId: target.contentId, intentId: target.intentId });
	};
}

export async function startPrimeResume(
	canonicalLaunch: string,
	navigation: PrimeNavigation | undefined,
	owner: string,
) {
	const resume = parsePersonalHistoryResumeUrl(canonicalLaunch);
	if (!resume || resume.provider !== "primevideo")
		throw new Error("Invalid launch");
	const result = await chrome.runtime.sendMessage({
		type: "ANIDACHI_PRIME_LAUNCH",
		action: "start",
		contentId: resume.sourceUrl.split("/").at(-1),
		resume,
		navigation,
		expectedOwnerUserId: owner,
		newTab: true,
	});
	if (!["ready", "choice-required"].includes(result?.status))
		throw new Error("Launch expired");
}
export async function followPrimeRoom(source: WatchSourceDescriptor, roomId: string, visit: string | undefined,
	signal: AbortSignal): Promise<boolean> {
	if (signal.aborted || !supportsCatalogRoom(source.provider)) return false;
	const reply = await chrome.runtime.sendMessage({
		type: "ANIDACHI_PRIME_LAUNCH", action: "follow", roomId, visit,
		contentId: source.sourceUrl.split("/").at(-1),
	});
	return reply?.status === "ready";
}

/** Keep an occupied tab in its live room. An older launch must not replay after Leave. */
export function discardConflictingRoomLaunch(activeRoomId: string, href: string) {
	const url = new URL(href);
	const params = new URLSearchParams(url.hash.slice(1));
	const invited = params.get("anidachiRoom");
	const resume = params.get("anidachiResume");
	if (!resume && (!params.has("anidachiRoom") ||
		(invited === activeRoomId && params.getAll("anidachiRoom").length === 1))) return;
	let resumeIntentId: string | undefined;
	try { if (resume) resumeIntentId = JSON.parse(resume)?.intentId; } catch { /* discard malformed fragment */ }
	params.delete("anidachiRoom");
	params.delete("anidachiResume");
	url.hash = params.toString();
	history.replaceState(history.state, "", url.pathname + url.search + url.hash);
	if ((catalogRoomProvider(href) === "primevideo" || catalogPlayerProvider(href) === "primevideo") && (invited || resumeIntentId) && typeof chrome !== "undefined" && chrome.runtime?.sendMessage)
		void chrome.runtime.sendMessage({ type: "ANIDACHI_PRIME_LAUNCH", action: "discard-conflict",
			activeRoomId, invited: invited ?? undefined, resumeIntentId }).catch(() => undefined);
}

export async function startPrimeRoom(
	source: WatchSourceDescriptor,
	roomId: string | null,
	currentVerifiedOrigin?: string,
	signal?: AbortSignal,
) {
	if (!roomId || signal?.aborted) return null;
	const prepared = await chrome.runtime.sendMessage({
		type: "ANIDACHI_PRIME_LAUNCH",
		action: "start",
		contentId: source.sourceUrl.split("/").at(-1),
		navigation: source.primeNavigation,
		roomId,
		currentVerifiedOrigin,
		prepareOnly: true,
	});
	if (signal?.aborted || prepared?.status !== "prepared") return null;
	document.dispatchEvent(new Event(PRIME_NAVIGATING));
	return chrome.runtime.sendMessage({
		type: "ANIDACHI_PRIME_LAUNCH",
		action: "commit",
		intentId: prepared.intentId,
		expectedOwnerUserId: prepared.ownerUserId,
		currentVerifiedOrigin,
	});
}
export async function recoverPrimeLaunch(
	adapter: VideoAdapter,
	isCurrent: () => boolean = () => true,
): Promise<PrimeLaunchHandoff | null | false | undefined> {
	if (
		window.top !== window ||
		adapter.provider !== "primevideo" ||
		!chrome?.runtime?.sendMessage
	)
		return null;
	const binding = readPrimeBinding(adapter.video);
	if (!binding) return undefined;
	const result = await runPrimeCommand({
		action: "snapshot",
		contentId: binding.contentId,
		generation: binding.generation,
	});
	if (
		!result?.ok ||
		!result.snapshot ||
		result.snapshot.contentId !== binding.contentId ||
		result.snapshot.generation !== binding.generation
	)
		return undefined;
	const current = () =>
		isCurrent() &&
		JSON.stringify(readPrimeBinding(adapter.video)) === JSON.stringify(binding);
	if (!current()) return undefined;
	const recover = () => chrome.runtime.sendMessage({
		type: "ANIDACHI_PRIME_LAUNCH",
		action: "recover",
		contentId: binding.contentId,
	});
	const reply = await recover();
	if (!current()) return undefined;
	if (reply?.status === "cancelled") {
		// A definitive refusal ends preflight without restoring a room or replaying a launch.
		return { ...suppressedPrimeLaunch(location.href), blocksFragment: () => true };
	}
	if (reply?.status === "blocked")
		return suppressedPrimeLaunch(location.href, reply.rejection);
	if (reply?.status === "empty") return null;
	if (reply?.status !== "ready") return undefined;
	const parsed = PrimePendingSchema.safeParse(reply?.pending);
	if (!parsed.success) return false;
	const pending = parsed.data;
	if (pending.contentId !== binding.contentId) return false;
	let commitment: Promise<boolean> | undefined;
	const commit = () =>
		(commitment ??= chrome.runtime
			.sendMessage({
				type: "ANIDACHI_PRIME_LAUNCH",
				action: "take",
				contentId: binding.contentId,
				intentId: pending.intentId,
			})
			.then(
				(reply) =>
					reply?.status === "ready" &&
					reply.pending?.intentId === pending.intentId,
			));
	const sameExplicit = (href: string) => {
		const url = new URL(href),
			params = new URLSearchParams(url.hash.slice(1));
		if (params.has("anidachiRoom"))
			return (
				pending.roomId !== undefined &&
				params.getAll("anidachiRoom").length === 1 &&
				params.get("anidachiRoom") === pending.roomId
			);
		if (params.has("anidachiResume")) {
			const explicit = parsePersonalHistoryResumeUrl(
				`${primeVideoSourceUrl(pending.contentId)}${url.hash}`,
			);
			return (
				!!pending.resume &&
				JSON.stringify(explicit) === JSON.stringify(pending.resume)
			);
		}
		return true;
	};
	let consumed = false;
	let retirement: Promise<unknown> | undefined;
	const valid = (fingerprint: string, now: number) =>
		!consumed &&
		now < pending.expiresAt &&
		fingerprint === `primevideo|detail/${pending.contentId}`;
	return {
		intentId: pending.intentId,
		...(pending.roomId ? {
			hasDifferentRoomSource(player: VideoAdapter) {
				if (player.provider !== "primevideo") return true;
				// The SDK updates the video before React sees a replacement. Losing
				// metadata briefly does not invalidate the already verified episode.
				const live = readCurrentPrimePlayerBinding(player.video.ownerDocument) ??
					(player.video.isConnected ? readPrimeBinding(player.video) : null);
				if (live) return live.contentId !== pending.contentId;
				const fingerprint = player.getFingerprint();
				return fingerprint !== "primevideo|unknown" && fingerprint !== `primevideo|detail/${pending.contentId}`;
			},
			async verifyRoom() {
				const next = await recover();
				if (next?.status === "blocked" || next?.status === "empty") return false;
				if (next?.status !== "ready") throw new Error("Could not verify the invitation. Try again.");
				return next.pending?.intentId === pending.intentId;
			},
			blocksFragment(href: string) {
				return new URLSearchParams(new URL(href).hash.slice(1)).get("anidachiRoom") === pending.roomId;
			},
		} : { commit }),
		readRoom(_href, fingerprint, owner, now = Date.now()) {
			return sameExplicit(_href) &&
				valid(fingerprint, now) &&
				pending.roomId &&
				(owner === undefined || owner === pending.owner.userId)
				? pending.roomId
				: null;
		},
		consumeRoom() {
			consumed = true;
			if (pending.roomId) retirement ??= sendRoomIntentCommand({ action: "take", contentId: binding.contentId, intentId: pending.intentId })
				.then(reply => { if (!reply) retirement = undefined; });
		},
		takeResume(_href, fingerprint, now = Date.now()) {
			if (!pending.resume || !sameExplicit(_href) || !valid(fingerprint, now)) return null;
			consumed = true;
			return pending.resume ?? null;
		},
	};
}
/** Find an exact-source hint in a bounded already-parsed history tree. */
export function findPrimeNavigation(
	value: unknown,
	sourceUrl: string,
): PrimeNavigation | undefined {
	const queue: unknown[] = [value];
	let nodes = 0;
	while (queue.length && nodes++ < 60000) {
		const entry = queue.pop();
		if (!entry || typeof entry !== "object") continue;
		if (Array.isArray(entry)) {
			queue.push(...entry);
			continue;
		}
		const row = entry as Record<string, unknown>;
		if (row.sourceUrl === sourceUrl && row.primeNavigation) {
			const nav = row.primeNavigation as PrimeNavigation;
			if (primeVideoSourceUrl(nav.contentId) === sourceUrl) return nav;
		}
		queue.push(...Object.values(row));
	}
}
