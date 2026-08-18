import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  runPrivateIntegrationBlobMigration,
  type PrivateIntegrationBlobMigrationSdk,
} from "../scripts/migrate-private-integration-blobs";

const PATHNAME = "youtube/credentials.json";
const SECRET_BODY = '{"refreshToken":"must-not-appear-in-logs"}';

function stream(value: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(value));
      controller.close();
    },
  });
}

function readResult(pathname: string, value: string) {
  return {
    statusCode: 200 as const,
    stream: stream(value),
    blob: {
      pathname,
      size: Buffer.byteLength(value),
      contentType: "application/json",
      etag: '"source"',
      cacheControl: "public, max-age=60",
    },
  };
}

function streamingReadResult(pathname: string, value: string) {
  const result = readResult(pathname, value);
  return {
    ...result,
    blob: {
      ...result.blob,
      size: 0,
      etag: 'W/"source"',
    },
  };
}

function missingResult(pathname: string) {
  return {
    statusCode: 404 as const,
    stream: null,
    blob: {
      pathname,
      size: null,
      contentType: null,
    },
  };
}

function sourceList() {
  return {
    blobs: [
      {
        pathname: PATHNAME,
        size: Buffer.byteLength(SECRET_BODY),
        contentType: "application/json",
        etag: '"source"',
        url: `https://public.invalid/${PATHNAME}`,
      },
      {
        pathname: "openclaw/video/2026-08-18/public.mp4",
        size: 10,
        contentType: "video/mp4",
        etag: '"public"',
        url: "https://public.invalid/public.mp4",
      },
    ],
    hasMore: false,
    cursor: undefined,
  };
}

function destinationList(value: string) {
  return {
    blobs: [
      {
        pathname: PATHNAME,
        size: Buffer.byteLength(value),
        contentType: "application/json",
        etag: '"destination"',
        url: `https://private.invalid/${PATHNAME}`,
      },
    ],
    hasMore: false,
    cursor: undefined,
  };
}

describe("private integration Blob migration", () => {
  it("defaults to a metadata-only dry run and never reads object bodies", async () => {
    let bodyCalls = 0;
    const logs: string[] = [];
    const sdk: PrivateIntegrationBlobMigrationSdk = {
      list: async (options) =>
        "token" in options && options.token === "source-token"
          ? sourceList()
          : { blobs: [], hasMore: false, cursor: undefined },
      get: async () => {
        bodyCalls += 1;
        return null;
      },
      put: async () => {
        bodyCalls += 1;
        return { pathname: PATHNAME };
      },
    };

    const result = await runPrivateIntegrationBlobMigration({
      mode: "dry-run",
      sourceAuth: { token: "source-token" },
      privateAuth: { token: "private-token" },
      sdk,
      log: (entry) => logs.push(JSON.stringify(entry)),
    });

    assert.deepEqual(result, {
      discovered: 1,
      copied: 0,
      verified: 0,
      conflicts: 0,
    });
    assert.equal(bodyCalls, 0);
    assert.equal(logs.join("\n").includes("must-not-appear-in-logs"), false);
    assert.equal(logs.join("\n").includes("source-token"), false);
    assert.equal(logs.join("\n").includes("private-token"), false);
  });

  it("copies a missing object to private storage and verifies identical bytes", async () => {
    let destinationBody: string | null = null;
    const calls: Array<{ operation: string; options: unknown }> = [];
    const sdk: PrivateIntegrationBlobMigrationSdk = {
      list: async (options) =>
        "token" in options && options.token === "source-token"
          ? sourceList()
          : { blobs: [], hasMore: false, cursor: undefined },
      get: async (pathname, options) => {
        calls.push({ operation: "get", options });
        if ("access" in options && options.access === "public") {
          return streamingReadResult(pathname, SECRET_BODY);
        }
        return destinationBody === null
          ? missingResult(pathname)
          : readResult(pathname, destinationBody);
      },
      put: async (pathname, body, options) => {
        calls.push({ operation: "put", options });
        destinationBody = await new Response(body).text();
        return { pathname };
      },
    };

    const result = await runPrivateIntegrationBlobMigration({
      mode: "apply",
      sourceAuth: { token: "source-token" },
      privateAuth: { storeId: "store_private", oidcToken: "oidc-fixture" },
      sdk,
      log: () => undefined,
    });

    assert.equal(destinationBody, SECRET_BODY);
    assert.deepEqual(result, {
      discovered: 1,
      copied: 1,
      verified: 1,
      conflicts: 0,
    });
    assert.deepEqual(
      calls.find((call) => call.operation === "put")?.options,
      {
        access: "private",
        storeId: "store_private",
        oidcToken: "oidc-fixture",
        addRandomSuffix: false,
        allowOverwrite: false,
        cacheControlMaxAge: 60,
        contentType: "application/json",
      },
    );
    assert.equal(
      calls
        .filter((call) => call.operation === "get")
        .filter(
          (call) =>
            typeof call.options === "object" &&
            call.options !== null &&
            "access" in call.options &&
            call.options.access === "private",
        )
        .every(
          (call) =>
            typeof call.options === "object" &&
            call.options !== null &&
            "useCache" in call.options &&
            call.options.useCache === false,
        ),
      true,
    );
  });

  it("does not poison post-write verification with a cached destination 404", async () => {
    let destinationBody: string | null = null;
    let destinationMissWasRead = false;
    let destinationListCalls = 0;
    const sdk: PrivateIntegrationBlobMigrationSdk = {
      list: async (options) => {
        if ("token" in options && options.token === "source-token") {
          return sourceList();
        }
        destinationListCalls += 1;
        return { blobs: [], hasMore: false, cursor: undefined };
      },
      get: async (pathname, options) => {
        if ("access" in options && options.access === "public") {
          return readResult(pathname, SECRET_BODY);
        }
        if (destinationBody === null) {
          destinationMissWasRead = true;
          return missingResult(pathname);
        }
        return destinationMissWasRead
          ? missingResult(pathname)
          : readResult(pathname, destinationBody);
      },
      put: async (pathname, body) => {
        destinationBody = await new Response(body).text();
        return { pathname };
      },
    };

    const result = await runPrivateIntegrationBlobMigration({
      mode: "apply",
      sourceAuth: { token: "source-token" },
      privateAuth: { token: "private-token" },
      sdk,
      log: () => undefined,
    });

    assert.equal(destinationMissWasRead, false);
    assert.equal(destinationListCalls, 1);
    assert.deepEqual(result, {
      discovered: 1,
      copied: 1,
      verified: 1,
      conflicts: 0,
    });
  });

  it("recovers when destination listing is stale after an exact deletion", async () => {
    let destinationBody: string | null = null;
    const sdk: PrivateIntegrationBlobMigrationSdk = {
      list: async (options) =>
        "token" in options && options.token === "source-token"
          ? sourceList()
          : destinationList(SECRET_BODY),
      get: async (pathname, options) => {
        if ("access" in options && options.access === "public") {
          return readResult(pathname, SECRET_BODY);
        }
        return destinationBody === null
          ? missingResult(pathname)
          : readResult(pathname, destinationBody);
      },
      put: async (pathname, body) => {
        destinationBody = await new Response(body).text();
        return { pathname };
      },
    };

    const result = await runPrivateIntegrationBlobMigration({
      mode: "apply",
      sourceAuth: { token: "source-token" },
      privateAuth: { token: "private-token" },
      sdk,
      log: () => undefined,
    });

    assert.equal(destinationBody, SECRET_BODY);
    assert.deepEqual(result, {
      discovered: 1,
      copied: 1,
      verified: 1,
      conflicts: 0,
    });
  });

  it("stops before writing when the source ETag changed after listing", async () => {
    let puts = 0;
    const sdk: PrivateIntegrationBlobMigrationSdk = {
      list: async (options) =>
        "token" in options && options.token === "source-token"
          ? sourceList()
          : { blobs: [], hasMore: false, cursor: undefined },
      get: async (pathname, options) => {
        if ("access" in options && options.access === "public") {
          const result = readResult(pathname, SECRET_BODY);
          return { ...result, blob: { ...result.blob, etag: '"changed"' } };
        }
        return missingResult(pathname);
      },
      put: async () => {
        puts += 1;
        return { pathname: PATHNAME };
      },
    };

    await assert.rejects(
      runPrivateIntegrationBlobMigration({
        mode: "apply",
        sourceAuth: { token: "source-token" },
        privateAuth: { token: "private-token" },
        sdk,
        log: () => undefined,
      }),
      /Source changed during migration/,
    );
    assert.equal(puts, 0);
  });

  it("is resumable and refuses to overwrite a different destination", async () => {
    for (const destination of [SECRET_BODY, '{"newer":"destination"}']) {
      let puts = 0;
      const sdk: PrivateIntegrationBlobMigrationSdk = {
        list: async (options) =>
          "token" in options && options.token === "source-token"
            ? sourceList()
            : destinationList(destination),
        get: async (pathname, options) =>
          "access" in options && options.access === "public"
            ? readResult(pathname, SECRET_BODY)
            : readResult(pathname, destination),
        put: async () => {
          puts += 1;
          return { pathname: PATHNAME };
        },
      };

      const result = await runPrivateIntegrationBlobMigration({
        mode: "apply",
        sourceAuth: { token: "source-token" },
        privateAuth: { token: "private-token" },
        sdk,
        log: () => undefined,
      });

      assert.equal(puts, 0);
      assert.equal(result.verified, destination === SECRET_BODY ? 1 : 0);
      assert.equal(result.conflicts, destination === SECRET_BODY ? 0 : 1);
    }
  });
});
