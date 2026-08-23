import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { mutateContacts, readContacts } from "./store";
import type { Contact } from "./types";

function contact(id: string, email: string): Contact {
  return {
    id,
    email,
    company: "",
    first_name: "",
    segments: [],
    notes: "",
    status: "active",
    next_action_date: null,
    created_at: "2026-08-23T00:00:00.000Z",
    updated_at: "2026-08-23T00:00:00.000Z",
  };
}

test("concurrent contact mutations preserve both unique contacts", async () => {
  const dataDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "anidachi-crm-mutation-test-"),
  );
  const previousDataDir = process.env.CRM_DATA_DIR;
  const previousVercel = process.env.VERCEL;
  const previousToken = process.env.KREATLI_CRM_BLOB_READ_WRITE_TOKEN;
  const previousStoreId = process.env.KREATLI_CRM_BLOB_STORE_ID;

  process.env.CRM_DATA_DIR = dataDir;
  delete process.env.VERCEL;
  delete process.env.KREATLI_CRM_BLOB_READ_WRITE_TOKEN;
  delete process.env.KREATLI_CRM_BLOB_STORE_ID;

  try {
    await Promise.all([
      mutateContacts((contacts) => {
        contacts.push(contact("first", "first@example.com"));
        return { changed: true, value: "first" };
      }),
      mutateContacts((contacts) => {
        contacts.push(contact("second", "second@example.com"));
        return { changed: true, value: "second" };
      }),
    ]);

    const persisted = await readContacts();
    assert.deepEqual(
      persisted.map(({ id }) => id).sort(),
      ["first", "second"],
    );
  } finally {
    if (previousDataDir === undefined) delete process.env.CRM_DATA_DIR;
    else process.env.CRM_DATA_DIR = previousDataDir;
    if (previousVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previousVercel;
    if (previousToken === undefined) {
      delete process.env.KREATLI_CRM_BLOB_READ_WRITE_TOKEN;
    } else {
      process.env.KREATLI_CRM_BLOB_READ_WRITE_TOKEN = previousToken;
    }
    if (previousStoreId === undefined) {
      delete process.env.KREATLI_CRM_BLOB_STORE_ID;
    } else {
      process.env.KREATLI_CRM_BLOB_STORE_ID = previousStoreId;
    }
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});
