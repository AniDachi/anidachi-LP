import { WEB_HTTP_BASE } from "./constants";

export async function registerUninstallUrl(): Promise<void> {
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
    await chrome.runtime.setUninstallURL(new URL("/uninstall", base.origin).href);
  } catch {
    // Keep this optional browser registration independent of auth/background work.
    console.warn("[AniDachi] Failed to register uninstall URL");
  }
}
