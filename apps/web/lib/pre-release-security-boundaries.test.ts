import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import Module from "node:module";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { afterEach, describe, it } from "node:test";

type ModuleLoader = typeof Module & {
  _load: (
    request: string,
    parent: NodeModule | undefined,
    isMain: boolean,
  ) => unknown;
};

const moduleLoader = Module as ModuleLoader;
const originalModuleLoad = moduleLoader._load;
const originalBlobToken = process.env.BLOB_READ_WRITE_TOKEN;

afterEach(() => {
  moduleLoader._load = originalModuleLoad;
  if (originalBlobToken === undefined) {
    delete process.env.BLOB_READ_WRITE_TOKEN;
  } else {
    process.env.BLOB_READ_WRITE_TOKEN = originalBlobToken;
  }
});

describe("pre-release security boundaries", () => {
  it("rejects private Blob namespaces before the media route calls Blob", async () => {
    const requestedPaths: string[] = [];
    moduleLoader._load = (request, parent, isMain) => {
      if (request === "@vercel/blob") {
        return {
          get: async (pathname: string) => {
            requestedPaths.push(pathname);
            return null;
          },
        };
      }
      return originalModuleLoad(request, parent, isMain);
    };
    process.env.BLOB_READ_WRITE_TOKEN = "test-token";

    const routeUrl = pathToFileURL(
      resolve(process.cwd(), "app/api/media/[...path]/route.ts"),
    );
    routeUrl.searchParams.set("security-boundary", crypto.randomUUID());
    const { GET } = await import(routeUrl.href);

    const response = await GET(new Request("https://staging.anidachi.app") as never, {
      params: Promise.resolve({
        path: ["kreatli-crm", "gmail-tokens.json"],
      }),
    });

    assert.equal(response.status, 404);
    assert.deepEqual(requestedPaths, []);
  });

  it("uses the current fixed Next 15.5 backport on exposed framework surfaces", async () => {
    const [packageText, lockText, middlewareText, actionsText] =
      await Promise.all([
        readFile(new URL("../package.json", import.meta.url), "utf8"),
        readFile(new URL("../../../pnpm-lock.yaml", import.meta.url), "utf8"),
        readFile(new URL("../middleware.ts", import.meta.url), "utf8"),
        readFile(
          new URL("../app/kreatli-email-crm/actions.ts", import.meta.url),
          "utf8",
        ),
      ]);
    const packageJson = JSON.parse(packageText) as {
      dependencies?: { next?: string };
    };
    const installedNext = packageJson.dependencies?.next ?? "0.0.0";

    assert.match(middlewareText, /export async function middleware/);
    assert.match(actionsText, /^["']use server["'];/m);
    assert.equal(installedNext, "15.5.23");
    assert.match(lockText, /next:\n\s+specifier: 15\.5\.23\n\s+version: 15\.5\.23/);
    assert.doesNotMatch(lockText, /next@15\.5\.(?:[0-9]|1[0-9]|20)(?:\(|:)/);
  });

  it("routes every inventoried private Blob owner through the private boundary", async () => {
    const ownerPaths = [
      "instagram/storage.ts",
      "tiktok/storage.ts",
      "youtube/storage.ts",
      "google-ads/tokens.ts",
      "kreatli-crm/gmail-tokens.ts",
      "kreatli-crm/store.ts",
      "kreatli-crm/contact-messages.ts",
      "kreatli-crm/feature-requests.ts",
      "kreatli-crm/private-integration-blob-jsonl.ts",
      "openclaw-jobs.ts",
    ];

    for (const ownerPath of ownerPaths) {
      const source = await readFile(new URL(ownerPath, import.meta.url), "utf8");
      assert.match(source, /private-integration-blob/, ownerPath);
      assert.doesNotMatch(source, /BLOB_READ_WRITE_TOKEN|BLOB_ACCESS/, ownerPath);
      assert.doesNotMatch(source, /from ["']@vercel\/blob["']/, ownerPath);
    }
  });

  it("keeps a configured private CRM store authoritative when objects are absent", async () => {
    const source = await readFile(
      new URL("kreatli-crm/store.ts", import.meta.url),
      "utf8",
    );

    assert.match(
      source,
      /readMeta[\s\S]*if \(!blobText\) return \{ schema_version: 1, updated_at: null \};/,
    );
    assert.match(
      source,
      /readTouches[\s\S]*if \(!blobText\) return \[\];/,
    );
  });

  it("keeps the plan and design aligned after Task 6 staging acceptance", async () => {
    const expectedStatus = [
      "Status: Wave 1 complete on staging; Wave 2 Task 5 deployed to staging, with",
      "interactive provider acceptance pending; Task 6 staging acceptance complete",
      "for the approved artifact, exact PKCE/replay bindings, and first-profile",
      "logout callback",
    ].join("\n");
    const [plan, design] = await Promise.all([
      readFile(
        new URL(
          "../../../docs/superpowers/plans/2026-08-18-pre-release-security-reliability-readiness-plan.md",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../../../docs/superpowers/specs/2026-08-18-pre-release-security-reliability-readiness-design.md",
          import.meta.url,
        ),
        "utf8",
      ),
    ]);

    assert.ok(plan.includes(expectedStatus));
    assert.ok(design.includes(expectedStatus));
  });

  it("does not report credential disconnect success after a Blob delete failure", async () => {
    for (const ownerPath of [
      "kreatli-crm/gmail-tokens.ts",
      "google-ads/tokens.ts",
    ]) {
      const source = await readFile(new URL(ownerPath, import.meta.url), "utf8");
      assert.match(source, /await deletePrivateIntegrationBlob\(BLOB_PATH\);/);
      assert.doesNotMatch(
        source,
        /deletePrivateIntegrationBlob\(BLOB_PATH\)\.catch/,
      );
    }
  });
});
