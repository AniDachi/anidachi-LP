import { startPrimeRoom } from "../../prime-launch-client";
import { hasPrimeBrowserHost, parsePrimePageUrl } from "./url";
import { runPrimeCommand } from "./bridge-client";
import { canonicalizeRoomSourceUrl } from "@anidachi/protocol";
import type { SourceAdapterDefinition } from "../core/types";
import { PrimeVideoAdapter } from "./adapter";
import { PRIME_BINDING_CHANGED, PRIME_PLAYER, PRIME_PLAYER_STATE, primeVideoId, readCurrentPrimePlayerBinding } from "./contract";
import { primeHistoryPolicy } from "./progress";

const AUTOPLAY_GRACE_MS = 500;
const EPISODE_LOAD_GRACE_MS = 3500;

async function currentPrimeSnapshot(signal: AbortSignal) {
	const binding = readCurrentPrimePlayerBinding(document);
	if (!binding) return null;
	const result = await runPrimeCommand({ action: "snapshot", ...binding }, signal);
	return result?.ok ? result.snapshot ?? null : null;
}

// The MAIN bridge already observes SDK title changes, including on the same video and URL.
function waitForPrimeTarget(targetId: string, signal: AbortSignal, timeoutMs: number) {
	return new Promise<void>(resolve => {
		const finish = () => {
			clearTimeout(timer);
			document.removeEventListener(PRIME_BINDING_CHANGED, check);
			signal.removeEventListener("abort", finish);
			resolve();
		};
		const check = () => {
			if (signal.aborted || readCurrentPrimePlayerBinding(document)?.contentId === targetId ||
				document.getElementById("dv-web-player")?.getAttribute(PRIME_PLAYER_STATE) === "closed")
				finish();
		};
		const timer = setTimeout(finish, timeoutMs);
		document.addEventListener(PRIME_BINDING_CHANGED, check);
		signal.addEventListener("abort", finish, { once: true });
		check();
	});
}

export const primeVideoDefinition: SourceAdapterDefinition = {
	id: "primevideo",
	provider: "primevideo",
	priority: 200,
	historyPolicy: primeHistoryPolicy,
	detect(video) {
		if (
			!parsePrimePageUrl(location.href) ||
			!video.isConnected ||
			video.getAttribute(PRIME_PLAYER) !== "true"
		)
			return null;
		const root = video.closest<HTMLElement>("#dv-web-player");
		return root && root.querySelectorAll("video").length === 1
			? new PrimeVideoAdapter(video, root)
			: null;
	},
	async ensureSource(source, context) {
		if (
			source.provider !== "primevideo" ||
			context.roomProvider !== "primevideo"
		)
			return { status: "unsupported", reason: "provider-mismatch" };
		if (context.signal.aborted)
			return { status: "failed", reason: "navigation-failed" };
		const canonical = canonicalizeRoomSourceUrl(source.sourceUrl, "primevideo");
		if (
			!canonical.ok ||
			canonical.source.videoFingerprint !== source.videoFingerprint ||
			canonical.source.canonicalUrl !== source.canonicalUrl
		)
			return { status: "unsupported", reason: "invalid-source" };
		if (!hasPrimeBrowserHost(location.href))
			return { status: "unsupported", reason: "unsupported-route" };
		const targetId = primeVideoId(source.sourceUrl);
		if (!targetId) return { status: "unsupported", reason: "invalid-source" };
		const { signal } = context;
		const initial = await currentPrimeSnapshot(signal);
		if (initial?.contentId === targetId) return { status: "already-current" };
		if (!context.roomId || signal.aborted) return { status: "failed", reason: "navigation-failed" };

		const root = document.getElementById("dv-web-player");
		const wasOpen = root?.getAttribute(PRIME_PLAYER_STATE) === "open";
		let current = initial;
		if (wasOpen && (!initial || initial.metadata.episodeNumber !== null)) {
			// Give a simultaneous native autoplay a chance to settle before requesting Next.
			await waitForPrimeTarget(targetId, signal, initial ? AUTOPLAY_GRACE_MS : EPISODE_LOAD_GRACE_MS);
			current = await currentPrimeSnapshot(signal);
			if (current?.contentId !== targetId) {
				let settling = !!initial;
				if (current?.phase === "content") {
					const next = await runPrimeCommand({
						action: "next-episode",
						contentId: current.contentId,
						generation: current.generation,
						targetContentId: targetId,
					}, signal);
					settling = next?.ok === true || readCurrentPrimePlayerBinding(document)?.generation !== current.generation;
				}
				if (settling) {
					await waitForPrimeTarget(targetId, signal, EPISODE_LOAD_GRACE_MS);
					current = await currentPrimeSnapshot(signal);
				}
			}
			if (current?.contentId === targetId && !signal.aborted)
				return { status: "navigation-started", targetUrl: location.href };
		}
		if (signal.aborted || (wasOpen && root?.getAttribute(PRIME_PLAYER_STATE) === "closed"))
			return { status: "failed", reason: "navigation-failed" };
		try {
			const result = await startPrimeRoom(
				source,
				context.roomId,
				current || initial ? location.origin : undefined,
				context.signal,
			);
			return result && ["ready", "choice-required"].includes(result.status)
				? {
						status: "navigation-started",
						targetUrl: result.url ?? location.href,
					}
				: { status: "failed", reason: "navigation-failed" };
		} catch {
			return { status: "failed", reason: "navigation-failed" };
		}
	},
};
