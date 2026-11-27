import { canonicalizeRoomSourceUrl } from "@anidachi/protocol";
import { catalogWatchDestination, renderedHboMaxWatchUrl } from "./catalog-room-routes";
import { returnToPrimePlayer } from "./prime-launch-client";
import type { RoomSessionRecord } from "./room-session-storage";
import { returnToDisneyPlayer } from "./source-adapters/disneyplus/room-return";
import { disneyPlusWatchId } from "./source-adapters/disneyplus/url";

export async function navigateToGuestPlayback(doc: Document, url: string, room: RoomSessionRecord, signal: AbortSignal) {
  const target = canonicalizeRoomSourceUrl(url);
  if (!target.ok || signal.aborted) return false;
  const { provider, sourceUrl } = target.source;
  if (provider === "primevideo") return returnToPrimePlayer(room.roomId, sourceUrl);
  const edition = provider === "hbomax" ? renderedHboMaxWatchUrl(doc, sourceUrl) : undefined;
  const destination = catalogWatchDestination(sourceUrl, doc.location.href, edition);
  const playback = provider === "disneyplus" && disneyPlusWatchId(sourceUrl);
  if (playback) {
    await returnToDisneyPlayer(doc, destination, { roomId: room.roomId, sessionId: room.participantSessionId, playback }, signal);
  } else {
    doc.location.assign(destination);
  }
  return !signal.aborted;
}
