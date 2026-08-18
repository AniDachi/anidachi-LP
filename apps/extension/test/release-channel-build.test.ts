import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(process.cwd(), "../..");
const stagingId = "ndkfphbchhfephdodcpehdcoclojagje";
const broadPatterns = ["http://*/*", "https://*/*", "file:///*", "<all_urls>"];
const testVapidPublicKey =
  "BMmz4hkjcP6LhcnVsnYhWVsod_g59o0qr06JXtMfb5nUXpJTp-Khted46CXdnmVDBTOS8sOcKC-wXHSzk4nStRw";

type Manifest = {
  name: string;
  key?: string;
  permissions?: string[];
  host_permissions?: string[];
};

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    env: { ...process.env, ...env },
    encoding: "utf8",
    timeout: 30_000,
  });
}

function manifestAt(relativePath: string): Manifest {
  return JSON.parse(readFileSync(`${repoRoot}/${relativePath}`, "utf8")) as Manifest;
}

function deriveId(key: string): string {
  const digest = createHash("sha256")
    .update(Buffer.from(key, "base64"))
    .digest()
    .subarray(0, 16);
  return [...digest]
    .flatMap((byte) => [byte >> 4, byte & 0x0f])
    .map((nibble) => String.fromCharCode("a".charCodeAt(0) + nibble))
    .join("");
}

function expectSuccessfulBuild(result: ReturnType<typeof run>) {
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
}

function expectNarrow(manifest: Manifest) {
  for (const pattern of broadPatterns) {
    expect(manifest.host_permissions ?? []).not.toContain(pattern);
  }
}

describe.sequential("extension release channel builds", () => {
  it("rejects an explicit unknown channel instead of silently building local", () => {
    const result = run(
      "pnpm",
      ["--filter", "@anidachi/extension", "build"],
      { WXT_EXTENSION_CHANNEL: "review-unknown" },
    );

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "Unsupported WXT_EXTENSION_CHANNEL: review-unknown",
    );
  });

  it("forces the public script to production despite a local caller override", () => {
    const result = run("bash", ["scripts/build-extension-public.sh"], {
      WXT_EXTENSION_CHANNEL: "local",
      WXT_VAPID_PUBLIC_KEY: testVapidPublicKey,
    });
    expectSuccessfulBuild(result);

    const manifest = manifestAt("anidachi-extension-public/manifest.json");
    expect(manifest.name).toBe("Anidachi");
    expect(manifest.key).toBeUndefined();
    expect(manifest.permissions ?? []).not.toContain("downloads");
    expect(manifest.host_permissions ?? []).toContain("https://www.anidachi.app/*");
    expectNarrow(manifest);
  });

  it("forces the staging script to staging despite a production caller override", () => {
    const result = run("bash", ["scripts/build-extension-staging.sh"], {
      WXT_EXTENSION_CHANNEL: "production",
    });
    expectSuccessfulBuild(result);

    const manifest = manifestAt("anidachi-extension-staging/manifest.json");
    expect(manifest.name).toBe("Anidachi Staging");
    expect(manifest.key).toBeTypeOf("string");
    expect(deriveId(manifest.key ?? "")).toBe(stagingId);
    expect(manifest.host_permissions ?? []).toContain("https://staging.anidachi.app/*");
    expectNarrow(manifest);
  });
});
