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

function headResult(pathname: string, etag = '"fixture"') {
  return {
    pathname,
    url: `https://public-fixture.public.blob.vercel-storage.com/${pathname}`,
    etag,
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

  it("writes to the legacy authority before private storage during phase A", async () => {
    const calls: Array<{ operation: string; options: unknown }> = [];
    const sdk: PrivateIntegrationBlobSdk = {
      head: async () => null,
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
    });

    await client.writeText("youtube/credentials.json", '{"token":"secret"}');

    assert.deepEqual(calls, [
      {
        operation: "put",
        options: {
          access: "public",
          token: "legacy-public-token",
          addRandomSuffix: false,
          allowOverwrite: true,
          cacheControlMaxAge: 60,
          contentType: "application/json",
        },
      },
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

  it("reads only the origin-fresh legacy authority during phase A", async () => {
    const calls: Array<{
      operation: "head" | "get";
      target: string;
      options: unknown;
    }> = [];
    const sdk: PrivateIntegrationBlobSdk = {
      head: async (pathname, options) => {
        calls.push({ operation: "head", target: pathname, options });
        return headResult(pathname);
      },
      get: async (target, options) => {
        calls.push({ operation: "get", target, options });
        const pathname = new URL(target).pathname.slice(1);
        if ("access" in options && options.access === "public") {
          return textResult(pathname, "legacy-value");
        }
        return textResult(pathname, "stale-private-value");
      },
      put: async () => ({ pathname: "unused" }),
      del: async () => undefined,
    };
    const client = createPrivateIntegrationBlobClient({
      privateAuth: { token: "private-token" },
      phaseALegacyAuthority: { enabled: true, token: "legacy-public-token" },
      sdk,
    });

    assert.equal(
      await client.readText("kreatli-crm/contacts.json"),
      "legacy-value",
    );
    assert.deepEqual(calls, [
      {
        operation: "head",
        target: "kreatli-crm/contacts.json",
        options: { token: "legacy-public-token" },
      },
      {
        operation: "get",
        target:
          "https://public-fixture.public.blob.vercel-storage.com/kreatli-crm/contacts.json?v=fixture",
        options: { access: "public", token: "legacy-public-token" },
      },
    ]);
  });

  it("fails closed when the legacy body ETag differs from fresh metadata", async () => {
    const sdk: PrivateIntegrationBlobSdk = {
      head: async (pathname) => headResult(pathname, '"fresh"'),
      get: async (target) => {
        const pathname = new URL(target).pathname.slice(1);
        return textResult(pathname, "stale-value");
      },
      put: async () => ({ pathname: "unused" }),
      del: async () => undefined,
    };
    const client = createPrivateIntegrationBlobClient({
      privateAuth: { token: "private-token" },
      phaseALegacyAuthority: { enabled: true, token: "legacy-public-token" },
      sdk,
    });

    await assert.rejects(
      client.readText("kreatli-crm/contacts.json"),
      /changed during the phase-A read/,
    );
  });

  it("reads only origin-fresh private storage after compatibility is disabled", async () => {
    const calls: Array<{ pathname: string; options: unknown }> = [];
    const sdk: PrivateIntegrationBlobSdk = {
      head: async () => null,
      get: async (pathname, options) => {
        calls.push({ pathname, options });
        return textResult(pathname, "private-value");
      },
      put: async () => ({ pathname: "unused" }),
      del: async () => undefined,
    };
    const client = createPrivateIntegrationBlobClient({
      privateAuth: { token: "private-token" },
      phaseALegacyAuthority: { enabled: false, token: "legacy-public-token" },
      sdk,
    });

    assert.equal(
      await client.readText("instagram/credentials.json"),
      "private-value",
    );
    assert.deepEqual(calls, [
      {
        pathname: "instagram/credentials.json",
        options: {
          access: "private",
          token: "private-token",
          useCache: false,
        },
      },
    ]);
  });

  it("deletes private then legacy storage before reporting phase-A success", async () => {
    const calls: Array<{ pathname: string; options: unknown }> = [];
    const sdk: PrivateIntegrationBlobSdk = {
      head: async () => null,
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
    });

    await client.delete("google-ads/tokens.json");

    assert.deepEqual(calls, [
      {
        pathname: "google-ads/tokens.json",
        options: { token: "private-token" },
      },
      {
        pathname: "google-ads/tokens.json",
        options: { token: "legacy-public-token" },
      },
    ]);
  });

  it("fails closed before any operation when phase A lacks its legacy credential", async () => {
    let calls = 0;
    const sdk: PrivateIntegrationBlobSdk = {
      head: async () => null,
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
      phaseALegacyAuthority: { enabled: true },
      sdk,
    });

    await assert.rejects(
      client.readText("youtube/credentials.json"),
      /legacy Blob authority is not configured/,
    );
    await assert.rejects(
      client.writeText("youtube/credentials.json", "{}"),
      /legacy Blob authority is not configured/,
    );
    await assert.rejects(
      client.delete("youtube/credentials.json"),
      /legacy Blob authority is not configured/,
    );
    assert.equal(calls, 0);
  });

  it("rejects unknown paths before any Blob operation", async () => {
    let calls = 0;
    const sdk: PrivateIntegrationBlobSdk = {
      head: async () => null,
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
      phaseALegacyAuthority: { enabled: true, token: "legacy-public-token" },
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
