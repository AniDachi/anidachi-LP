import { disneyPlusWatchId } from "./url";
import type { SourceAdapterDefinition } from "../core/types";
import { DisneyPlusVideoAdapter } from "./adapter";
import { composedClosest, findDisneyPlusVideo } from "./dom";
import { disneyPlusHistoryPolicy } from "./history";
import { ensureDisneyPlusSource } from "./navigation";

const bindings = new WeakMap<HTMLVideoElement, { id: string; src: string }>();
const activePlayer = new WeakMap<Document, WeakRef<DisneyPlusVideoAdapter>>();

function bind(video: HTMLVideoElement, player: HTMLElement, id: string): DisneyPlusVideoAdapter | null {
  // A route can change before Disney replaces the video or its MediaSource.
  const src = video.currentSrc || video.src;
  const previous = bindings.get(video);
  if (!src || (previous && previous.id !== id && previous.src === src)) return null;
  const active = activePlayer.get(video.ownerDocument)?.deref();
  bindings.set(video, { id, src });
  if (previous?.id === id && active?.video === video && active.container === player) {
    return active;
  }
  const adapter = new DisneyPlusVideoAdapter(video, player);
  // The body-level UI portal may survive replacement of the entire video surface.
  if (active) adapter.invalidatePreviousClock(active);
  activePlayer.set(video.ownerDocument, new WeakRef(adapter));
  return adapter;
}

export function detectDisneyPlusAdapter(doc: Document): DisneyPlusVideoAdapter | null {
  const id = disneyPlusWatchId(location.href);
  if (!id) return null;
  let candidate: { video: HTMLVideoElement; player: HTMLElement } | null = null;
  for (const player of doc.querySelectorAll<HTMLElement>("disney-web-player")) {
    const video = findDisneyPlusVideo(player);
    if (!video) continue;
    if (candidate) return null;
    candidate = { video, player };
  }
  return candidate ? bind(candidate.video, candidate.player, id) : null;
}

export const disneyPlusDefinition: SourceAdapterDefinition = {
  id: "disneyplus",
  provider: "disneyplus",
  priority: 300,
  historyPolicy: disneyPlusHistoryPolicy,
  ensureSource: ensureDisneyPlusSource,
  detect(video) {
    const id = disneyPlusWatchId(location.href);
    const player = composedClosest<HTMLElement>(video, "disney-web-player");
    return id && player && findDisneyPlusVideo(player) === video ? bind(video, player, id) : null;
  },
};
