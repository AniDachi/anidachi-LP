import { defineConfig } from "wxt";

type ExtensionChannel = "local" | "staging" | "production";

const LOCAL_HOST_PERMISSIONS = [
  "http://127.0.0.1/*",
  "http://localhost/*",
  "http://*/*",
  "https://*/*",
  "file:///*",
];

const STORE_VIDEO_HOST_PERMISSIONS = [
  "https://youtube.com/*",
  "https://*.youtube.com/*",
  "https://youtu.be/*",
  "https://*.youtu.be/*",
  "https://*.youtube-nocookie.com/*",
  "https://crunchyroll.com/*",
  "https://*.crunchyroll.com/*",
];

function getExtensionChannel(): ExtensionChannel {
  const channel = process.env.WXT_EXTENSION_CHANNEL;
  if (channel === "staging" || channel === "production") return channel;
  return "local";
}

function getHttpHostPermission(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return `${url.origin}/*`;
    }
    if (url.protocol === "ws:" || url.protocol === "wss:") {
      const httpProtocol = url.protocol === "wss:" ? "https:" : "http:";
      return `${httpProtocol}//${url.host}/*`;
    }
  } catch {
    return null;
  }

  return null;
}

function unique(values: Array<string | null>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

const extensionChannel = getExtensionChannel();
const extensionName =
  extensionChannel === "production"
    ? "Anidachi"
    : extensionChannel === "staging"
      ? "Anidachi Staging"
      : "Anidachi Local MVP";
const extensionShortName =
  extensionChannel === "production"
    ? "Anidachi"
    : extensionChannel === "staging"
      ? "AD Staging"
      : "AD Local";
const extensionDescription =
  extensionChannel === "production"
    ? "Ambient watch-party overlay for watching online video together."
    : extensionChannel === "staging"
      ? "Internal Anidachi staging build for testing watch rooms before production."
      : "Ambient watch-party overlay for local Anidachi MVP testing.";
const extensionVersion = process.env.WXT_EXTENSION_VERSION ?? "0.1.0";
const buildId = process.env.WXT_BUILD_ID?.trim();
const chromeProfileDir = process.env.WXT_CHROME_PROFILE_DIR?.trim() ?? "./.wxt/chrome-data";
const disableAutoBrowser = process.env.WXT_DISABLE_WEB_EXT === "true";
const useBroadHostPermissions =
  extensionChannel === "local" ||
  (extensionChannel === "staging" && process.env.WXT_BROAD_HOST_PERMISSIONS === "true");
const webHostPermission = getHttpHostPermission(process.env.WXT_WEB_HTTP_BASE);
const apiHttpHostPermission = getHttpHostPermission(process.env.WXT_API_HTTP_BASE);
const apiWsHostPermission = getHttpHostPermission(process.env.WXT_API_WS_BASE);
const channelWebHostPermissions =
  extensionChannel === "production"
    ? ["https://www.anidachi.app/*", webHostPermission]
    : [webHostPermission];
const hostPermissions =
  useBroadHostPermissions
    ? LOCAL_HOST_PERMISSIONS
    : unique([
        ...STORE_VIDEO_HOST_PERMISSIONS,
        ...channelWebHostPermissions,
        apiHttpHostPermission,
        apiWsHostPermission,
      ]);
const extensionIcons = {
  16: "icons/icon-16.png",
  32: "icons/icon-32.png",
  48: "icons/icon-48.png",
  128: "icons/icon-128.png",
};

export default defineConfig({
  webExt: {
    disabled: disableAutoBrowser,
    chromiumArgs: [
      `--user-data-dir=${chromeProfileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
    ],
  },
  manifest: {
    name: extensionName,
    short_name: extensionShortName,
    description: extensionDescription,
    version: extensionVersion,
    ...(buildId ? { version_name: buildId } : {}),
    permissions: ["storage", "clipboardWrite", "identity"],
    host_permissions: hostPermissions,
    icons: extensionIcons,
    action: {
      default_title: extensionName,
      default_icon: extensionIcons,
    },
  },
});
