import { WEB_HTTP_BASE } from "./constants";
import { EXTENSION_UNINSTALL_CAPABILITY_PATH, ExtensionUninstallCapabilitySchema } from "@anidachi/protocol";

export const UNINSTALL_URL_REFRESH_ALARM = "anidachi-uninstall-capability";
const CACHE_KEY = "anidachi-uninstall-capability-v1";
const REFRESH_MS = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5000;
type CapabilityCache = { origin: string; checkedAt: number; available: boolean | null };
type RegistrationRequest = { force: boolean };
let inFlight: { request: RegistrationRequest; promise: Promise<void> } | null = null;

async function readCache(origin: string): Promise<CapabilityCache | null> {
  try {
    const value = (await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY] as Partial<CapabilityCache> | undefined;
    if (
      value?.origin === origin && typeof value.checkedAt === "number" &&
      Number.isFinite(value.checkedAt) && value.checkedAt >= 0 && value.checkedAt <= Date.now() &&
      (value.available === null || typeof value.available === "boolean")
    ) return value as CapabilityCache;
  } catch { /* Cache failure must not prevent a fresh readiness check. */ }
  return null;
}

async function probe(origin: string): Promise<boolean | null> {
  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(new URL(EXTENSION_UNINSTALL_CAPABILITY_PATH, origin).href, {
      credentials: "omit", redirect: "error", cache: "no-store", signal: abort.signal,
    });
    if (response.redirected) return null;
    if (response.status === 404 || response.status === 410) return false;
    if (!response.ok || response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return null;
    const result = ExtensionUninstallCapabilitySchema.safeParse(await response.json());
    return result.success ? result.data.available : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function reconcile(request: RegistrationRequest): Promise<void> {
  try {
    const base = new URL(WEB_HTTP_BASE);
    const channel = import.meta.env.WXT_EXTENSION_CHANNEL ?? "local";
    const expectedOrigin = channel === "staging" ? "https://staging.anidachi.app"
      : channel === "production" ? "https://www.anidachi.app" : null;
    if (
      (base.protocol !== "https:" && base.protocol !== "http:") ||
      base.username || base.password ||
      (expectedOrigin ? base.origin !== expectedOrigin : channel !== "local")
    ) throw new Error("Invalid uninstall website origin");
    // Recreate alarms lost on restart, but never postpone an existing deadline.
    try {
      if (!await chrome.alarms.get(UNINSTALL_URL_REFRESH_ALARM)) {
        await chrome.alarms.create(UNINSTALL_URL_REFRESH_ALARM, { periodInMinutes: REFRESH_MS / 60000 });
      }
    } catch { /* Normal background starts still refresh when alarms are unavailable. */ }

    const cache = await readCache(base.origin);
    const url = new URL("/uninstall", base.origin).href;
    // Clear an unverified URL left by an older version before doing network I/O.
    await chrome.runtime.setUninstallURL(cache?.available === true ? url : "");
    if (!request.force && cache && Date.now() - cache.checkedAt < REFRESH_MS) return;

    const available = await probe(base.origin);
    // A transient failure is not evidence that a previously working page vanished.
    const confirmed = available ?? cache?.available ?? null;
    if (available !== null) await chrome.runtime.setUninstallURL(available ? url : "");
    try {
      await chrome.storage.local.set({ [CACHE_KEY]: { origin: base.origin, checkedAt: Date.now(), available: confirmed } satisfies CapabilityCache });
    } catch { /* A later worker instance can retry without a persistent cache. */ }
  } catch {
    // Keep this optional browser registration independent of auth/background work.
    console.warn("[AniDachi] Failed to register uninstall URL");
  }
}

export function registerUninstallUrl(options: { force?: boolean } = {}): Promise<void> {
  if (inFlight) {
    // Startup/alarm can arrive while a normal wake is still reading its cache.
    // Share that request, but retain the requirement to consult the server.
    inFlight.request.force ||= options.force === true;
    return inFlight.promise;
  }
  const request = { force: options.force === true };
  const promise = reconcile(request).finally(() => { inFlight = null; });
  inFlight = { request, promise };
  return promise;
}
