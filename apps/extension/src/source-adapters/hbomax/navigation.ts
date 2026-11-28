import { HBO_MAX_ORIGIN, hboMaxDetail, hboMaxFingerprint, hboMaxPlaybackId, isHboMaxOrigin, localizeHboMaxUrl, type WatchSourceDescriptor } from "@anidachi/protocol";
import { catalogRoomProvider, catalogWatchDestination, renderedHboMaxWatchUrl } from "../../catalog-room-routes";
import { hasCatalogNavigation } from "../../popup-room-launch";
import { observeHboMaxRoomSource, readHboMaxPlaybackMetadata } from "./metadata";
import { resolveCanonicalSourceNavigation, withRoomHash } from "../core/source-navigation";
import type { EnsureSourceResult, SourceNavigationContext } from "../core/types";

/** HBO inserts the title into history while a directly opened player is loading. */
export function isHboMaxPlayerStarting(doc: Document, fingerprint: string,
  entryUrl = doc.defaultView?.performance.getEntriesByType?.("navigation")[0]?.name) {
  if (!entryUrl || !hboMaxDetail(doc.location.href)) return false;
  const id = hboMaxPlaybackId(entryUrl);
  return !!id && hboMaxFingerprint(id) === fingerprint && !hasCatalogNavigation(doc, "hbomax");
}

export async function ensureHboMaxSource(
  source: WatchSourceDescriptor,
  context: SourceNavigationContext,
): Promise<EnsureSourceResult> {
  if (context.signal.aborted) return { status: "failed", reason: "navigation-failed" };
  if (context.roomProvider !== "hbomax" || !isHboMaxOrigin(location.origin)) {
    return { status: "unsupported", reason: "provider-mismatch" };
  }
  const navigation = resolveCanonicalSourceNavigation(source, location.href, "hbomax");
  if (!navigation.ok) return { status: "unsupported", reason: navigation.reason };
  observeHboMaxRoomSource(document, source);
  if (navigation.alreadyCurrent) return { status: "already-current" };
  const destination = catalogWatchDestination(navigation.target.href, location.href, renderedHboMaxWatchUrl(document, navigation.target.href));
  const targetUrl = withRoomHash(new URL(destination), context.roomId);
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
    navigate(localizeHboMaxUrl(HBO_MAX_ORIGIN + path, doc.location.href));
  }
  doc.addEventListener("click", onClick, true);
  return () => doc.removeEventListener("click", onClick, true);
}
