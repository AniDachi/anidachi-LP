import { HBO_MAX_ORIGIN, hboMaxPlaybackId, type WatchSourceDescriptor } from "@anidachi/protocol";
import { catalogRoomProvider } from "../../catalog-room-routes";
import { observeHboMaxRoomSource, readHboMaxPlaybackMetadata } from "./metadata";
import { resolveCanonicalSourceNavigation, withRoomHash } from "../core/source-navigation";
import type { EnsureSourceResult, SourceNavigationContext } from "../core/types";

export async function ensureHboMaxSource(
  source: WatchSourceDescriptor,
  context: SourceNavigationContext,
): Promise<EnsureSourceResult> {
  if (context.signal.aborted) return { status: "failed", reason: "navigation-failed" };
  if (context.roomProvider !== "hbomax" || location.origin !== "https://www.hbomax.com") {
    return { status: "unsupported", reason: "provider-mismatch" };
  }
  const navigation = resolveCanonicalSourceNavigation(source, location.href, "hbomax");
  if (!navigation.ok) return { status: "unsupported", reason: navigation.reason };
  observeHboMaxRoomSource(document, source);
  if (navigation.alreadyCurrent) return { status: "already-current" };
  const targetUrl = withRoomHash(navigation.target, context.roomId);
  try {
    location.assign(targetUrl);
    return { status: "navigation-started", targetUrl };
  } catch {
    return { status: "failed", reason: "navigation-failed" };
  }
}

/** HBO's Back control follows browser history. A guest arriving from an invite
 * or another playback URL needs a catalog destination within the same room. */
export function bindHboMaxGuestExit(doc: Document, navigate = (url: string) => doc.location.replace(url)) {
  function onClick(event: MouseEvent) {
    if (event.defaultPrevented || event.button !== 0 || !(event.target instanceof Element) ||
        !event.target.closest('[data-testid="playerContainer"] button[data-testid="player-ux-back-button"]')) return;
    const id = hboMaxPlaybackId(doc.location.href);
    if (!id) return;
    const navigation = doc.defaultView?.navigation;
    const entry = navigation?.currentEntry;
    const previous = entry ? navigation.entries()[entry.index - 1]?.url : doc.referrer;
    if (previous && catalogRoomProvider(previous) === "hbomax" && !hboMaxPlaybackId(previous)) return;
    const identity = readHboMaxPlaybackMetadata(doc, id)?.identity;
    const path = identity?.kind === "episode" ? "/show/" + identity.providerSeriesId :
      identity?.kind === "movie" ? "/movie/" + identity.providerMovieId : "/home";
    event.preventDefault();
    event.stopImmediatePropagation();
    navigate(HBO_MAX_ORIGIN + path);
  }
  doc.addEventListener("click", onClick, true);
  return () => doc.removeEventListener("click", onClick, true);
}
