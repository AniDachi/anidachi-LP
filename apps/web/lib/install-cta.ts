/** Public install hub until a Chrome Web Store listing exists. */
export const INSTALL_HUB_PATH = "/extension";

export const INSTALL_CTA_LABEL = "Download for Chrome";

export const INSTALL_ZIP_CTA_LABEL = "Download AniDachi (.zip)";

export const EXTENSION_DOWNLOAD_PATH = "/api/extension/download";

export const CHROME_EXTENSIONS_PAGE = "chrome://extensions";

export type ExtensionInstallMode = "sideload" | "cws";

/** Flip to `cws` when a real Chrome Web Store item URL exists. */
export const EXTENSION_INSTALL_MODE: ExtensionInstallMode = "sideload";

export const INSTALL_HOWTO_STEP_TEXT =
  "Open /extension, download the official AniDachi zip from this site, unzip it, then choose Load unpacked in Chrome Developer mode. The Chrome Web Store listing is in the standard review queue, including publisher verification.";

/** Calm Store-status copy. Do not imply rejection, risk, or a workaround. */
export const CWS_PENDING_LINE =
  "Not on the Chrome Web Store yet — listing review and publisher verification are in progress.";

export const CWS_PENDING_DISCLAIMER =
  "Chrome reviews every new listing before it goes live, including a publisher verification step. AniDachi is in that queue. Until Chrome publishes the Store page, this is the official download.";

export const INSTALL_HOWTO_STEP_NAME = "Install the AniDachi Chrome extension";

export function installHubHref(nextPath?: string | null): string {
  const safe = isSafeInstallNextPath(nextPath);
  if (!safe) return INSTALL_HUB_PATH;
  return `${INSTALL_HUB_PATH}?next=${encodeURIComponent(safe)}`;
}

/** Only in-app relative paths (watchroom return). Reject protocol-relative and external URLs. */
export function isSafeInstallNextPath(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) return null;
  if (trimmed.startsWith("//")) return null;
  if (trimmed.includes("://")) return null;
  if (trimmed.includes("\\")) return null;
  if (trimmed.length > 200) return null;
  if (!trimmed.startsWith("/room/")) return null;
  return trimmed;
}
