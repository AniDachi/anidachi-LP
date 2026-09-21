/** Public install hub and the canonical Chrome Web Store destination. */
export const INSTALL_HUB_PATH = "/extension";

export const INSTALL_CTA_LABEL = "Download for Chrome";

export const INSTALL_ZIP_CTA_LABEL = "Download AniDachi (.zip)";

export const EXTENSION_DOWNLOAD_PATH = "/api/extension/download";

export const CHROME_WEB_STORE_URL =
  "https://chromewebstore.google.com/detail/gpkolofebdhfpapbbgdkdkmlmjfidgmn?utm_source=item-share-cb";

export const CHROME_EXTENSIONS_PAGE = "chrome://extensions";

export type ExtensionInstallMode = "sideload" | "cws";

export const EXTENSION_INSTALL_MODE: ExtensionInstallMode = "cws";

export const INSTALL_HOWTO_STEP_TEXT =
  "Open the official AniDachi Chrome Web Store listing and choose Add to Chrome.";

/** Store-status copy shared by the install hub and its metadata. */
export const CWS_STATUS_LINE =
  "Available now in the Chrome Web Store.";

export const CWS_STATUS_DISCLAIMER =
  "Install AniDachi from the official Chrome Web Store listing.";

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
