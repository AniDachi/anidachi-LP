#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

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
    buildIdPart: "-staging-",
  },
  production: {
    name: "Anidachi",
    web: "https://www.anidachi.app/*",
    api: "https://anidachi-api-production.vladislav-gul7.workers.dev/*",
    buildIdPart: "-production-",
  },
};
const expected = expectedByChannel[channel];

if (manifest.name !== expected.name) {
  throw new Error(`Expected manifest.name ${expected.name}, got ${manifest.name}`);
}

if (!manifest.version_name?.includes(expected.buildIdPart)) {
  throw new Error(
    `Expected version_name to include ${expected.buildIdPart}, got ${manifest.version_name}`,
  );
}

for (const required of [expected.web, expected.api]) {
  if (!hostPermissions.includes(required)) {
    throw new Error(`Missing host permission: ${required}`);
  }
}

for (const size of ["16", "32", "48", "128"]) {
  if (!manifest.icons?.[size]) {
    throw new Error(`Missing icon size ${size}`);
  }
}

console.log(`Validated ${channel} extension artifact at ${manifestPath}`);
