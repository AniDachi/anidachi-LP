import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BlobPreconditionFailedError } from "@vercel/blob";
import {
  KREATLI_CRM_RECONCILIATION_PATHS,
  mergeKreatliCrmObject,
  reconcileKreatliCrmBlobs,
  type KreatliCrmReconciliationSdk,
} from "./blob-reconciliation";
import type { Contact } from "./types";

const CONTACTS = "kreatli-crm/contacts.json";
const MESSAGES = "kreatli-crm/contact-messages.jsonl";

function contact(id: string, email: string, segments: string[] = []): Contact {
  return {
    id,
    email,
    company: "",
    first_name: id,
    segments,
    notes: "",
    status: "active",
    next_action_date: null,
    created_at: `2026-08-23T00:00:0${id.length}.000Z`,
    updated_at: `2026-08-23T00:00:0${id.length}.000Z`,
  };
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function stream(value: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(value));
      controller.close();
    },
  });
}

function readResult(pathname: string, value: string, etag: string) {
  return {
    statusCode: 200 as const,
    stream: stream(value),
    blob: { pathname, etag, size: Buffer.byteLength(value) },
  };
}

describe("Kreatli CRM object reconciliation", () => {
  it("preserves public order, a strict private subset, and destination-only contacts", () => {
    const first = contact("first", "FIRST@example.com", ["survey_lead"]);
    const second = contact("second", "second@example.com", ["survey_lead"]);
    const privateOnly = contact("private", "private@example.com");

    const merged = mergeKreatliCrmObject(
      CONTACTS,
      json([first, second]),
      json([first, privateOnly]),
    );

    assert.deepEqual(JSON.parse(merged.text), [first, second, privateOnly]);
    assert.equal(merged.records, 3);
    assert.equal(merged.surveyLeads, 2);
  });

  it("rejects duplicate UUIDs, duplicate normalized emails, and divergent common identities", () => {
    const first = contact("first", "same@example.com");
    const changed = { ...first, notes: "different" };

    assert.throws(
      () => mergeKreatliCrmObject(CONTACTS, json([first, first]), "[]"),
      /duplicate contact id/i,
    );
    assert.throws(
      () =>
        mergeKreatliCrmObject(
          CONTACTS,
          json([first, contact("second", "SAME@example.com")]),
          "[]",
        ),
      /duplicate contact email/i,
    );
    assert.throws(
      () => mergeKreatliCrmObject(CONTACTS, json([first]), json([changed])),
      /divergent contact identity/i,
    );
    assert.throws(
      () =>
        mergeKreatliCrmObject(
          CONTACTS,
          json([first]),
          json([contact("other-id", "same@example.com")]),
        ),
      /divergent contact identity/i,
    );
  });

  it("rejects malformed contacts instead of silently dropping them", () => {
    assert.throws(
      () => mergeKreatliCrmObject(CONTACTS, "not-json", "[]"),
      /invalid contacts json/i,
    );
    assert.throws(
      () => mergeKreatliCrmObject(CONTACTS, json([{ id: "missing-email" }]), "[]"),
      /invalid contact/i,
    );
  });

  it("unions JSONL by id and rejects a divergent common record", () => {
    const first = { id: "first", value: 1 };
    const second = { id: "second", value: 2 };
    const privateOnly = { id: "private", value: 3 };
    const merged = mergeKreatliCrmObject(
      MESSAGES,
      `${JSON.stringify(first)}\n${JSON.stringify(second)}\n`,
      `${JSON.stringify(first)}\n${JSON.stringify(privateOnly)}\n`,
    );

    assert.deepEqual(
      merged.text.trim().split("\n").map((line) => JSON.parse(line)),
      [first, second, privateOnly],
    );
    assert.equal(merged.records, 3);
    assert.throws(
      () =>
        mergeKreatliCrmObject(
          MESSAGES,
          `${JSON.stringify(first)}\n`,
          `${JSON.stringify({ ...first, value: 9 })}\n`,
        ),
      /divergent jsonl identity/i,
    );
    assert.throws(
      () =>
        mergeKreatliCrmObject(
          MESSAGES,
          `${JSON.stringify(first)}\n${JSON.stringify(first)}\n`,
          "",
        ),
      /duplicate jsonl id/i,
    );
    assert.throws(
      () => mergeKreatliCrmObject(MESSAGES, "not-json\n", ""),
      /invalid jsonl source line/i,
    );
  });

  it("preserves destination JSONL bytes when the logical records are unchanged", () => {
    const first = { id: "first", value: 1 };
    const second = { id: "second", value: 2 };
    const existing = `${JSON.stringify(first)}\r\n${JSON.stringify(second)}\r\n`;

    const merged = mergeKreatliCrmObject(MESSAGES, existing, existing);

    assert.equal(merged.text, existing);
    assert.equal(merged.records, 2);
  });

  it("merges metadata without moving the durable timestamp backwards", () => {
    const merged = mergeKreatliCrmObject(
      "kreatli-crm/meta.json",
      json({ schema_version: 1, updated_at: "2026-08-23T02:00:00.000Z" }),
      json({ schema_version: 2, updated_at: "2026-08-23T01:00:00.000Z" }),
    );
    assert.deepEqual(JSON.parse(merged.text), {
      schema_version: 2,
      updated_at: "2026-08-23T02:00:00.000Z",
    });
  });
});

describe("Kreatli CRM Blob reconciliation runner", () => {
  it("dry-runs the exact five CRM objects, excludes Gmail tokens, and writes nothing", async () => {
    const source = new Map<string, string>();
    const destination = new Map<string, string>();
    for (const pathname of KREATLI_CRM_RECONCILIATION_PATHS) {
      const value = pathname === CONTACTS
        ? "[]"
        : pathname.endsWith(".jsonl")
          ? ""
          : json({ schema_version: 1, updated_at: null });
      source.set(pathname, value);
      destination.set(pathname, value);
    }
    const heads: string[] = [];
    let puts = 0;
    const sdk: KreatliCrmReconciliationSdk = {
      head: async (pathname) => {
        heads.push(pathname);
        return source.has(pathname)
          ? {
              pathname,
              url: `https://legacy.public.blob.vercel-storage.com/${pathname}`,
              etag: `"source-${pathname}"`,
            }
          : null;
      },
      get: async (target, options) => {
        const pathname = target.startsWith("https:")
          ? new URL(target).pathname.slice(1)
          : target;
        const value = options.access === "public"
          ? source.get(pathname)
          : destination.get(pathname);
        return value === undefined
          ? null
          : readResult(
              pathname,
              value,
              options.access === "public"
                ? `"source-${pathname}"`
                : `"destination-${pathname}"`,
            );
      },
      put: async () => {
        puts += 1;
        return { pathname: "unexpected" };
      },
    };

    const result = await reconcileKreatliCrmBlobs({
      mode: "dry-run",
      sourceAuth: { token: "source-token" },
      destinationAuth: { token: "destination-token" },
      sdk,
      log: () => undefined,
    });

    assert.equal(heads.includes("kreatli-crm/gmail-tokens.json"), false);
    assert.deepEqual(heads, [...KREATLI_CRM_RECONCILIATION_PATHS]);
    assert.equal(puts, 0);
    assert.equal(result.conflicts, 0);
    assert.equal(result.objects.length, 5);
  });

  it("uses the observed destination ETag and verifies the post-write digest", async () => {
    const publicContact = contact("public", "public@example.com", ["survey_lead"]);
    const source = json([publicContact]);
    let destination = "[]";
    const putOptions: unknown[] = [];
    const sdk: KreatliCrmReconciliationSdk = {
      head: async (pathname) => ({
        pathname,
        url: `https://legacy.public.blob.vercel-storage.com/${pathname}`,
        etag: '"source"',
      }),
      get: async (target, options) => {
        const pathname = target.startsWith("https:")
          ? new URL(target).pathname.slice(1)
          : target;
        const value = pathname === CONTACTS
          ? options.access === "public"
            ? source
            : destination
          : pathname.endsWith(".jsonl")
            ? ""
            : json({ schema_version: 1, updated_at: null });
        return readResult(
          pathname,
          value,
          options.access === "public" ? '"source"' : '"destination"',
        );
      },
      put: async (pathname, body, options) => {
        putOptions.push(options);
        destination = typeof body === "string" ? body : await new Response(body).text();
        return { pathname };
      },
    };

    const result = await reconcileKreatliCrmBlobs({
      mode: "apply",
      sourceAuth: { token: "source-token" },
      destinationAuth: { token: "destination-token" },
      sdk,
      log: () => undefined,
    });

    assert.deepEqual(JSON.parse(destination), [publicContact]);
    assert.equal(
      (putOptions[0] as { ifMatch?: string }).ifMatch,
      '"destination"',
    );
    assert.equal(result.written, 1);
    assert.equal(result.verified, 5);
  });

  it("stops on source ETag drift and post-write digest mismatch", async () => {
    const baseSdk = (badVerification: boolean): KreatliCrmReconciliationSdk => {
      let wrote = false;
      return {
        head: async (pathname) => ({
          pathname,
          url: `https://legacy.public.blob.vercel-storage.com/${pathname}`,
          etag: '"head"',
        }),
        get: async (target, options) => {
          const pathname = target.startsWith("https:")
            ? new URL(target).pathname.slice(1)
            : target;
          if (options.access === "public") {
            return readResult(
              pathname,
              pathname === CONTACTS
                ? json([contact("source", "source@example.com")])
                : pathname.endsWith(".jsonl")
                  ? ""
                  : json({ schema_version: 1, updated_at: null }),
              '"body"',
            );
          }
          const value = pathname === CONTACTS && wrote && badVerification
            ? json([contact("corrupt", "corrupt@example.com")])
            : pathname === CONTACTS
              ? json([contact("private", "private@example.com")])
              : pathname.endsWith(".jsonl")
                ? ""
                : json({ schema_version: 1, updated_at: null });
          return readResult(pathname, value, '"destination"');
        },
        put: async (pathname) => {
          wrote = true;
          return { pathname };
        },
      };
    };

    await assert.rejects(
      reconcileKreatliCrmBlobs({
        mode: "apply",
        sourceAuth: { token: "source" },
        destinationAuth: { token: "destination" },
        sdk: baseSdk(false),
        log: () => undefined,
      }),
      /source changed during reconciliation/i,
    );

    const verifyingSdk = baseSdk(true);
    verifyingSdk.head = async (pathname) => ({
      pathname,
      url: `https://legacy.public.blob.vercel-storage.com/${pathname}`,
      etag: '"body"',
    });
    await assert.rejects(
      reconcileKreatliCrmBlobs({
        mode: "apply",
        sourceAuth: { token: "source" },
        destinationAuth: { token: "destination" },
        sdk: verifyingSdk,
        log: () => undefined,
      }),
      /verification failed/i,
    );
  });

  it("propagates a destination ETag conflict without retrying a stale merge", async () => {
    let observedIfMatch: string | undefined;
    const sdk: KreatliCrmReconciliationSdk = {
      head: async (pathname) => ({
        pathname,
        url: `https://legacy.public.blob.vercel-storage.com/${pathname}`,
        etag: '"source"',
      }),
      get: async (target, options) => {
        const pathname = target.startsWith("https:")
          ? new URL(target).pathname.slice(1)
          : target;
        const value = pathname === CONTACTS
          ? options.access === "public"
            ? json([contact("source", "source@example.com")])
            : "[]"
          : pathname.endsWith(".jsonl")
            ? ""
            : json({ schema_version: 1, updated_at: null });
        return readResult(
          pathname,
          value,
          options.access === "public" ? '"source"' : '"destination"',
        );
      },
      put: async (_pathname, _body, options) => {
        observedIfMatch = options.ifMatch;
        throw new BlobPreconditionFailedError();
      },
    };

    await assert.rejects(
      reconcileKreatliCrmBlobs({
        mode: "apply",
        sourceAuth: { token: "source" },
        destinationAuth: { token: "destination" },
        sdk,
        log: () => undefined,
      }),
      BlobPreconditionFailedError,
    );
    assert.equal(observedIfMatch, '"destination"');
  });
});
