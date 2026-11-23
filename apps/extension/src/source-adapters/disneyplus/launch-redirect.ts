import { MAX_ROOM_ID_CHARS, disneyPlusRoutePath, disneyPlusEntityId, disneyPlusFingerprint, disneyPlusPlaybackId, parsePersonalHistoryResumeUrl } from "@anidachi/protocol";

import { ROOMS_PILOT, lobbyRoomFromUrl, isDisneyRoomSurface } from "../../popup-room-launch";

export function disneyRedirectKey(href: string): string | null {
  const playback = disneyPlusPlaybackId(href);
  if (playback) return playback;
  return ROOMS_PILOT && isDisneyRoomSurface(href) && disneyPlusRoutePath(new URL(href).pathname) === "/home" ? "catalog" : null;
}

export function neutralDisneyEntry(path: string): boolean {
  return path.toLowerCase().startsWith("/play/") || /^\/home\/?$/i.test(path);
}

export const DISNEY_REDIRECT_TTL_MS = 60_000;
export const DISNEY_ROOM_INVITE_TTL_MS = 10 * 60_000;

export function disneyLaunchTitle(href: string): string | null {
  return disneyPlusPlaybackId(href) ?? disneyPlusEntityId(href);
}

export function disneyLaunchFragment(href: string): string | null {
  if (disneyRedirectKey(href) === "catalog") {
    const room = lobbyRoomFromUrl(href);
    return room ? new URLSearchParams({anidachiRoom:room,anidachiLobby:"disneyplus"}).toString() : null;
  }
  if (!disneyLaunchTitle(href)) return null;
  const hash = new URLSearchParams(new URL(href).hash.slice(1));
  if (hash.has("anidachiRoom")) {
    const ids = hash.getAll("anidachiRoom");
    const id = ids[0];
    if (ids.length !== 1 || !id || id.length > MAX_ROOM_ID_CHARS || id.trim() !== id || /[\u0000-\u001f\u007f]/u.test(id)) return null;
    return new URLSearchParams({ anidachiRoom: id }).toString();
  }
  const resume = parsePersonalHistoryResumeUrl(href);
  return resume?.provider === "disneyplus" && hash.getAll("anidachiResume").length === 1
    ? new URLSearchParams({ anidachiResume: JSON.stringify(resume) }).toString() : null;
}

function redirectMessage(action: "capture-launch" | "claim-launch", href: string): Promise<string | null> {
  return Promise.resolve(chrome.runtime.sendMessage({
    type: "ANIDACHI_DISNEYPLUS_CATALOG_HANDOFF", action, payload: href,
  })).then((saved: unknown) => typeof saved === "string" ? saved : null).catch(() => null);
}

// Disney may visit the localized player URL and then show the title details first.
// Save the invitation at document start. Only the matching video can consume it.
export function prepareDisneyLaunchRedirect(href: string, referrer: string) {
  const title = disneyLaunchTitle(href);
  if (!title || typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return null;
  const url = new URL(href);
  const fragment = disneyLaunchFragment(href);
  if (!fragment && (url.hash || disneyLaunchTitle(referrer) !== title)) return null;
  const captured = fragment ? redirectMessage("capture-launch", href) : null;
  return {
    title,
    claim(playerHref: string, fingerprint: string): Promise<string | null> | null {
      if (disneyPlusPlaybackId(playerHref) !== title || disneyPlusFingerprint(title) !== fingerprint) return null;
      return Promise.resolve(captured).then(() => redirectMessage("claim-launch", playerHref));
    },
  };
}

export function restoreDisneyLaunchFragment(initialHref: string, fragment: string | null): void {
  const id = disneyLaunchTitle(initialHref);
  if (!id || !fragment || location.hash || disneyPlusPlaybackId(location.href) !== id) return;
  const url = new URL(location.href);
  url.hash = fragment;
  if (disneyLaunchFragment(url.href) === fragment) history.replaceState(history.state, "", url.href);
}

// Disney replaces its neutral /play link with a localized document, dropping the fragment.
// The localized document refers back to that exact play link, even across a full reload.
export function prepareDisneyLobbyRedirect(href: string, referrer: string): Promise<string | null> | null {
  const id = disneyRedirectKey(href);
  if (id !== "catalog" || typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return null;
  const url = new URL(href);
  const initial = neutralDisneyEntry(url.pathname);
  const fragment = disneyLaunchFragment(href);
  const fromNeutral = disneyRedirectKey(referrer) === id && neutralDisneyEntry(new URL(referrer).pathname);
  if (initial ? !fragment : url.hash || !fromNeutral) return null;
  return Promise.resolve(chrome.runtime.sendMessage({
    type: "ANIDACHI_DISNEYPLUS_CATALOG_HANDOFF", action: "redirect", payload: href,
  })).then((saved: unknown) => typeof saved === "string" ? saved : null).catch(() => null);
}

export function restoreDisneyLobbyFragment(initialHref: string, fragment: string | null): void {
  const id = disneyRedirectKey(initialHref);
  if (id !== "catalog" || !fragment || location.hash || disneyRedirectKey(location.href) !== id) return;
  const url = new URL(location.href);
  url.hash = fragment;
  if (disneyLaunchFragment(url.href) === fragment) history.replaceState(history.state, "", url.href);
}
