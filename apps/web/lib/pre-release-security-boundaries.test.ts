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

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

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
    const [packageText, middlewareText, actionsText] = await Promise.all([
      readFile(new URL("../package.json", import.meta.url), "utf8"),
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
    assert.equal(
      compareVersions(installedNext, "15.5.23") >= 0,
      true,
      `expected Next >= 15.5.23, received ${installedNext}`,
    );
  });
});
