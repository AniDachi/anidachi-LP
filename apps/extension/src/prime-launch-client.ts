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
import { readPrimeBinding } from "./source-adapters/primevideo/contract";
import { runPrimeCommand } from "./source-adapters/primevideo/bridge-client";
import type { VideoAdapter } from "./source-adapters/core/types";
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
	const reply = await chrome.runtime.sendMessage({
		type: "ANIDACHI_PRIME_LAUNCH",
		action: "recover",
		contentId: binding.contentId,
	});
	if (!current()) return undefined;
	if (reply?.status === "blocked")
		return suppressedPrimeLaunch(location.href, reply.rejection);
	const parsed = PrimePendingSchema.safeParse(reply?.pending);
	if (!parsed.success) return null;
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
	const valid = (fingerprint: string, now: number) =>
		!consumed &&
		now < pending.expiresAt &&
		fingerprint === `primevideo|detail/${pending.contentId}`;
	return {
		intentId: pending.intentId,
		commit,
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
