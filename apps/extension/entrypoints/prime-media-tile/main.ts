import {mediaAccessChannel, type PrimeTileWindow} from "../../src/prime-media-access";

import {hasPrimeBrowserHost} from "@anidachi/protocol";

let mounted = false;
async function mount(event: MessageEvent) {
  if (mounted || event.source !== window.parent || !hasPrimeBrowserHost(event.origin) ||
      event.data?.channel !== mediaAccessChannel || typeof event.data.ticket !== "string") return;
  if (window.parent === window) return;
  const grant = await chrome.runtime.sendMessage({channel: mediaAccessChannel, action: "redeem", ticket: event.data.ticket});
  if (typeof grant !== "string") return;
  const owner = (chrome.extension.getViews() as PrimeTileWindow[]).find(view =>
    view.location.pathname === "/prime-room.html" && typeof view.bindPrimeRoomTile === "function");
  const target = document.querySelector("video")!;
  const release = owner?.bindPrimeRoomTile?.(grant, target);
  if (!release) return;
  mounted = true;
  window.addEventListener("pagehide", release, {once: true});
  void target.play().catch(() => {});
}
window.addEventListener("message", event => { void mount(event).catch(() => {}); });
