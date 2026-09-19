import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { getExtensionArtifact, toPublicExtensionArtifact } from "./extension-artifact";

const keys = ["EXTENSION_ZIP_URL", "EXTENSION_ZIP_PATH", "EXTENSION_ZIP_VERSION", "EXTENSION_ZIP_SHA256", "EXTENSION_ZIP_BYTES"] as const;
const original = new Map(keys.map((key) => [key, process.env[key]]));
const source = "https://downloads.example/anidachi-0.1.0-abcd1234.zip?download=1";

beforeEach(() => {
  for (const key of keys) delete process.env[key];
  process.env.EXTENSION_ZIP_URL = source;
  process.env.EXTENSION_ZIP_VERSION = "0.1.0";
  process.env.EXTENSION_ZIP_SHA256 = "ab".repeat(32);
  process.env.EXTENSION_ZIP_BYTES = "2048";
});
afterEach(() => {
  for (const key of keys) {
    const value = original.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("a complete release configuration exposes matching public metadata", () => {
  const artifact = getExtensionArtifact();
  assert.equal(artifact.sourceUrl, source);
  assert.deepEqual(toPublicExtensionArtifact(artifact), {
    available: true,
    version: "0.1.0",
    sha256: "ab".repeat(32),
    bytes: 2048,
    filename: "anidachi-chrome-extension-0.1.0.zip",
  });
});

test("a legacy local path cannot enable or change a URL-only release", () => {
  process.env.EXTENSION_ZIP_PATH = "/private/old-release.zip";
  assert.equal(getExtensionArtifact().sourceUrl, source);
  assert.equal("zipPath" in getExtensionArtifact(), false);
  delete process.env.EXTENSION_ZIP_URL;
  assert.equal(getExtensionArtifact().available, false);
});

test("only an absolute HTTPS URL without credentials, fragments or control characters is accepted", () => {
  for (const value of [
    "", "not a URL", "/local/file.zip", "//downloads.example/file.zip",
    "http://downloads.example/file.zip", "file:///tmp/release.zip",
    "javascript:alert(1)", "https:downloads.example/file.zip",
    "https://user:password@downloads.example/file.zip",
    "https://user@downloads.example/file.zip",
    "https://downloads.example/file.zip#fragment",
    "https://downloads.example/file.zip#",
    "https://downloads.example/fi\nle.zip", "https://downloads.example/fi\tle.zip",
    "https://downloads.example/some file.zip", "https://downloads.example\\file.zip",
  ]) {
    process.env.EXTENSION_ZIP_URL = value;
    assert.equal(getExtensionArtifact().available, false, value);
    assert.equal(getExtensionArtifact().sourceUrl, null, value);
  }
});

test("missing or invalid release metadata cannot enable the download", () => {
  for (const key of ["EXTENSION_ZIP_VERSION", "EXTENSION_ZIP_SHA256", "EXTENSION_ZIP_BYTES"] as const) {
    const valid = process.env[key];
    delete process.env[key];
    assert.equal(getExtensionArtifact().available, false, `missing ${key}`);
    process.env[key] = "invalid";
    assert.equal(getExtensionArtifact().available, false, `invalid ${key}`);
    process.env[key] = valid;
  }
});

test("size must be an exact positive safe integer, not a partially parsed value", () => {
  for (const value of ["0", "-1", "1.5", "2048bytes", "1e3", "Infinity", "9007199254740992"]) {
    process.env.EXTENSION_ZIP_BYTES = value;
    const artifact = getExtensionArtifact();
    assert.equal(artifact.available, false, value);
    assert.equal(artifact.bytes, null, value);
  }
});

test("release version cannot inject a path or header into the filename", () => {
  for (const value of ["../old", "latest", "0.1", "0.1.0-01", "0.1.0/../../file", "0.1.0\r\nX-Test: yes", "a".repeat(100)]) {
    process.env.EXTENSION_ZIP_VERSION = value;
    const artifact = getExtensionArtifact();
    assert.equal(artifact.available, false, value);
    assert.equal(artifact.filename, "anidachi-chrome-extension-0.1.0.zip");
  }
});

test("valid SemVer identifiers and an encoded URL hash remain supported", () => {
  process.env.EXTENSION_ZIP_URL = "https://downloads.example/release%23archive.zip";
  for (const version of ["1.2.3-beta-feature", "1.2.3+build-prod", "1.2.3-alpha.0", "1.2.3-0", "1.2.3+01"]) {
    process.env.EXTENSION_ZIP_VERSION = version;
    const artifact = getExtensionArtifact();
    assert.equal(artifact.available, true, version);
    assert.equal(artifact.version, version);
    assert.equal(artifact.sourceUrl, process.env.EXTENSION_ZIP_URL);
  }
});

test("harmless surrounding whitespace and uppercase checksum are normalized", () => {
  process.env.EXTENSION_ZIP_URL = ` ${source} `;
  process.env.EXTENSION_ZIP_VERSION = " 0.1.0 ";
  process.env.EXTENSION_ZIP_SHA256 = ` ${"AB".repeat(32)} `;
  process.env.EXTENSION_ZIP_BYTES = " 2048 ";
  const artifact = getExtensionArtifact();
  assert.equal(artifact.available, true);
  assert.equal(artifact.sourceUrl, source);
  assert.equal(artifact.sha256, "ab".repeat(32));
});
