import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_PUBLIC_MEDIA_BYTES,
  parsePublicMediaPath,
  type PublicMediaBlobGet,
  servePublicMedia,
} from "./public-media-blob";
import { INSTAGRAM_CREDENTIALS_BLOB_PATH } from "./instagram/storage";
import { TIKTOK_CREDENTIALS_BLOB_PATH } from "./tiktok/storage";
import { YOUTUBE_CREDENTIALS_BLOB_PATH } from "./youtube/storage";
import { GOOGLE_ADS_TOKENS_BLOB_PATH } from "./google-ads/tokens";
import { GMAIL_TOKENS_BLOB_PATH } from "./kreatli-crm/gmail-tokens";
import {
  KREATLI_CRM_CONTACTS_BLOB_PATH,
  KREATLI_CRM_META_BLOB_PATH,
  KREATLI_CRM_TOUCHES_BLOB_PATH,
} from "./kreatli-crm/store";
import { CONTACT_MESSAGES_BLOB_PATH } from "./kreatli-crm/contact-messages";
import { FEATURE_REQUESTS_BLOB_PATH } from "./kreatli-crm/feature-requests";
import { OPENCLAW_JOB_BLOB_PREFIX } from "./openclaw-jobs";

const MEDIA_ID = "3ff22310-95cf-4593-84a8-405ae8b72117";

function result200(input: {
  pathname: string;
  contentType: string;
  size: number;
  etag?: string;
  onCancel?: () => void;
}) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2, 3]));
    },
    cancel() {
      input.onCancel?.();
    },
  });
  return {
    statusCode: 200 as const,
    stream,
    blob: {
      pathname: input.pathname,
      contentType: input.contentType,
      size: input.size,
      etag: input.etag ?? '"media-etag"',
      cacheControl: "public, max-age=2592000",
    },
  };
}

describe("public media Blob boundary", () => {
  it("keeps every current private storage owner outside the public parser", () => {
    const privatePaths = [
      INSTAGRAM_CREDENTIALS_BLOB_PATH,
      TIKTOK_CREDENTIALS_BLOB_PATH,
      YOUTUBE_CREDENTIALS_BLOB_PATH,
      GOOGLE_ADS_TOKENS_BLOB_PATH,
      GMAIL_TOKENS_BLOB_PATH,
      KREATLI_CRM_CONTACTS_BLOB_PATH,
      KREATLI_CRM_TOUCHES_BLOB_PATH,
      KREATLI_CRM_META_BLOB_PATH,
      CONTACT_MESSAGES_BLOB_PATH,
      FEATURE_REQUESTS_BLOB_PATH,
      `${OPENCLAW_JOB_BLOB_PREFIX}/${MEDIA_ID}.json`,
    ];

    for (const pathname of privatePaths) {
      assert.equal(typeof pathname, "string");
      assert.equal(parsePublicMediaPath(pathname.split("/")), null, pathname);
    }
  });

  it("rejects private, job, traversal, encoded-separator, and unknown paths before Blob", async () => {
    const rejectedPaths = [
      ["instagram", "credentials.json"],
      ["tiktok", "credentials.json"],
      ["youtube", "credentials.json"],
      ["google-ads", "tokens.json"],
      ["kreatli-crm", "gmail-tokens.json"],
      ["kreatli-crm", "contacts.json"],
      ["openclaw", "jobs", `${MEDIA_ID}.json`],
      ["openclaw", "..", "kreatli-crm", "contacts.json"],
      ["openclaw", "%2e%2e", "kreatli-crm", "contacts.json"],
      ["openclaw", "video%2f..%2fkreatli-crm", "contacts.json"],
      ["openclaw", "video\\..\\kreatli-crm", "contacts.json"],
      ["unknown", "2026-08-18", `${MEDIA_ID}.png`],
      ["openclaw", "video", "2026-08-18", `${MEDIA_ID}.svg`],
    ] as const;
    const calls: string[] = [];
    const getBlob: PublicMediaBlobGet = async (pathname) => {
      calls.push(pathname);
      return null;
    };

    for (const path of rejectedPaths) {
      const response = await servePublicMedia({
        request: new Request("https://staging.anidachi.app/api/media/test"),
        path,
        token: "test-token",
        getBlob,
      });
      assert.equal(response.status, 404, path.join("/"));
    }
    assert.deepEqual(calls, []);
  });

  it("serves an exact application-owned image with safe streaming headers", async () => {
    const pathname = `openclaw/2026-08-18/${MEDIA_ID}.png`;
    const calls: Array<{ pathname: string; options: unknown }> = [];
    const getBlob: PublicMediaBlobGet = async (requestedPath, options) => {
      calls.push({ pathname: requestedPath, options });
      return result200({ pathname, contentType: "image/png", size: 2_345_464 });
    };

    const response = await servePublicMedia({
      request: new Request(`https://staging.anidachi.app/api/media/${pathname}`),
      path: pathname.split("/"),
      token: "test-token",
      getBlob,
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/png");
    assert.equal(response.headers.get("content-length"), "2345464");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("etag"), '"media-etag"');
    assert.deepEqual(calls, [
      {
        pathname,
        options: {
          access: "public",
          token: "test-token",
          ifNoneMatch: undefined,
        },
      },
    ]);
  });

  it("preserves the existing public video contract", async () => {
    const pathname = `openclaw/video/2026-08-18/${MEDIA_ID}.mp4`;
    const getBlob: PublicMediaBlobGet = async () =>
      result200({ pathname, contentType: "video/mp4", size: 4_093_154 });

    const response = await servePublicMedia({
      request: new Request(`https://staging.anidachi.app/api/media/${pathname}`),
      path: pathname.split("/"),
      token: "test-token",
      getBlob,
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "video/mp4");
  });

  it("rejects oversized or type-confused Blob metadata without serving the stream", async () => {
    const pathname = `blou/2026-08-18/${MEDIA_ID}.png`;
    for (const fixture of [
      { contentType: "image/png", size: MAX_PUBLIC_MEDIA_BYTES + 1 },
      { contentType: "text/html", size: 128 },
    ]) {
      let cancelled = false;
      const getBlob: PublicMediaBlobGet = async () =>
        result200({
          pathname,
          ...fixture,
          onCancel: () => {
            cancelled = true;
          },
        });

      const response = await servePublicMedia({
        request: new Request(`https://staging.anidachi.app/api/media/${pathname}`),
        path: pathname.split("/"),
        token: "test-token",
        getBlob,
      });

      assert.equal(response.status, 404);
      assert.equal(cancelled, true);
    }
  });

  it("forwards conditional GET and returns a bodyless 304", async () => {
    const pathname = `blou/tiktok-916/2026-08-18/${MEDIA_ID}.jpg`;
    const calls: unknown[] = [];
    const getBlob: PublicMediaBlobGet = async (_requestedPath, options) => {
      calls.push(options);
      return {
        statusCode: 304 as const,
        stream: null,
        blob: {
          pathname,
          contentType: null,
          size: null,
          etag: '"media-etag"',
          cacheControl: "public, max-age=2592000",
        },
      };
    };

    const response = await servePublicMedia({
      request: new Request(`https://staging.anidachi.app/api/media/${pathname}`, {
        headers: { "if-none-match": '"media-etag"' },
      }),
      path: pathname.split("/"),
      token: "test-token",
      getBlob,
    });

    assert.equal(response.status, 304);
    assert.equal(await response.text(), "");
    assert.deepEqual(calls, [
      {
        access: "public",
        token: "test-token",
        ifNoneMatch: '"media-etag"',
      },
    ]);
  });
});
