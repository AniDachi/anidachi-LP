import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
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
const productionId = "gpkolofebdhfpapbbgdkdkmlmjfidgmn";
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
const productionSiteMatches = [
  "https://www.anidachi.app/*",
  "https://anidachi.app/*",
];
const stagingSiteMatches = ["https://staging.anidachi.app/*"];
const hostileEnvironment = {
  NODE_ENV: "test",
  WXT_WEB_HTTP_BASE: "https://evil-web.example",
  WXT_API_HTTP_BASE: "https://evil-api.example",
  WXT_API_WS_BASE: "wss://evil-ws.example",
  WXT_BROAD_HOST_PERMISSIONS: "true",
};
const testVapidPublicKey =
  "BMmz4hkjcP6LhcnVsnYhWVsod_g59o0qr06JXtMfb5nUXpJTp-Khted46CXdnmVDBTOS8sOcKC-wXHSzk4nStRw";

type ContentScript = {
  js?: string[];
  matches?: string[];
  all_frames?: boolean;
  run_at?: string;
  match_about_blank?: boolean;
  match_origin_as_fallback?: boolean;
  world?: string;
};

type Manifest = {
  name: string;
  key?: string;
  permissions?: string[];
  host_permissions?: string[];
  web_accessible_resources?: Array<{ resources?: string[]; matches?: string[] }>;
  content_scripts?: ContentScript[];
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

function expectExact(actual: readonly string[] | undefined, expected: readonly string[]) {
  expect([...(actual ?? [])].sort()).toEqual([...expected].sort());
}

function contentScript(manifest: Manifest, name: "content" | "crunchyroll" | "site-presence") {
  const script = manifest.content_scripts?.find((entry) =>
    entry.js?.includes(`content-scripts/${name}.js`),
  );
  expect(script, `Missing ${name} content script`).toBeDefined();
  return script!;
}

function expectContentScriptRoles(
  manifest: Manifest,
  overlayMatches: string[],
  siteMatches: string[],
) {
  expect(manifest.content_scripts).toHaveLength(3);
  for (const [name, matches, allFrames, world] of [
    ["content", overlayMatches, true, "ISOLATED"],
    ["crunchyroll", ["https://*.crunchyroll.com/*"], false, "MAIN"],
    ["site-presence", siteMatches, false, "ISOLATED"],
  ] as const) {
    const script = contentScript(manifest, name);
    expect(script.js).toEqual([`content-scripts/${name}.js`]);
    expectExact(script.matches, matches);
    expect(script.all_frames ?? false).toBe(allFrames);
    expect(script.run_at).toBe("document_start");
    expect(script.world ?? "ISOLATED").toBe(world);
  }
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
  expect(text).not.toContain("Static children should always be an array");
}

function validateFixture(
  manifest: Manifest,
  javascript?: string,
  channel: "production" | "staging" = "production",
) {
  const fixture = mkdtempSync(join(tmpdir(), "anidachi-extension-validator-"));
  writeFileSync(join(fixture, "manifest.json"), JSON.stringify(manifest));
  if (javascript) {
    const contentScriptsDir = join(fixture, "content-scripts");
    mkdirSync(contentScriptsDir, { recursive: true });
    writeFileSync(join(contentScriptsDir, "content.js"), javascript);
  }
  try {
    return run(
      "node",
      [
        "scripts/validate-extension-artifact.mjs",
        "--channel",
        channel,
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
    expect(manifest.name).toBe("AniDachi");
    expect(manifest.version_name).toBeUndefined();
    expect(manifest.key).toBeTypeOf("string");
    expect(deriveId(manifest.key ?? "")).toBe(productionId);
    expect(manifest.permissions ?? []).not.toContain("downloads");
    expectExact(manifest.host_permissions, productionHostPermissions);
    expectContentScriptRoles(manifest, videoHosts, productionSiteMatches);
    expectExact(manifest.web_accessible_resources?.[0]?.matches, videoHosts);
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
    expect(manifest.name).toBe("AniDachi Staging");
    expect(manifest.version_name).toBeUndefined();
    expect(manifest.key).toBeTypeOf("string");
    expect(deriveId(manifest.key ?? "")).toBe(stagingId);
    expectExact(manifest.host_permissions, [
      ...videoHosts,
      "https://staging.anidachi.app/*",
      "https://anidachi-api-staging.vladislav-gul7.workers.dev/*",
    ]);
    expectContentScriptRoles(manifest, videoHosts, stagingSiteMatches);
    expectExact(manifest.web_accessible_resources?.[0]?.matches, videoHosts);
    expectNarrow(manifest);
    expectCanonicalRuntime("anidachi-extension-staging", {
      web: "https://staging.anidachi.app",
      api: "https://anidachi-api-staging.vladislav-gul7.workers.dev",
      ws: "wss://anidachi-api-staging.vladislav-gul7.workers.dev",
    });
  });

  it.each([
    "build:extension:staging:local-broad",
    "build:extension:staging:broad",
  ])("keeps %s separate from the narrow staging artifact", {
    timeout: BUILD_TEST_TIMEOUT_MS,
  }, (command) => {
    const narrowManifestBefore = readFileSync(
      `${repoRoot}/anidachi-extension-staging/manifest.json`,
      "utf8",
    );
    const result = run("pnpm", [command], {
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
    expect(manifest.name).toBe("AniDachi Staging");
    expectExact(manifest.host_permissions, localHostPermissions);
    expectContentScriptRoles(manifest, localHostPermissions, stagingSiteMatches);
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

  it.each([
    ["production", "anidachi-extension-public"],
    ["staging", "anidachi-extension-staging"],
  ])("validates the real %s artifact with its own stable identity", (channel, dir) => {
    const result = run("node", [
      "scripts/validate-extension-artifact.mjs", "--channel", channel, "--dir", dir,
    ], {});
    expectSuccessfulBuild(result);
  });

  it("rejects a production artifact without its approved public key", () => {
    const manifest = manifestAt("anidachi-extension-public/manifest.json");
    delete manifest.key;

    const result = validateFixture(manifest);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "production artifact is missing its stable public manifest key",
    );
  });

  it("rejects a production artifact carrying the staging identity", () => {
    const manifest = manifestAt("anidachi-extension-public/manifest.json");
    manifest.key = manifestAt("anidachi-extension-staging/manifest.json").key;

    const result = validateFixture(manifest);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      `Expected production extension ID ${productionId}, got ${stagingId}`,
    );
  });

  it("rejects a staging artifact carrying the production identity", () => {
    const manifest = manifestAt("anidachi-extension-staging/manifest.json");
    manifest.key = manifestAt("anidachi-extension-public/manifest.json").key;
    const result = validateFixture(manifest, undefined, "staging");
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      `Expected staging extension ID ${stagingId}, got ${productionId}`,
    );
  });

  it("rejects a staging artifact without its stable key", () => {
    const manifest = manifestAt("anidachi-extension-staging/manifest.json");
    delete manifest.key;
    const result = validateFixture(manifest, undefined, "staging");
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "staging artifact is missing its stable public manifest key",
    );
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
    contentScript(manifest, "content").matches!.push("https://evil-extra.example/*");

    const result = validateFixture(manifest);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "Unexpected overlay content-script match: https://evil-extra.example/*",
    );
  });

  it("rejects swapped script scopes even when the combined allowlist stays the same", () => {
    const manifest = manifestAt("anidachi-extension-public/manifest.json");
    const overlay = contentScript(manifest, "content");
    const presence = contentScript(manifest, "site-presence");
    [overlay.matches, presence.matches] = [presence.matches, overlay.matches];
    const result = validateFixture(manifest);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("Unexpected overlay content-script match");
  });

  it.each(["content", "site-presence"] as const)(
    "rejects mixed scripts in the %s scope", (name) => {
      const manifest = manifestAt("anidachi-extension-public/manifest.json");
      contentScript(manifest, name).js!.push("content-scripts/unapproved.js");
      const result = validateFixture(manifest);
      expect(result.status).not.toBe(0);
      expect(`${result.stdout}\n${result.stderr}`).toContain("Expected exactly one JavaScript file per content script");
    },
  );

  it.each([
    ["missing", (manifest: Manifest) => manifest.content_scripts!.pop()],
    ["duplicate", (manifest: Manifest) => manifest.content_scripts!.push(contentScript(manifest, "content"))],
    ["unknown", (manifest: Manifest) => { contentScript(manifest, "site-presence").js = ["content-scripts/unknown.js"]; }],
  ])("rejects a %s script role", (_name, mutate) => {
    const manifest = manifestAt("anidachi-extension-public/manifest.json");
    mutate(manifest);
    const result = validateFixture(manifest);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toMatch(/Missing required content script|Duplicate content script|Unexpected content script/);
  });

  it("rejects production presence on the staging site", () => {
    const manifest = manifestAt("anidachi-extension-public/manifest.json");
    contentScript(manifest, "site-presence").matches!.push(...stagingSiteMatches);
    const result = validateFixture(manifest);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("Unexpected site-presence content-script match");
  });

  it("preserves the Crunchyroll page bridge in its required main world", () => {
    const manifest = manifestAt("anidachi-extension-public/manifest.json");
    contentScript(manifest, "crunchyroll").world = "ISOLATED";
    const result = validateFixture(manifest);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("Invalid execution scope for crunchyroll content script");
  });

  it.each([
    ["all_frames", true],
    ["run_at", "document_idle"],
    ["match_about_blank", true],
    ["match_origin_as_fallback", true],
    ["world", "MAIN"],
  ])("rejects changed presence execution scope %s", (key, value) => {
    const manifest = manifestAt("anidachi-extension-public/manifest.json");
    Object.assign(contentScript(manifest, "site-presence"), { [key]: value });
    const result = validateFixture(manifest);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("Invalid execution scope for site-presence content script");
  });

  it("rejects a public logo accessible from unrelated sites", () => {
    const manifest = manifestAt("anidachi-extension-public/manifest.json");
    manifest.web_accessible_resources = [{ resources: ["Anidachi_logo.png"], matches: ["*://*/*"] }];
    const result = validateFixture(manifest);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("Unexpected public resource match: *://*/*");
  });

  it("rejects an artifact that calls the unavailable production jsxDEV runtime", () => {
    const manifest = manifestAt("anidachi-extension-public/manifest.json");
    const result = validateFixture(
      manifest,
      "var runtime={jsxDEV:void 0};(0,runtime.jsxDEV)(Component,{});",
    );

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "production artifact calls jsxDEV",
    );
  });

  it("rejects an artifact that bundles the React development runtime", () => {
    const manifest = manifestAt("anidachi-extension-public/manifest.json");
    const result = validateFixture(
      manifest,
      'console.error("React.jsx: Static children should always be an array.");',
    );

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "artifact contains the React development runtime",
    );
  });
});
