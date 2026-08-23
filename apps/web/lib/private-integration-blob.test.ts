import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createPrivateIntegrationBlobClient,
  isPrivateIntegrationBlobPath,
  type PrivateIntegrationBlobSdk,
} from "./private-integration-blob";

const JOB_ID = "3ff22310-95cf-4593-84a8-405ae8b72117";

function textResult(pathname: string, value: string) {
  return {
    statusCode: 200 as const,
    stream: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(value));
        controller.close();
      },
    }),
    blob: {
      pathname,
      contentType: "application/json",
      size: Buffer.byteLength(value),
      etag: '"fixture"',
      cacheControl: "public, max-age=60",
    },
  };
}

describe("private integration Blob boundary", () => {
  it("accepts only the inventoried integration and job paths", () => {
    for (const pathname of [
      "instagram/credentials.json",
      "tiktok/credentials.json",
      "youtube/credentials.json",
      "google-ads/tokens.json",
      "kreatli-crm/gmail-tokens.json",
      "kreatli-crm/contacts.json",
      "kreatli-crm/touches.jsonl",
      "kreatli-crm/meta.json",
      "kreatli-crm/contact-messages.jsonl",
      "kreatli-crm/feature-requests.jsonl",
      `openclaw/jobs/${JOB_ID}.json`,
    ]) {
      assert.equal(isPrivateIntegrationBlobPath(pathname), true, pathname);
    }

    for (const pathname of [
      "openclaw/jobs/not-a-uuid.json",
      `openclaw/jobs/${JOB_ID}.png`,
      "openclaw/video/2026-08-18/file.mp4",
      "kreatli-crm/../youtube/credentials.json",
      "blou/2026-08-18/public.png",
    ]) {
      assert.equal(isPrivateIntegrationBlobPath(pathname), false, pathname);
    }
  });

  it("writes only to private storage even when obsolete phase-A input is present", async () => {
    const calls: Array<{ operation: string; options: unknown }> = [];
    const sdk: PrivateIntegrationBlobSdk = {
      get: async () => null,
      put: async (_pathname, _body, options) => {
        calls.push({ operation: "put", options });
        return { pathname: "youtube/credentials.json" };
      },
      del: async () => undefined,
    };
    const client = createPrivateIntegrationBlobClient({
      privateAuth: { storeId: "store_private", oidcToken: "oidc-fixture" },
      phaseALegacyAuthority: { enabled: true, token: "legacy-public-token" },
      sdk,
    } as Parameters<typeof createPrivateIntegrationBlobClient>[0]);

    await client.writeText("youtube/credentials.json", '{"token":"secret"}');

    assert.deepEqual(calls, [
      {
        operation: "put",
        options: {
          access: "private",
          storeId: "store_private",
          oidcToken: "oidc-fixture",
          addRandomSuffix: false,
          allowOverwrite: true,
          cacheControlMaxAge: 60,
          contentType: "application/json",
        },
      },
    ]);
  });

  it("reads only origin-fresh private storage even when obsolete phase-A input is present", async () => {
    const calls: Array<{
      operation: "get";
      target: string;
      options: unknown;
    }> = [];
    const sdk: PrivateIntegrationBlobSdk = {
      get: async (target, options) => {
        calls.push({ operation: "get", target, options });
        const pathname = target.startsWith("https:")
          ? new URL(target).pathname.slice(1)
          : target;
        return textResult(pathname, "private-value");
      },
      put: async () => ({ pathname: "unused" }),
      del: async () => undefined,
    };
    const client = createPrivateIntegrationBlobClient({
      privateAuth: { token: "private-token" },
      phaseALegacyAuthority: { enabled: true, token: "legacy-public-token" },
      sdk,
    } as Parameters<typeof createPrivateIntegrationBlobClient>[0]);

    assert.equal(
      await client.readText("kreatli-crm/contacts.json"),
      "private-value",
    );
    assert.deepEqual(calls, [
      {
        operation: "get",
        target: "kreatli-crm/contacts.json",
        options: {
          access: "private",
          token: "private-token",
          useCache: false,
        },
      },
    ]);
  });

  it("deletes only private storage even when obsolete phase-A input is present", async () => {
    const calls: Array<{ pathname: string; options: unknown }> = [];
    const sdk: PrivateIntegrationBlobSdk = {
      get: async () => null,
      put: async () => ({ pathname: "unused" }),
      del: async (pathname, options) => {
        calls.push({ pathname, options });
      },
    };
    const client = createPrivateIntegrationBlobClient({
      privateAuth: { token: "private-token" },
      phaseALegacyAuthority: { enabled: true, token: "legacy-public-token" },
      sdk,
    } as Parameters<typeof createPrivateIntegrationBlobClient>[0]);

    await client.delete("google-ads/tokens.json");

    assert.deepEqual(calls, [
      {
        pathname: "google-ads/tokens.json",
        options: { token: "private-token" },
      },
    ]);
  });

  it("rejects unknown paths before any Blob operation", async () => {
    let calls = 0;
    const sdk: PrivateIntegrationBlobSdk = {
      get: async () => {
        calls += 1;
        return null;
      },
      put: async () => {
        calls += 1;
        return { pathname: "unused" };
      },
      del: async () => {
        calls += 1;
      },
    };
    const client = createPrivateIntegrationBlobClient({
      privateAuth: { token: "private-token" },
      sdk,
    });

    await assert.rejects(
      client.readText("kreatli-crm/../youtube/credentials.json"),
      /not an allowed private integration Blob path/,
    );
    await assert.rejects(
      client.writeText("openclaw/video/file.mp4", "secret"),
      /not an allowed private integration Blob path/,
    );
    assert.equal(calls, 0);
  });
});
