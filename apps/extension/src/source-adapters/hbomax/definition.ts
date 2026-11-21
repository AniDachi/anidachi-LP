import { hboMaxPlaybackId } from "@anidachi/protocol";
import type { SourceAdapterDefinition } from "../core/types";
import { HboMaxVideoAdapter } from "./adapter";
import { hboMaxHistoryPolicy } from "./history";
import { ensureHboMaxSource } from "./navigation";
import { hboMaxMediaSource, hboMaxVideo } from "./player";

const bindings = new WeakMap<HTMLVideoElement, { id: string; src: string; adapter: HboMaxVideoAdapter }>();

export function detectHboMaxAdapter(doc: Document): HboMaxVideoAdapter | null {
  const id = hboMaxPlaybackId(location.href);
  if (!id) return null;
  const video = hboMaxVideo(doc);
  if (!video?.parentElement) return null;
  const src = hboMaxMediaSource(video);
  const previous = bindings.get(video);
  // During SPA navigation the old media can outlive the URL.
  if (!src || (previous && previous.id !== id && previous.src === src)) return null;
  if (previous?.id === id && previous.adapter.container === video.parentElement) {
    previous.src = src;
    return previous.adapter;
  }
  const adapter = new HboMaxVideoAdapter(video, video.parentElement);
  bindings.set(video, { id, src, adapter });
  return adapter;
}

export const hbomaxDefinition: SourceAdapterDefinition = {
  id: "hbomax", provider: "hbomax", priority: 300, historyPolicy: hboMaxHistoryPolicy,
  ensureSource: ensureHboMaxSource,
  detect(video) {
    const adapter = detectHboMaxAdapter(video.ownerDocument);
    return adapter?.video === video ? adapter : null;
  },
};
