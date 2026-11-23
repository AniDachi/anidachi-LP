#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

function parseArgs(argv) {
  const args = new Map();
  for (let index = 2; index < argv.length; index += 2) {
    args.set(argv[index], argv[index + 1]);
  }
  return args;
}

const args = parseArgs(process.argv);
const channel = args.get("--channel");
const dir = args.get("--dir") ?? "apps/extension/.output/chrome-mv3";

if (!["staging", "production"].includes(channel)) {
  throw new Error(
    "Usage: node scripts/validate-extension-artifact.mjs --channel staging|production --dir <manifest-dir>",
  );
}

const manifestPath = path.join(dir, "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const hostPermissions = manifest.host_permissions ?? [];
const scripts = manifest.content_scripts ?? [];
const portraitScripts = scripts.filter(script => script.js?.includes("content-scripts/disney-portrait.js"));
if (portraitScripts.length > (channel === "staging" ? 1 : 0)) throw new Error("Unexpected Disney portrait bridge");
for (const script of portraitScripts) assertExactAllowlist("Disney portrait bridge", script.matches, ["https://www.disneyplus.com/*"]);
const contentMatches = scripts.filter(script => !portraitScripts.includes(script)).flatMap(
  (script) => script.matches ?? [],
);
const permissions = manifest.permissions ?? [];
const optionalPermissions = manifest.optional_permissions ?? [];

// Chrome WAR matches accept an origin with /* only. Content-script route
// patterns are legal elsewhere but must never enter this manifest field.
for (const resource of manifest.web_accessible_resources ?? [])
  for (const match of resource.matches ?? [])
    if (typeof match !== "string" || !/^(?:https?|\*):\/\/[^/]+\/\*$/.test(match))
      throw new Error(`Invalid web_accessible_resources match pattern (path must be /*): ${match}`);

function assertProductionReactRuntime(rootDir) {
  const pending = [rootDir];
  while (pending.length > 0) {
    const currentDir = pending.pop();
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const entryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        pending.push(entryPath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".js")) continue;

      const source = fs.readFileSync(entryPath, "utf8");
      if (/\.jsxDEV\)\s*\(/.test(source) || /\bjsxDEV\s*\(/.test(source)) {
        throw new Error(
          `Invalid production artifact calls jsxDEV, which is unavailable in the production React runtime: ${entryPath}`,
        );
      }
      if (source.includes("Static children should always be an array")) {
        throw new Error(
          `Invalid production artifact contains the React development runtime: ${entryPath}`,
        );
      }
    }
  }
}

assertProductionReactRuntime(dir);

const amazonVideoMatches = [
  "amazon.com",
  "amazon.co.uk",
  "amazon.de",
  "amazon.co.jp",
  "amazon.ca",
  "amazon.in",
  "amazon.com.mx",
].flatMap((host) => [
  `https://*.${host}/Amazon-Video`,
  `https://*.${host}/Amazon-Video/*`,
  `https://*.${host}/*/Amazon-Video`,
  `https://*.${host}/*/Amazon-Video/*`,
  `https://*.${host}/gp/video`,
  `https://*.${host}/gp/video/*`,
  `https://*.${host}/*/gp/video`,
  `https://*.${host}/*/gp/video/*`,
  `https://*.${host}/dp/*`,
  `https://*.${host}/*/dp/*`,
]);

const hboOrigins = ["www.hbomax.com", "play.hbomax.com", "hbomax.com", "play.max.com", "www.max.com", "max.com"]
  .map(host => `https://${host}/*`);
const stagingVideoOrigins = channel === "staging" ? [
  "https://www.disneyplus.com/*",
  ...hboOrigins,
] : [];
const videoContentMatches = [
  ...stagingVideoOrigins,
  "https://youtube.com/*",
  "https://*.youtube.com/*",
  "https://youtu.be/*",
  "https://*.youtu.be/*",
  "https://*.youtube-nocookie.com/*",
  "https://www.netflix.com/*",
  "https://*.primevideo.com/*",
  ...amazonVideoMatches,
  "https://crunchyroll.com/*",
  "https://*.crunchyroll.com/*",
];

const videoOrigins = [
  ...stagingVideoOrigins,
  "https://youtube.com/*",
  "https://*.youtube.com/*",
  "https://youtu.be/*",
  "https://*.youtu.be/*",
  "https://*.youtube-nocookie.com/*",
  "https://www.netflix.com/*",
  "https://*.primevideo.com/*",
  "https://*.amazon.com/*",
  "https://*.amazon.co.uk/*",
  "https://*.amazon.de/*",
  "https://*.amazon.co.jp/*",
  "https://*.amazon.ca/*",
  "https://*.amazon.in/*",
  "https://*.amazon.com.mx/*",
  "https://crunchyroll.com/*",
  "https://*.crunchyroll.com/*",
];

function deriveChromiumExtensionId(manifestKey) {
  const digest = createHash("sha256")
    .update(Buffer.from(manifestKey, "base64"))
    .digest()
    .subarray(0, 16);
  return Array.from(digest, (byte) =>
    [byte >> 4, byte & 0x0f]
      .map((nibble) => String.fromCharCode("a".charCodeAt(0) + nibble))
      .join(""),
  ).join("");
}

const broadPatterns = new Set(["*://*/*", "http://*/*", "https://*/*", "file:///*", "<all_urls>"]);
for (const value of [...hostPermissions, ...contentMatches]) {
  if (broadPatterns.has(value)) {
    throw new Error(
      `${channel} artifact contains broad permission/match pattern: ${value}`,
    );
  }
}

const expectedByChannel = {
  staging: {
    name: "AniDachi Staging",
    web: "https://staging.anidachi.app/*",
    api: "https://anidachi-api-staging.vladislav-gul7.workers.dev/*",
    hostPermissions: [
      ...videoOrigins,
      "https://staging.anidachi.app/*",
      "https://anidachi-api-staging.vladislav-gul7.workers.dev/*",
    ],
    contentMatches: videoContentMatches,
    buildIdPart: "-staging-",
    extensionId: "ndkfphbchhfephdodcpehdcoclojagje",
  },
  production: {
    name: "AniDachi: Watch Together, Synced Watch Party",
    web: "https://www.anidachi.app/*",
    api: "https://anidachi-api-production.vladislav-gul7.workers.dev/*",
    hostPermissions: [
      ...videoOrigins,
      "https://www.anidachi.app/*",
      "https://anidachi-api-production.vladislav-gul7.workers.dev/*",
    ],
    contentMatches: videoContentMatches,
    buildIdPart: "-production-",
    extensionId: "gpkolofebdhfpapbbgdkdkmlmjfidgmn",
  },
};
const expected = expectedByChannel[channel];
assertExactAllowlist("external website", manifest.externally_connectable?.matches ?? [], [expected.web]);
assertExactAllowlist("external extension", manifest.externally_connectable?.ids ?? [], []);

assertExactAllowlist(
  "host permission",
  hostPermissions,
  expected.hostPermissions,
);
assertExactAllowlist(
  "content-script match",
  contentMatches,
  expected.contentMatches,
);

const expectedPrimeMatches = ["https://*.primevideo.com/*", ...amazonVideoMatches];
const primeMainScripts = (manifest.content_scripts ?? []).filter((script) =>
  script.world === "MAIN" && (script.matches ?? []).includes("https://*.primevideo.com/*"));
if (primeMainScripts.length !== 1 || primeMainScripts[0].all_frames === true ||
    primeMainScripts[0].run_at !== "document_start" || primeMainScripts[0].matches.length !== expectedPrimeMatches.length ||
    !(primeMainScripts[0].js ?? []).length) {
  throw new Error("Prime Video requires exactly one top-frame document_start MAIN bridge on its narrow host");
}

assertExactAllowlist("Prime MAIN matches", primeMainScripts[0].matches, expectedPrimeMatches);
const hboMain = (manifest.content_scripts ?? []).filter(script =>
  script.world === "MAIN" && script.matches?.some(match => hboOrigins.includes(match)));
if (channel === "staging") {
  if (hboMain.length !== 1 || hboMain[0].run_at !== "document_start" || hboMain[0].all_frames === true ||
      !hboMain[0].js?.includes("content-scripts/hbomax.js"))
    throw new Error("Staging HBO Max requires one top-frame catalog bridge at document_start");
  assertExactAllowlist("HBO MAIN matches", hboMain[0].matches, hboOrigins);
}
const overlayScripts = (manifest.content_scripts ?? []).filter((script) =>
  script.world !== "MAIN" && (script.matches ?? []).includes("https://*.primevideo.com/*"));
if (overlayScripts.length !== 1) throw new Error("Expected one Prime overlay content script");
assertExactAllowlist("overlay matches", overlayScripts[0].matches, videoContentMatches);

const publicResources = manifest.web_accessible_resources ?? [];
if (publicResources.length !== 2 || publicResources.some(entry => entry.extension_ids?.length)) {
  throw new Error("Expected exactly the provider logo and Prime call tile resource entries");
}
const logo = publicResources.find(entry => entry.resources?.includes("Anidachi_logo.png"));
const tile = publicResources.find(entry => entry.resources?.includes("prime-media-tile.html"));
assertExactAllowlist("logo resource", logo?.resources ?? [], ["Anidachi_logo.png"]);
assertExactAllowlist("logo match", logo?.matches ?? [], videoOrigins);
assertExactAllowlist("Prime tile resource", tile?.resources ?? [], ["prime-media-tile.html", "prime-media-permission.html"]);
assertExactAllowlist("Prime tile match", tile?.matches ?? [], ["https://www.youtube.com/*", "https://youtube.com/*", "https://m.youtube.com/*", "https://crunchyroll.com/*", "https://www.crunchyroll.com/*", ...stagingVideoOrigins, ...videoOrigins.filter(origin => origin === "https://www.netflix.com/*" || origin.includes(".primevideo.com/") || origin.includes(".amazon."))]);
if (!permissions.includes("offscreen")) throw new Error("Missing offscreen permission for persistent Prime calls");

if (manifest.name !== expected.name) {
  throw new Error(`Expected manifest.name ${expected.name}, got ${manifest.name}`);
}

if (manifest.version_name !== undefined) {
  throw new Error("Omit version_name so Chrome displays the release version instead of the diagnostic build ID");
}

if (!manifest.key) {
  throw new Error(`${channel} artifact is missing its stable public manifest key`);
}
const actualExtensionId = deriveChromiumExtensionId(manifest.key);
if (actualExtensionId !== expected.extensionId) {
  throw new Error(
    `Expected ${channel} extension ID ${expected.extensionId}, got ${actualExtensionId}`,
  );
}

for (const required of [expected.web, expected.api]) {
  if (!hostPermissions.includes(required)) {
    throw new Error(`Missing host permission: ${required}`);
  }
}

function assertExactAllowlist(label, actualValues, expectedValues) {
  const actual = new Set(actualValues);
  const expectedSet = new Set(expectedValues);
  for (const value of actual) {
    if (!expectedSet.has(value)) {
      throw new Error(`Unexpected ${label}: ${value}`);
    }
  }
  for (const value of expectedSet) {
    if (!actual.has(value)) {
      throw new Error(`Missing ${label}: ${value}`);
    }
  }
}

for (const size of ["16", "32", "48", "128"]) {
  if (!manifest.icons?.[size]) {
    throw new Error(`Missing icon size ${size}`);
  }
}

if (!permissions.includes("alarms")) {
  throw new Error("Missing alarms permission required for notification recovery");
}

if (!permissions.includes("notifications")) {
  throw new Error("Missing notifications permission required for default-on invite alerts");
}

if (optionalPermissions.includes("notifications")) {
  throw new Error("Notifications must not be duplicated in optional permissions");
}

if (Number.parseInt(manifest.minimum_chrome_version ?? "0", 10) < 121) {
  throw new Error("minimum_chrome_version must support extension Web Push");
}

const background = fs.readFileSync(path.join(dir, manifest.background.service_worker), "utf8");
if (!background.includes(expected.buildIdPart)) {
  throw new Error(`Expected diagnostic build ID to include ${expected.buildIdPart} in the background bundle`);
}

console.log(`Validated ${channel} extension artifact at ${manifestPath}`);
