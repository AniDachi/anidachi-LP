/**
 * Instagram credentials storage — supports multiple accounts.
 *
 * - In production (e.g. Vercel), uses Vercel Blob via BLOB_READ_WRITE_TOKEN.
 *   Set BLOB_ACCESS=public when using a public Blob store; omit or set "private" for a private store.
 * - In local dev (or when no Blob token), falls back to a JSON file in .data/.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import {
  get as blobGet,
  put as blobPut,
  list as blobList,
  del as blobDel,
} from "@vercel/blob";

const CREDENTIALS_FILE = ".data/instagram-credentials.json";
const BLOB_PATH = "instagram/credentials.json";

const BLOB_ACCESS = (process.env.BLOB_ACCESS ?? "private") as
  | "public"
  | "private";

export interface InstagramCredentials {
  accessToken: string;
  tokenExpiry: number; // Unix timestamp (ms)
  igUserId: string;
  igUsername: string;
}

// ---------------------------------------------------------------------------
// Blob helpers
// ---------------------------------------------------------------------------

async function getAllFromBlob(): Promise<InstagramCredentials[]> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return [];

  try {
    const result = await blobGet(BLOB_PATH, { access: BLOB_ACCESS, token });
    if (!result || result.statusCode !== 200) return [];

    const text = await new Response(result.stream).text();
    const parsed = JSON.parse(text);

    // Migrate: if the stored data is a single object (old format), wrap it
    if (!Array.isArray(parsed)) {
      if (parsed.accessToken && parsed.igUserId) return [parsed];
      return [];
    }
    return parsed.filter(
      (c: InstagramCredentials) => c.accessToken && c.igUserId,
    );
  } catch {
    return [];
  }
}

async function saveAllToBlob(accounts: InstagramCredentials[]): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return;

  await blobPut(BLOB_PATH, JSON.stringify(accounts, null, 2), {
    access: BLOB_ACCESS,
    token,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

async function clearBlob(): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return;

  const { blobs } = await blobList({ prefix: BLOB_PATH, token });
  if (!blobs.length) return;

  await blobDel(
    blobs.map((b) => b.url),
    { token },
  );
}

// ---------------------------------------------------------------------------
// Local filesystem helpers
// ---------------------------------------------------------------------------

function credentialsPath(): string {
  return join(process.cwd(), CREDENTIALS_FILE);
}

async function getAllFromFile(): Promise<InstagramCredentials[]> {
  try {
    const data = await readFile(credentialsPath(), "utf-8");
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      if (parsed.accessToken && parsed.igUserId) return [parsed];
      return [];
    }
    return parsed.filter(
      (c: InstagramCredentials) => c.accessToken && c.igUserId,
    );
  } catch {
    return [];
  }
}

async function saveAllToFile(accounts: InstagramCredentials[]): Promise<void> {
  const dir = join(process.cwd(), ".data");
  await mkdir(dir, { recursive: true });
  await writeFile(
    credentialsPath(),
    JSON.stringify(accounts, null, 2),
    "utf-8",
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Get all connected Instagram accounts. Filters out expired tokens. */
export async function getAllCredentials(): Promise<InstagramCredentials[]> {
  const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
  const accounts = useBlob ? await getAllFromBlob() : await getAllFromFile();
  const now = Date.now();
  return accounts.filter((c) => !c.tokenExpiry || now < c.tokenExpiry);
}

/** Get the first connected account (backwards-compat convenience). */
export async function getCredentials(): Promise<InstagramCredentials | null> {
  const all = await getAllCredentials();
  return all[0] ?? null;
}

/** Get credentials for a specific account by igUserId. */
export async function getCredentialsById(
  igUserId: string,
): Promise<InstagramCredentials | null> {
  const all = await getAllCredentials();
  return all.find((c) => c.igUserId === igUserId) ?? null;
}

/** Upsert credentials — adds a new account or updates an existing one. */
export async function setCredentials(
  creds: InstagramCredentials,
): Promise<void> {
  const all = await getAllCredentials();
  const idx = all.findIndex((c) => c.igUserId === creds.igUserId);
  if (idx >= 0) {
    all[idx] = creds;
  } else {
    all.push(creds);
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    await saveAllToBlob(all);
  } else {
    await saveAllToFile(all);
  }
}

/** Remove one account's credentials. */
export async function clearCredentials(igUserId?: string): Promise<void> {
  if (!igUserId) {
    // Clear all (backwards-compat)
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      await clearBlob();
    } else {
      try {
        const { unlink } = await import("fs/promises");
        await unlink(credentialsPath());
      } catch {
        /* ignore */
      }
    }
    return;
  }

  const all = await getAllCredentials();
  const filtered = all.filter((c) => c.igUserId !== igUserId);

  if (filtered.length === 0) {
    await clearCredentials(); // delete the file/blob entirely
  } else if (process.env.BLOB_READ_WRITE_TOKEN) {
    await saveAllToBlob(filtered);
  } else {
    await saveAllToFile(filtered);
  }
}

/** Remove all accounts. */
export async function clearAllCredentials(): Promise<void> {
  await clearCredentials();
}
