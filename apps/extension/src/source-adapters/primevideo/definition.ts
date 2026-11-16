import { runPrimeCommand } from "./bridge-client";
import { canonicalizeRoomSourceUrl, hasPrimeVideoHostname } from "@anidachi/protocol";
import type { SourceAdapterDefinition } from "../core/types";
import { withRoomHash } from "../core/source-navigation";
import { PrimeVideoAdapter } from "./adapter";
import { PRIME_NAVIGATING, primeVideoId, readPrimeBinding } from "./contract";
import { primeHistoryPolicy } from "./progress";
export const primeVideoDefinition: SourceAdapterDefinition = {
  id: "primevideo", provider: "primevideo", priority: 200, historyPolicy: primeHistoryPolicy,
  detect(video) {
    if (!primeVideoId(location.href) || !video.isConnected || !readPrimeBinding(video)) return null;
    const root = video.closest<HTMLElement>("#dv-web-player");
    return root && root.querySelectorAll("video").length === 1 ? new PrimeVideoAdapter(video, root) : null;
  },
  async ensureSource(source, context) {
    if (source.provider !== "primevideo" || context.roomProvider !== "primevideo") return { status: "unsupported", reason: "provider-mismatch" };
    if (context.signal.aborted) return { status: "failed", reason: "navigation-failed" };
    const canonical = canonicalizeRoomSourceUrl(source.sourceUrl, "primevideo");
    if (!canonical.ok || canonical.source.videoFingerprint !== source.videoFingerprint || canonical.source.canonicalUrl !== source.canonicalUrl)
      return { status: "unsupported", reason: "invalid-source" };
    if (!hasPrimeVideoHostname(location.href)) return { status: "unsupported", reason: "unsupported-route" };
    const videos = [...document.querySelectorAll<HTMLVideoElement>("#dv-web-player video")];
    const current = videos.length === 1 ? readPrimeBinding(videos[0]!) : null;
    // Address-bar equality is insufficient: native Next Episode may preserve it.
    if (current?.contentId === primeVideoId(source.sourceUrl)) {
      const verified = await runPrimeCommand({ action: "snapshot", contentId: current.contentId, generation: current.generation }, context.signal);
      if (context.signal.aborted) return { status: "failed", reason: "navigation-failed" };
      if (verified?.ok) return { status: "already-current" };
    }
    const target = new URL(canonical.source.sourceUrl); target.searchParams.set("autoplay", "1");
    const targetUrl = withRoomHash(target, context.roomId);
    if (context.signal.aborted) return { status: "failed", reason: "navigation-failed" };
    try { document.dispatchEvent(new Event(PRIME_NAVIGATING)); location.assign(targetUrl); return { status: "navigation-started", targetUrl }; }
    catch { return { status: "failed", reason: "navigation-failed" }; }
  },
};
