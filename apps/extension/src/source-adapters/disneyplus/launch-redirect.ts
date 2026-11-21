import { MAX_ROOM_ID_CHARS, disneyPlusPlaybackId, parsePersonalHistoryResumeUrl } from "@anidachi/protocol";

export const DISNEY_REDIRECT_TTL_MS = 60_000;

export function disneyLaunchFragment(href: string): string | null {
  if (!disneyPlusPlaybackId(href)) return null;
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

// Disney replaces its neutral /play link with a localized document, dropping the fragment.
// The localized document refers back to that exact play link, even across a full reload.
export function prepareDisneyLaunchRedirect(href: string, referrer: string): Promise<string | null> | null {
  const id = disneyPlusPlaybackId(href);
  if (!id || typeof chrome === "undefined" || !chrome.runtime?.sendMessage) return null;
  const url = new URL(href);
  const initial = url.pathname.toLowerCase().startsWith("/play/");
  const fragment = disneyLaunchFragment(href);
  const fromNeutral = disneyPlusPlaybackId(referrer) === id && new URL(referrer).pathname.toLowerCase().startsWith("/play/");
  if (initial ? !fragment : url.hash || !fromNeutral) return null;
  return Promise.resolve(chrome.runtime.sendMessage({
    type: "ANIDACHI_DISNEYPLUS_CATALOG_HANDOFF", action: "redirect", payload: href,
  })).then((saved: unknown) => typeof saved === "string" ? saved : null).catch(() => null);
}

export function restoreDisneyLaunchFragment(initialHref: string, fragment: string | null): void {
  const id = disneyPlusPlaybackId(initialHref);
  if (!id || !fragment || location.hash || disneyPlusPlaybackId(location.href) !== id) return;
  const url = new URL(location.href);
  url.hash = fragment;
  if (disneyLaunchFragment(url.href) === fragment) history.replaceState(history.state, "", url.href);
}
