import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, mock, test } from "node:test";
import { NextRequest } from "next/server";
import { GET as download } from "../app/api/extension/download/route";
import { GET as latest } from "../app/api/extension/latest/route";
import { getExtensionArtifact, toPublicExtensionArtifact } from "./extension-artifact";

const nextServer = createRequire(import.meta.url)("next/server") as typeof import("next/server");
const keys = ["EXTENSION_ZIP_URL", "EXTENSION_ZIP_PATH", "EXTENSION_ZIP_VERSION", "EXTENSION_ZIP_SHA256", "EXTENSION_ZIP_BYTES"] as const;
const original = new Map(keys.map((key) => [key, process.env[key]]));
const originalCwd = process.cwd();
const source = "https://downloads.example/anidachi-0.1.0-abcd1234.zip?download=1";
let temporaryDirectory: string | null;
let scheduled: unknown[];

beforeEach(() => {
  temporaryDirectory = null;
  scheduled = [];
  for (const key of keys) delete process.env[key];
  process.env.EXTENSION_ZIP_URL = source;
  process.env.EXTENSION_ZIP_VERSION = "0.1.0";
  process.env.EXTENSION_ZIP_SHA256 = "ab".repeat(32);
  process.env.EXTENSION_ZIP_BYTES = "2048";
  mock.method(nextServer, "after", (callback: unknown) => scheduled.push(callback));
  mock.method(globalThis, "fetch", async () => { throw new Error("No external requests in ZIP route tests"); });
  mock.method(console, "info", () => undefined);
  mock.method(console, "warn", () => undefined);
});
afterEach(() => {
  process.chdir(originalCwd);
  if (temporaryDirectory) rmSync(temporaryDirectory, { recursive: true, force: true });
  mock.restoreAll();
  for (const key of keys) {
    const value = original.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function placeLegacyFiles() {
  temporaryDirectory = mkdtempSync(join(tmpdir(), "anidachi-zip-route-"));
  process.chdir(temporaryDirectory);
  for (const directory of ["artifacts", "private/extension"]) {
    mkdirSync(join(temporaryDirectory, directory), { recursive: true });
    writeFileSync(join(temporaryDirectory, directory, "anidachi-chrome-extension-0.1.0.zip"), "old local artifact");
  }
  process.env.EXTENSION_ZIP_PATH = join(temporaryDirectory, "artifacts/anidachi-chrome-extension-0.1.0.zip");
}

test("GET redirects to exactly the configured URL despite legacy files or request parameters", async () => {
  placeLegacyFiles();
  const response = await download(new NextRequest("https://www.anidachi.app/api/extension/download?url=https://other.example/wrong.zip"));
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), source);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(scheduled.length, 1);
});

test("without a URL even an existing explicit local file leaves both endpoints unavailable", async () => {
  placeLegacyFiles();
  delete process.env.EXTENSION_ZIP_URL;
  const metadata = await latest();
  assert.equal((await metadata.json()).available, false);
  const response = await download(new NextRequest("https://www.anidachi.app/api/extension/download"));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("location"), null);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { error: "The extension zip is not published yet." });
  assert.equal(scheduled.length, 0);
});

test("invalid URL or incomplete metadata fails before redirecting or tracking a download", async () => {
  for (const [key, value] of [
    ["EXTENSION_ZIP_URL", "https://user:password@downloads.example/file.zip"],
    ["EXTENSION_ZIP_SHA256", "invalid"],
    ["EXTENSION_ZIP_VERSION", "../old"],
    ["EXTENSION_ZIP_BYTES", "10MB"],
  ] as const) {
    const previous = process.env[key];
    process.env[key] = value;
    const response = await download(new NextRequest("https://www.anidachi.app/api/extension/download"));
    assert.equal(response.status, 503, key);
    assert.equal(response.headers.get("location"), null);
    assert.equal((await (await latest()).json()).available, false);
    process.env[key] = previous;
  }
  assert.equal(scheduled.length, 0);
});

test("HEAD follows the same release selection without recording a download", async () => {
  const response = await download(new NextRequest("https://www.anidachi.app/api/extension/download", { method: "HEAD" }));
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), source);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(scheduled.length, 0);
});

test("latest is not cached and shares the page resolver without exposing server-only fields", async () => {
  const response = await latest();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const data = await response.json();
  assert.deepEqual(data, toPublicExtensionArtifact(getExtensionArtifact()));
  assert.equal("sourceUrl" in data, false);
  assert.equal("zipPath" in data, false);
});
