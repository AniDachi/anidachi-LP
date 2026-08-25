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
const contentMatches = (manifest.content_scripts ?? []).flatMap(
  (script) => script.matches ?? [],
);
const permissions = manifest.permissions ?? [];
const optionalPermissions = manifest.optional_permissions ?? [];

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

const videoHosts = [
  "https://youtube.com/*",
  "https://*.youtube.com/*",
  "https://youtu.be/*",
  "https://*.youtu.be/*",
  "https://*.youtube-nocookie.com/*",
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

const broadPatterns = new Set(["http://*/*", "https://*/*", "file:///*", "<all_urls>"]);
for (const value of [...hostPermissions, ...contentMatches]) {
  if (broadPatterns.has(value)) {
    throw new Error(
      `${channel} artifact contains broad permission/match pattern: ${value}`,
    );
  }
}

const expectedByChannel = {
  staging: {
    name: "Anidachi Staging",
    web: "https://staging.anidachi.app/*",
    api: "https://anidachi-api-staging.vladislav-gul7.workers.dev/*",
    hostPermissions: [
      ...videoHosts,
      "https://staging.anidachi.app/*",
      "https://anidachi-api-staging.vladislav-gul7.workers.dev/*",
    ],
    contentMatches: videoHosts,
    buildIdPart: "-staging-",
    extensionId: "ndkfphbchhfephdodcpehdcoclojagje",
  },
  production: {
    name: "Anidachi",
    web: "https://www.anidachi.app/*",
    api: "https://anidachi-api-production.vladislav-gul7.workers.dev/*",
    hostPermissions: [
      ...videoHosts,
      "https://www.anidachi.app/*",
      "https://anidachi-api-production.vladislav-gul7.workers.dev/*",
    ],
    contentMatches: videoHosts,
    buildIdPart: "-production-",
    extensionId: null,
  },
};
const expected = expectedByChannel[channel];

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

if (manifest.name !== expected.name) {
  throw new Error(`Expected manifest.name ${expected.name}, got ${manifest.name}`);
}

if (!manifest.version_name?.includes(expected.buildIdPart)) {
  throw new Error(
    `Expected version_name to include ${expected.buildIdPart}, got ${manifest.version_name}`,
  );
}

if (expected.extensionId) {
  if (!manifest.key) {
    throw new Error(`${channel} artifact is missing its stable public manifest key`);
  }
  const actualExtensionId = deriveChromiumExtensionId(manifest.key);
  if (actualExtensionId !== expected.extensionId) {
    throw new Error(
      `Expected ${channel} extension ID ${expected.extensionId}, got ${actualExtensionId}`,
    );
  }
} else if (manifest.key !== undefined) {
  throw new Error("Production must remain fail-closed without an approved manifest key");
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

console.log(`Validated ${channel} extension artifact at ${manifestPath}`);
