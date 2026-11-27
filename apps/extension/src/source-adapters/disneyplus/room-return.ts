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

async function returnIntent(action: "prepare-return" | "read-return" | "take-return", payload: DisneyRoomReturn): Promise<number> {
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
  if (signal.aborted || (!playingTarget && !entity)) return;
  const expires = await returnIntent(playingTarget ? "take-return" : "read-return", intent);
  if (playingTarget || signal.aborted || expires <= Date.now()) return;
  const observer = new MutationObserver(() => void tryLink());
  const timer = setTimeout(stop, expires - Date.now());
  let checking = false;
  const stillHere = () => !signal.aborted && Date.now() < expires && disneyPlusEntityId(doc.location.href) === entity;
  function stop() {
    clearTimeout(timer);
    observer.disconnect();
    signal.removeEventListener("abort", stop);
  }
  async function tryLink() {
    if (!stillHere()) { stop(); return; }
    if (checking || !disneyRoomPlayLink(doc, intent.playback)) return;
    checking = true;
    // The room or account may have changed while Disney was rendering its links.
    const pending = await returnIntent("read-return", intent);
    checking = false;
    if (pending !== expires || !stillHere()) { stop(); return; }
    const link = disneyRoomPlayLink(doc, intent.playback);
    if (!link) return;
    stop();
    // Issue both actions in this turn so cleanup cannot consume a return without launching it.
    void returnIntent("take-return", intent);
    link.click();
  }
  signal.addEventListener("abort", stop, { once: true });
  observer.observe(doc.body, { subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ["href", "data-testid", "aria-disabled", "disabled", "aria-hidden", "hidden", "inert"] });
  await tryLink();
}
