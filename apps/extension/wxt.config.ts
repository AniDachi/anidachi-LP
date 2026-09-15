import { defineConfig } from "wxt";
import {
  getExtensionManifestKey,
  resolveExtensionChannel,
} from "./src/extension-channel-identity";
import extensionPackage from "./package.json";

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

const extensionChannel = resolveExtensionChannel(process.env.WXT_EXTENSION_CHANNEL);
const extensionManifestKey = getExtensionManifestKey(extensionChannel);
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
const extensionVersion = process.env.WXT_EXTENSION_VERSION ?? extensionPackage.version;
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

// Production-only packed public key. Keeps the unpacked sideload ID stable.
// Private PEM lives at apps/extension/.keys/production-sideload-private.pem (gitignored).
// Do not rotate without migrating OAuth chromiumapp.org redirect URIs and user installs.
const PRODUCTION_EXTENSION_PUBLIC_KEY =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAln4D/vW2dN/YyBiPuwrPLpEs99SQp50fZzckQSeL9kjh9Sml/XUqEBni+nHIVXZt1kDzgThIq9QWDaGjxUzq6DmGPitiYB//a7tGjROjcRuxE2/ooZekZIVJ5U9u5TFrX09rnTl4P0ADuJDy0gpuNKPQeljIrpVXHiZTAsfi2fBtWARbQofQWTeqhVP/o0SLghI/LSA2v/z2gD22T8l+s5En/8QgVPUk6ZnDMPPWqhHX70GwptSPn0W8/8VH2KMcDKWxUT4sYC+tCWpAbNcI+gyzkxhhCIe3J0evnU8UKymJY2dbyo26zw10piVwgRxRR6gZoWwcaKDOMwpBABZCrQIDAQAB";
const extensionIcons = {
  16: "icons/icon-16.png",
  32: "icons/icon-32.png",
  48: "icons/icon-48.png",
  128: "icons/icon-128.png",
};

export default defineConfig({
  vite: () => ({
    // WXT production artifacts resolve React's production JSX runtime, so the
    // transform must never emit jsxDEV calls that runtime cannot provide.
    esbuild: {
      jsxDev: false,
    },
  }),
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
    ...(extensionManifestKey ? { key: extensionManifestKey } : {}),
    minimum_chrome_version: "121",
    ...(buildId ? { version_name: buildId } : {}),
    ...(extensionChannel === "production"
      ? { key: PRODUCTION_EXTENSION_PUBLIC_KEY }
      : {}),
    permissions: unique([
      "storage",
      "alarms",
      "clipboardWrite",
      "identity",
      "cookies",
      "notifications",
      extensionChannel === "production" ? null : "downloads",
    ]),
    host_permissions: hostPermissions,
    icons: extensionIcons,
    web_accessible_resources: [
      {
        resources: ["Anidachi_logo.png"],
        matches: useBroadHostPermissions ? ["*://*/*"] : STORE_VIDEO_HOST_PERMISSIONS,
      },
    ],
    action: {
      default_title: extensionName,
      default_icon: extensionIcons,
    },
  },
});
