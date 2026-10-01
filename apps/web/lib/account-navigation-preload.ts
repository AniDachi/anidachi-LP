import { api } from "./client-api";
import { BILLING_OWNER_HEADER } from "./billing-view";
import { SOCIAL_OWNER_HEADER } from "./social-editor-contracts";

type Pending = { owner: string; started: number; response: Promise<unknown>; controller: AbortController; timer: ReturnType<typeof setTimeout> };
const pending = new Map<string, Pending>();
const MAX_AGE_MS = 15_000;
const SOCIAL_CHANGED = "anidachi:account-social-changed";
function stopListeningWhenEmpty() {
  if (!pending.size && typeof window !== "undefined") window.removeEventListener(SOCIAL_CHANGED, invalidateSocial);
}
function invalidateSocial(event: Event) {
  const owner = (event as CustomEvent<{ ownerUserId?: string }>).detail?.ownerUserId;
  for (const [path, entry] of pending) {
    if (entry.owner === owner && (path === "/api/friends" || path === "/api/groups")) {
      pending.delete(path); clearTimeout(entry.timer); entry.controller.abort();
    }
  }
  stopListeningWhenEmpty();
}

export function clearAccountPreloads() {
  for (const entry of pending.values()) { clearTimeout(entry.timer); entry.controller.abort(); }
  pending.clear(); stopListeningWhenEmpty();
}

/** Only called by an explicit account navigation, never by hover or route prefetch. */
export function preloadAccountNavigation(owner: string, pathname: string) {
  clearAccountPreloads();
  const paths = pathname === "/account/friends" ? ["/api/friends", "/api/groups"]
    : pathname === "/account/billing" ? ["/api/billing/subscription"] : [];
  for (const path of paths) {
    const controller = new AbortController();
    const started = Date.now();
    const response = api<unknown>(path, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(MAX_AGE_MS)]),
      headers: { [path.includes("/billing/") ? BILLING_OWNER_HEADER : SOCIAL_OWNER_HEADER]: owner } });
    // The destination may never mount. Observe rejection now; its consumer still
    // receives the original failure and applies its normal authority/error rules.
    void response.catch(() => {});
    const entry: Pending = { owner, started, response, controller, timer: setTimeout(() => {
      if (pending.get(path) === entry) { pending.delete(path); controller.abort(); stopListeningWhenEmpty(); }
    }, MAX_AGE_MS) };
    pending.set(path, entry);
    if (typeof window !== "undefined") window.addEventListener(SOCIAL_CHANGED, invalidateSocial);
  }
}

export function takeAccountPreload(owner: string, path: string, now = Date.now()) {
  const entry = pending.get(path);
  if (!entry || entry.owner !== owner) return null;
  pending.delete(path); clearTimeout(entry.timer); stopListeningWhenEmpty();
  if (now - entry.started >= MAX_AGE_MS || now < entry.started) { entry.controller.abort(); return null; }
  return { started: entry.started, response: entry.response };
}
