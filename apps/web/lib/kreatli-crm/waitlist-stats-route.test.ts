import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { GET } from "../../app/api/waitlist-stats/route";
import { readContacts } from "./store";

async function withCrmEnvironment(
  token: string | null,
  run: () => Promise<void>,
): Promise<void> {
  const previousToken = process.env.KREATLI_CRM_BLOB_READ_WRITE_TOKEN;
  const previousDataDir = process.env.CRM_DATA_DIR;
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "anidachi-crm-test-"));

  process.env.CRM_DATA_DIR = dataDir;
  if (token === null) {
    delete process.env.KREATLI_CRM_BLOB_READ_WRITE_TOKEN;
  } else {
    process.env.KREATLI_CRM_BLOB_READ_WRITE_TOKEN = token;
  }

  try {
    await run();
  } finally {
    if (previousToken === undefined) {
      delete process.env.KREATLI_CRM_BLOB_READ_WRITE_TOKEN;
    } else {
      process.env.KREATLI_CRM_BLOB_READ_WRITE_TOKEN = previousToken;
    }
    if (previousDataDir === undefined) {
      delete process.env.CRM_DATA_DIR;
    } else {
      process.env.CRM_DATA_DIR = previousDataDir;
    }
    await fs.rm(dataDir, { recursive: true, force: true });
  }
}

test("an empty authoritative CRM still returns a cacheable zero count", async () => {
  await withCrmEnvironment(null, async () => {
    const response = await GET();

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { count: 0 });
    assert.match(response.headers.get("cache-control") ?? "", /s-maxage=30/);
  });
});

test("Blob read failures are not converted into an empty contact list", async () => {
  await withCrmEnvironment("invalid-token", async () => {
    await assert.rejects(readContacts(), /Vercel Blob/);
  });
});

test("invalid contact data is not converted into an empty contact list", async () => {
  await withCrmEnvironment(null, async () => {
    const dataDir = process.env.CRM_DATA_DIR;
    assert.ok(dataDir);
    await fs.writeFile(
      path.join(dataDir, "contacts.json"),
      "not-json",
      "utf8",
    );

    await assert.rejects(readContacts(), /Invalid CRM contacts data/);
  });
});

test("waitlist stats failures return a non-cacheable service error", async (t) => {
  const errorLog = t.mock.method(console, "error", () => {});

  await withCrmEnvironment("invalid-token", async () => {
    const response = await GET();

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { count: null });
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    assert.equal(errorLog.mock.callCount(), 1);
  });
});

test("Vercel without CRM-specific durable storage fails closed", async (t) => {
  const previousVercel = process.env.VERCEL;
  const previousCrmToken = process.env.KREATLI_CRM_BLOB_READ_WRITE_TOKEN;
  const previousCrmStoreId = process.env.KREATLI_CRM_BLOB_STORE_ID;
  const previousPrivateToken =
    process.env.PRIVATE_INTEGRATION_BLOB_READ_WRITE_TOKEN;
  const errorLog = t.mock.method(console, "error", () => {});

  process.env.VERCEL = "1";
  delete process.env.KREATLI_CRM_BLOB_READ_WRITE_TOKEN;
  delete process.env.KREATLI_CRM_BLOB_STORE_ID;
  delete process.env.PRIVATE_INTEGRATION_BLOB_READ_WRITE_TOKEN;

  try {
    await assert.rejects(
      readContacts(),
      /CRM durable storage is not configured on Vercel/,
    );

    const response = await GET();
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { count: null });
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    assert.equal(errorLog.mock.callCount(), 1);
  } finally {
    if (previousVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previousVercel;
    if (previousCrmToken === undefined) {
      delete process.env.KREATLI_CRM_BLOB_READ_WRITE_TOKEN;
    } else {
      process.env.KREATLI_CRM_BLOB_READ_WRITE_TOKEN = previousCrmToken;
    }
    if (previousCrmStoreId === undefined) {
      delete process.env.KREATLI_CRM_BLOB_STORE_ID;
    } else {
      process.env.KREATLI_CRM_BLOB_STORE_ID = previousCrmStoreId;
    }
    if (previousPrivateToken === undefined) {
      delete process.env.PRIVATE_INTEGRATION_BLOB_READ_WRITE_TOKEN;
    } else {
      process.env.PRIVATE_INTEGRATION_BLOB_READ_WRITE_TOKEN =
        previousPrivateToken;
    }
  }
});
