import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(process.cwd(), "../..");
const BUILD_TEST_TIMEOUT_MS = 30_000;
const stagingId = "ndkfphbchhfephdodcpehdcoclojagje";
const broadPatterns = ["http://*/*", "https://*/*", "file:///*", "<all_urls>"];
const localHostPermissions = [
  "http://127.0.0.1/*",
  "http://localhost/*",
  "http://*/*",
  "https://*/*",
  "file:///*",
];
const videoHosts = [
  "https://youtube.com/*",
  "https://*.youtube.com/*",
  "https://youtu.be/*",
  "https://*.youtu.be/*",
  "https://*.youtube-nocookie.com/*",
  "https://crunchyroll.com/*",
  "https://*.crunchyroll.com/*",
];
const productionHostPermissions = [
  ...videoHosts,
  "https://www.anidachi.app/*",
  "https://anidachi-api-production.vladislav-gul7.workers.dev/*",
];
const hostileEnvironment = {
  WXT_WEB_HTTP_BASE: "https://evil-web.example",
  WXT_API_HTTP_BASE: "https://evil-api.example",
  WXT_API_WS_BASE: "wss://evil-ws.example",
  WXT_BROAD_HOST_PERMISSIONS: "true",
};
const testVapidPublicKey =
  "BMmz4hkjcP6LhcnVsnYhWVsod_g59o0qr06JXtMfb5nUXpJTp-Khted46CXdnmVDBTOS8sOcKC-wXHSzk4nStRw";

type Manifest = {
  name: string;
  key?: string;
  permissions?: string[];
  host_permissions?: string[];
  content_scripts?: Array<{ matches?: string[] }>;
  [key: string]: unknown;
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

function expectExact(actual: string[] | undefined, expected: string[]) {
  expect([...(actual ?? [])].sort()).toEqual([...expected].sort());
}

function contentMatches(manifest: Manifest): string[] {
  return [
    ...new Set(
      (manifest.content_scripts ?? []).flatMap((script) => script.matches ?? []),
    ),
  ];
}

function artifactText(relativePath: string): string {
  const root = `${repoRoot}/${relativePath}`;
  const files: string[] = [];
  const visit = (entry: string) => {
    if (statSync(entry).isDirectory()) {
      for (const child of readdirSync(entry)) visit(join(entry, child));
    } else if (entry.endsWith(".js") || entry.endsWith(".json")) {
      files.push(readFileSync(entry, "utf8"));
    }
  };
  visit(root);
  return files.join("\n");
}

function expectCanonicalRuntime(
  relativePath: string,
  expected: { web: string; api: string; ws: string },
) {
  const text = artifactText(relativePath);
  expect(text).toContain(expected.web);
  expect(text).toContain(expected.api);
  expect(text).toContain(expected.ws);
  expect(text).not.toContain("evil-web.example");
  expect(text).not.toContain("evil-api.example");
  expect(text).not.toContain("evil-ws.example");
}

function validateFixture(manifest: Manifest) {
  const fixture = mkdtempSync(join(tmpdir(), "anidachi-extension-validator-"));
  writeFileSync(join(fixture, "manifest.json"), JSON.stringify(manifest));
  try {
    return run(
      "node",
      [
        "scripts/validate-extension-artifact.mjs",
        "--channel",
        "production",
        "--dir",
        fixture,
      ],
      {},
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
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

  it("forces the public script to its exact production runtime profile", {
    timeout: BUILD_TEST_TIMEOUT_MS,
  }, () => {
    const result = run("bash", ["scripts/build-extension-public.sh"], {
      WXT_EXTENSION_CHANNEL: "local",
      WXT_VAPID_PUBLIC_KEY: testVapidPublicKey,
      ...hostileEnvironment,
    });
    expectSuccessfulBuild(result);

    const manifest = manifestAt("anidachi-extension-public/manifest.json");
    expect(manifest.name).toBe("Anidachi");
    expect(manifest.key).toBeUndefined();
    expect(manifest.permissions ?? []).not.toContain("downloads");
    expectExact(manifest.host_permissions, productionHostPermissions);
    expectExact(contentMatches(manifest), videoHosts);
    expectNarrow(manifest);
    expectCanonicalRuntime("anidachi-extension-public", {
      web: "https://www.anidachi.app",
      api: "https://anidachi-api-production.vladislav-gul7.workers.dev",
      ws: "wss://anidachi-api-production.vladislav-gul7.workers.dev",
    });
  });

  it("forces the narrow staging script to its exact staging runtime profile", {
    timeout: BUILD_TEST_TIMEOUT_MS,
  }, () => {
    const result = run("bash", ["scripts/build-extension-staging.sh"], {
      WXT_EXTENSION_CHANNEL: "production",
      ...hostileEnvironment,
    });
    expectSuccessfulBuild(result);

    const manifest = manifestAt("anidachi-extension-staging/manifest.json");
    expect(manifest.name).toBe("Anidachi Staging");
    expect(manifest.key).toBeTypeOf("string");
    expect(deriveId(manifest.key ?? "")).toBe(stagingId);
    expectExact(manifest.host_permissions, [
      ...videoHosts,
      "https://staging.anidachi.app/*",
      "https://anidachi-api-staging.vladislav-gul7.workers.dev/*",
    ]);
    expectExact(contentMatches(manifest), videoHosts);
    expectNarrow(manifest);
    expectCanonicalRuntime("anidachi-extension-staging", {
      web: "https://staging.anidachi.app",
      api: "https://anidachi-api-staging.vladislav-gul7.workers.dev",
      ws: "wss://anidachi-api-staging.vladislav-gul7.workers.dev",
    });
  });

  it("keeps broad staging available only through the explicit broad command", {
    timeout: BUILD_TEST_TIMEOUT_MS,
  }, () => {
    const narrowManifestBefore = readFileSync(
      `${repoRoot}/anidachi-extension-staging/manifest.json`,
      "utf8",
    );
    const result = run("pnpm", ["build:extension:staging:local-broad"], {
      ...hostileEnvironment,
      WXT_BROAD_HOST_PERMISSIONS: "false",
    });
    expectSuccessfulBuild(result);

    expect(
      readFileSync(
        `${repoRoot}/anidachi-extension-staging/manifest.json`,
        "utf8",
      ),
    ).toBe(narrowManifestBefore);

    const manifest = manifestAt(
      "anidachi-extension-staging-local-broad/manifest.json",
    );
    expect(manifest.name).toBe("Anidachi Staging");
    expectExact(manifest.host_permissions, localHostPermissions);
    expectExact(contentMatches(manifest), [
      ...localHostPermissions,
      "https://*.crunchyroll.com/*",
    ]);
    expectCanonicalRuntime("anidachi-extension-staging-local-broad", {
      web: "https://staging.anidachi.app",
      api: "https://anidachi-api-staging.vladislav-gul7.workers.dev",
      ws: "wss://anidachi-api-staging.vladislav-gul7.workers.dev",
    });

    const ignoreCheck = run(
      "git",
      [
        "check-ignore",
        "--quiet",
        "anidachi-extension-staging-local-broad/manifest.json",
      ],
      {},
    );
    expect(ignoreCheck.status, ignoreCheck.stderr).toBe(0);
  });

  it("rejects an otherwise valid production artifact with an extra host", () => {
    const manifest = manifestAt("anidachi-extension-public/manifest.json");
    manifest.host_permissions = [
      ...productionHostPermissions,
      "https://evil-extra.example/*",
    ];

    const result = validateFixture(manifest);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "Unexpected host permission: https://evil-extra.example/*",
    );
  });

  it("rejects an otherwise valid production artifact with an extra content match", () => {
    const manifest = manifestAt("anidachi-extension-public/manifest.json");
    manifest.host_permissions = productionHostPermissions;
    manifest.content_scripts = [
      ...(manifest.content_scripts ?? []),
      { matches: ["https://evil-extra.example/*"] },
    ];

    const result = validateFixture(manifest);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "Unexpected content-script match: https://evil-extra.example/*",
    );
  });
});
