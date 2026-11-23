import { disneyPlusEntityId, disneyPlusPlaybackId } from "@anidachi/protocol";

export function disneyRoomPlayLink(doc: Document, playback: string): HTMLAnchorElement | null {
  const available = (selector: string) => Array.from(doc.querySelectorAll<HTMLAnchorElement>(selector))
    .filter(link => disneyPlusPlaybackId(link.href) === playback &&
      !link.closest('[hidden], [inert], [aria-hidden="true"], [disabled], [aria-disabled="true"]'));
  const episode = available('a[data-testid="set-item"][href]')[0];
  // Disney also renders an icon-only Restart action with the same href.
  return episode ?? available('a[data-testid="playback-action-button"][href]').find(link => link.textContent?.trim()) ?? null;
}

export type DisneyRoomReturn = { roomId: string; sessionId: string; playback: string };

async function returnIntent(action: "prepare-return" | "take-return", payload: DisneyRoomReturn): Promise<number> {
  try {
    const expires = await chrome.runtime.sendMessage({ type: "ANIDACHI_DISNEYPLUS_CATALOG_HANDOFF", action, payload });
    return typeof expires === "number" ? expires : 0;
  } catch { return 0; }
}

export async function returnToDisneyPlayer(doc: Document, destination: string, intent: DisneyRoomReturn, signal: AbortSignal) {
  const link = disneyRoomPlayLink(doc, intent.playback);
  if (link) { link.click(); return; }
  const href = doc.location.href;
  await returnIntent("prepare-return", intent);
  if (!signal.aborted && doc.location.href === href) doc.location.assign(destination);
}

/** A bare player link may redirect to details. Complete only an explicit return
 * by the same guest to the host's still-current episode. */
export async function finishDisneyRoomReturn(doc: Document, intent: DisneyRoomReturn, signal: AbortSignal, inPlayer: boolean) {
  const entity = disneyPlusEntityId(doc.location.href);
  const playingTarget = inPlayer && disneyPlusPlaybackId(doc.location.href) === intent.playback;
  if (!playingTarget && !entity) return;
  const expires = await returnIntent("take-return", intent);
  if (playingTarget || signal.aborted || expires <= Date.now()) return;
  const observer = new MutationObserver(tryLink);
  const timer = setTimeout(stop, expires - Date.now());
  function stop() {
    clearTimeout(timer);
    observer.disconnect();
    signal.removeEventListener("abort", stop);
  }
  function tryLink() {
    if (signal.aborted || Date.now() >= expires || disneyPlusEntityId(doc.location.href) !== entity) { stop(); return; }
    const link = disneyRoomPlayLink(doc, intent.playback);
    if (link) { stop(); link.click(); }
  }
  signal.addEventListener("abort", stop, { once: true });
  observer.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["href", "aria-disabled", "hidden"] });
  tryLink();
}
