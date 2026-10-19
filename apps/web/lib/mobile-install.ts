import { INSTALL_HUB_PATH, installHubHref } from "./install-cta";
import { isMobileUserAgent } from "./mobile-user-agent";

/** iPadOS can identify as desktop Safari. Touch-capable laptops remain desktops. */
export function isMobileInstallDevice(device: {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
}): boolean {
  return isMobileUserAgent(device.userAgent) ||
    (device.platform === "MacIntel" && (device.maxTouchPoints ?? 0) > 1);
}

/** Keep install context, never forward account, payment, or arbitrary query data. */
export function desktopInstallUrl(href: string, origin: string): string {
  const fallback = new URL(INSTALL_HUB_PATH, origin);
  try {
    const target = new URL(href, origin);
    if (target.origin !== fallback.origin || target.pathname !== INSTALL_HUB_PATH) {
      return fallback.href;
    }
    const safe = new URL(installHubHref(target.searchParams.get("next")), origin);
    if (target.searchParams.get("welcome") === "1") safe.searchParams.set("welcome", "1");
    if (target.hash === "#using") safe.hash = "using";
    return safe.href;
  } catch {
    return fallback.href;
  }
}
