import { YOUTUBE_CATALOG_ORIGINS } from "../../src/source-adapters/youtube/url";
import { isCrunchyrollCatalogOrigin } from "../../src/source-adapters/crunchyroll/url";
import { DISNEY_PLUS_ORIGIN } from "../../src/source-adapters/disneyplus/url";
import {hasPrimeBrowserHost} from "@anidachi/protocol";
import {mediaAccessChannel, type PrimeTileWindow} from "../../src/prime-media-access";
import {PRIME_ROOM_DOCUMENT_HANDOFF_MS} from "../../src/prime-room-contract";

const parentOrigin = location.ancestorOrigins[0];
if (parentOrigin && window.parent !== window && (parentOrigin === "https://www.netflix.com" || parentOrigin === DISNEY_PLUS_ORIGIN || YOUTUBE_CATALOG_ORIGINS.includes(parentOrigin) || isCrunchyrollCatalogOrigin(parentOrigin) || hasPrimeBrowserHost(parentOrigin))) {
  const video = document.querySelector("video")!;
  let release: (() => void) | undefined;
  let redeeming = false;
  let timer: number | undefined;
  let generation = 0;

  const notify = (action: "request" | "playing") =>
    window.parent.postMessage({channel: mediaAccessChannel, action}, parentOrigin);

  function requestBinding() {
    if (release) return;
    window.clearTimeout(timer);
    const deadline = performance.now() + PRIME_ROOM_DOCUMENT_HANDOFF_MS;
    let delay = 200;
    const request = () => {
      if (release || performance.now() >= deadline) return;
      if (!redeeming) notify("request");
      timer = window.setTimeout(request, delay);
      delay = Math.min(delay * 2, 3000);
    };
    request();
  }
  window.addEventListener("pageshow", requestBinding);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) requestBinding();
  });
  video.addEventListener("emptied", () => {
    if (release && !video.srcObject) {
      release();
      release = undefined;
      requestBinding();
    }
  });

  window.addEventListener("message", async event => {
    if (!event.isTrusted || event.source !== window.parent || event.origin !== parentOrigin ||
        event.data?.channel !== mediaAccessChannel || typeof event.data.ticket !== "string" || redeeming || release) return;
    const current = generation;
    redeeming = true;
    try {
      const grant = await chrome.runtime.sendMessage({channel: mediaAccessChannel, action: "redeem", ticket: event.data.ticket});
      if (typeof grant !== "string" || generation !== current) return;
      const owner = (chrome.extension.getViews() as PrimeTileWindow[]).find(view => view.location.pathname === "/prime-room.html");
      release = owner?.bindPrimeRoomTile?.(grant, video);
      if (!release) return;
      window.clearTimeout(timer);
      video.requestVideoFrameCallback(() => {
        if (generation === current && video.srcObject) notify("playing");
      });
      void video.play().catch(() => {});
    } catch {
      // A document handoff can invalidate a grant while redemption is in flight.
    } finally {
      if (generation === current) redeeming = false;
    }
  });

  window.addEventListener("pagehide", () => {
    generation++;
    window.clearTimeout(timer);
    release?.();
    release = undefined;
    redeeming = false;
  });
}
