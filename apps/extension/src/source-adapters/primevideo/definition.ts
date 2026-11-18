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
function waitForPrimeTarget(targetId: string, signal: AbortSignal, timeoutMs: number, previousGeneration?: string | null) {
	return new Promise<void>(resolve => {
		const finish = () => {
			clearTimeout(timer);
			document.removeEventListener(PRIME_BINDING_CHANGED, check);
			signal.removeEventListener("abort", finish);
			resolve();
		};
		const check = () => {
			const binding = readCurrentPrimePlayerBinding(document);
			if (signal.aborted || binding?.contentId === targetId ||
				(previousGeneration !== undefined && binding && binding.generation !== previousGeneration) ||
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
		let root = document.getElementById("dv-web-player");
		if (root?.getAttribute(PRIME_PLAYER_STATE) === "closed")
			return { status: "failed", reason: "navigation-failed" };
		let initial = await currentPrimeSnapshot(signal);
		// Autoplay can replace the entire player before the room notification arrives.
		if (!initial && root?.getAttribute(PRIME_PLAYER_STATE) !== "open" && context.roomId && !signal.aborted) {
			await waitForPrimeTarget(targetId, signal, EPISODE_LOAD_GRACE_MS, null);
			root = document.getElementById("dv-web-player") ?? root;
			if (signal.aborted || root?.getAttribute(PRIME_PLAYER_STATE) === "closed")
				return { status: "failed", reason: "navigation-failed" };
			initial = await currentPrimeSnapshot(signal);
		}
		if (initial?.contentId === targetId) return { status: "already-current" };
		if (!context.roomId || signal.aborted) return { status: "failed", reason: "navigation-failed" };

		const wasOpen = root?.getAttribute(PRIME_PLAYER_STATE) === "open";
		let current = initial;
		if (wasOpen && (!initial || initial.metadata.episodeNumber !== null)) {
			// Give a simultaneous native autoplay a chance to settle before requesting Next.
			await waitForPrimeTarget(targetId, signal, initial ? AUTOPLAY_GRACE_MS : EPISODE_LOAD_GRACE_MS, initial ? undefined : null);
			current = await currentPrimeSnapshot(signal);
			if (current?.contentId !== targetId && (!current || current.phase !== "content")) {
				await waitForPrimeTarget(targetId, signal, EPISODE_LOAD_GRACE_MS, current?.generation ?? null);
				current = await currentPrimeSnapshot(signal);
			}
			if (current?.contentId === targetId && !signal.aborted)
				return { status: "navigation-started", targetUrl: location.href };
			// Missing identity or an ad is not evidence that the title needs a new page.
			if (!current || current.phase !== "content" || signal.aborted)
				return { status: "failed", reason: "navigation-failed" };
			const next = await runPrimeCommand({
				action: "next-episode",
				contentId: current.contentId,
				generation: current.generation,
				targetContentId: targetId,
			}, signal);
			if (next?.ok || readCurrentPrimePlayerBinding(document)?.generation !== current.generation) {
				// Sync already waits for the exact target adapter and retains the latest
				// host state. A slow accepted transition must never launch a second tab URL.
				return signal.aborted || root?.getAttribute(PRIME_PLAYER_STATE) === "closed"
					? { status: "failed", reason: "navigation-failed" }
					: { status: "navigation-started", targetUrl: location.href };
			}
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
