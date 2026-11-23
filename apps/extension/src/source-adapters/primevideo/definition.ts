import { startPrimeRoom } from "../../prime-launch-client";
import { hasPrimeBrowserHost, parsePrimePageUrl } from "./url";
import { runPrimeCommand } from "./bridge-client";
import { canonicalizeRoomSourceUrl } from "@anidachi/protocol";
import type { SourceAdapterDefinition } from "../core/types";
import { PrimeVideoAdapter } from "./adapter";
import { PRIME_NAVIGATING, PRIME_PLAYER, primeVideoId, readCurrentPrimePlayerBinding } from "./contract";
import { primeHistoryPolicy } from "./progress";
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
		const current = readCurrentPrimePlayerBinding(document);
		// Address-bar equality is insufficient: native Next Episode may preserve it.
		let verifiedCurrent = false;
		if (current) {
			const verified = await runPrimeCommand(
				{
					action: "snapshot",
					contentId: current.contentId,
					generation: current.generation,
				},
				context.signal,
			);
			if (context.signal.aborted)
				return { status: "failed", reason: "navigation-failed" };
			verifiedCurrent =
				!!verified?.ok &&
				verified.snapshot?.contentId === current.contentId &&
				verified.snapshot?.generation === current.generation;
			if (
				verifiedCurrent &&
				current.contentId === primeVideoId(source.sourceUrl)
			)
				return { status: "already-current" };
		}
		if (context.signal.aborted)
			return { status: "failed", reason: "navigation-failed" };
		try {
			document.dispatchEvent(new Event(PRIME_NAVIGATING));
			const result = await startPrimeRoom(
				source,
				context.roomId,
				verifiedCurrent ? location.origin : undefined,
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
