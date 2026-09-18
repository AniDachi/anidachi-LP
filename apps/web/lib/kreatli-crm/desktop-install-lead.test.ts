import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, mock, test } from "node:test";
import { DESKTOP_INSTALL_LINK_SEGMENT, upsertDesktopInstallLead } from "./desktop-install-lead";
import { readContacts } from "./store";
import type { Contact } from "./types";

// Exercise the real helper, CRM store, CAS loop and installed Blob SDK. Only
// its HTTP transport is replaced; no CRM object or email leaves this process.
const require = createRequire(import.meta.url);
const transport = createRequire(require.resolve("@vercel/blob"))("undici") as { fetch: typeof fetch };
const envKeys = ["KREATLI_CRM_BLOB_READ_WRITE_TOKEN", "KREATLI_CRM_BLOB_STORE_ID", "CRM_DATA_DIR", "VERCEL"] as const;
const originalEnv = new Map(envKeys.map((key) => [key, process.env[key]]));
const contactsPath = "kreatli-crm/contacts.json";
const metaPath = "kreatli-crm/meta.json";
let temporaryDirectory: string | undefined;

beforeEach(() => {
  process.env.KREATLI_CRM_BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_fixture_test_only";
  delete process.env.KREATLI_CRM_BLOB_STORE_ID;
  mock.method(globalThis, "fetch", async () => { throw new TypeError("Unexpected network call"); });
});

afterEach(async () => {
  mock.restoreAll();
  for (const key of envKeys) {
    const original = originalEnv.get(key);
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
  if (temporaryDirectory) await fs.rm(temporaryDirectory, { recursive: true, force: true });
  temporaryDirectory = undefined;
});

function contact(email = "existing@example.com"): Contact {
  return {
    id: "existing", email, first_name: "Existing", company: "Example",
    segments: ["existing-segment"], notes: "Original note", status: "active",
    next_action_date: "2026-10-01", created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
  };
}

function blobFixture(options: { contacts?: Contact[]; synchronizeFirstReads?: boolean } = {}) {
  const state = {
    contacts: options.contacts ?? [], revision: 1, reads: 0, writes: [] as Contact[][],
    beforeFirstWrite: undefined as (() => void) | undefined,
    readFailure: false, missing: false, writeFailure: false, alwaysConflict: false,
    rawContacts: undefined as string | undefined,
  };
  let releaseReads!: () => void;
  const bothRead = new Promise<void>((resolve) => { releaseReads = resolve; });
  mock.method(transport, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const pathname = url.searchParams.get("pathname") ?? url.pathname.slice(1);
    if (![contactsPath, metaPath].includes(pathname)) throw new TypeError("Unexpected Blob path");
    if (init?.method === "GET") {
      if (pathname === metaPath) return new Response("{}", { headers: { etag: '"meta"' } });
      state.reads += 1;
      if (state.readFailure) return new Response("Unavailable", { status: 403 });
      if (state.missing) return new Response(null, { status: 404 });
      assert.equal(url.searchParams.get("cache"), "0");
      const response = new Response(state.rawContacts ?? JSON.stringify(state.contacts), {
        headers: { etag: `"v${state.revision}"` },
      });
      if (options.synchronizeFirstReads && state.reads <= 2) {
        if (state.reads === 2) releaseReads();
        await bothRead;
      }
      return response;
    }
    if (init?.method !== "PUT") throw new TypeError("Unexpected Blob method");
    if (pathname === contactsPath) {
      const candidate = JSON.parse(String(init.body)) as Contact[];
      state.writes.push(candidate);
      if (state.writes.length === 1) state.beforeFirstWrite?.();
      if (state.writeFailure) return Response.json({ error: { code: "forbidden" } }, { status: 403 });
      if (state.alwaysConflict || new Headers(init.headers).get("x-if-match") !== `"v${state.revision}"`) {
        return Response.json({ error: { code: "precondition_failed" } }, { status: 412 });
      }
      state.contacts = candidate;
      state.revision += 1;
    }
    return Response.json({ pathname, url: `https://fixture.private.blob.vercel-storage.com/${pathname}` });
  });
  return state;
}

test("concurrent install requests preserve both contacts through real CAS retries", async () => {
  const state = blobFixture({ synchronizeFirstReads: true });
  const outcomes = await Promise.all([
    upsertDesktopInstallLead("first@example.com"),
    upsertDesktopInstallLead("second@example.com"),
  ]);
  assert.deepEqual(outcomes, [{ saved: true }, { saved: true }]);
  assert.deepEqual(state.contacts.map(({ email }) => email).sort(), ["first@example.com", "second@example.com"]);
  assert.ok(state.writes.length >= 3, "one writer must reapply after the ETag conflict");
});

test("concurrent requests for the same normalized email keep one contact and both notes", async () => {
  const state = blobFixture({ synchronizeFirstReads: true });
  await Promise.all([
    upsertDesktopInstallLead(" Same@Example.com "),
    upsertDesktopInstallLead("same@example.com"),
  ]);
  assert.equal(state.contacts.length, 1);
  const saved = state.contacts[0]!;
  assert.equal(saved.email, "same@example.com");
  assert.deepEqual(saved.segments, [DESKTOP_INSTALL_LINK_SEGMENT]);
  assert.equal(saved.notes.match(/Requested desktop install link\./g)?.length, 2);
});

test("retry preserves a concurrent edit, do-not-contact status and existing fields", async () => {
  const original = contact();
  const state = blobFixture({ contacts: [original] });
  state.beforeFirstWrite = () => {
    state.contacts = [{ ...original, notes: "Edited by another request", status: "dnc", segments: ["new-segment"] }];
    state.revision += 1;
  };
  assert.deepEqual(await upsertDesktopInstallLead("EXISTING@example.com"), { saved: true });
  const saved = state.contacts[0]!;
  assert.equal(saved.status, "dnc");
  assert.deepEqual(saved.segments, ["new-segment", DESKTOP_INSTALL_LINK_SEGMENT]);
  assert.match(saved.notes, /^Edited by another request\n\n---\nRequested desktop install link\./);
  assert.equal(saved.notes.match(/Requested desktop install link\./g)?.length, 1);
  for (const key of ["id", "email", "first_name", "company", "created_at", "next_action_date"] as const) {
    assert.equal(saved[key], original[key], key);
  }
});

test("a replayed create keeps its ID and timestamp and includes the other writer's contact", async () => {
  const state = blobFixture();
  state.beforeFirstWrite = () => {
    state.contacts = [contact("other@example.com")];
    state.revision += 1;
  };
  assert.deepEqual(await upsertDesktopInstallLead("new@example.com"), { saved: true });
  assert.equal(state.writes.length, 2);
  const first = state.writes[0]!.find(({ email }) => email === "new@example.com")!;
  const last = state.writes[1]!.find(({ email }) => email === "new@example.com")!;
  assert.deepEqual(last, first);
  assert.equal(state.contacts.length, 2);
});

test("invalid email never touches storage", async () => {
  const state = blobFixture();
  assert.deepEqual(await upsertDesktopInstallLead("not-an-address"), { saved: false, reason: "invalid_email" });
  assert.equal(state.reads, 0);
  assert.equal(state.writes.length, 0);
});

for (const failure of ["read", "missing", "parse", "write", "conflict"] as const) {
  test(`${failure} failure returns a controlled result without changing contacts`, async () => {
    const state = blobFixture({ contacts: [contact()] });
    const errorLog = mock.method(console, "error", () => {});
    if (failure === "read") state.readFailure = true;
    if (failure === "missing") state.missing = true;
    if (failure === "parse") state.rawContacts = "corrupt";
    if (failure === "write") state.writeFailure = true;
    if (failure === "conflict") state.alwaysConflict = true;
    assert.deepEqual(await upsertDesktopInstallLead("new@example.com"), { saved: false, reason: "storage_failed" });
    assert.deepEqual(state.contacts, [contact()]);
    assert.equal(errorLog.mock.callCount(), 0, "storage errors may contain private values");
    if (["read", "missing", "parse"].includes(failure)) assert.equal(state.writes.length, 0);
    if (failure === "conflict") assert.equal(state.writes.length, 4);
  });
}

test("local development uses the shared serialized mutation path", async () => {
  blobFixture(); // Block accidental Blob transport even in a local test.
  delete process.env.KREATLI_CRM_BLOB_READ_WRITE_TOKEN;
  delete process.env.VERCEL;
  temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "anidachi-install-contact-"));
  process.env.CRM_DATA_DIR = temporaryDirectory;
  await Promise.all([
    upsertDesktopInstallLead("first@example.com"),
    upsertDesktopInstallLead("second@example.com"),
  ]);
  assert.deepEqual((await readContacts()).map(({ email }) => email).sort(), ["first@example.com", "second@example.com"]);
});
