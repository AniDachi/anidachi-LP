/**
 * TikTok credentials storage — supports multiple accounts.
 *
 * Uses the same Vercel Blob / local-file pattern as Instagram storage.
 * TikTok access tokens expire every 24 hours; refresh tokens last 365 days.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import {
  get as blobGet,
  put as blobPut,
  list as blobList,
  del as blobDel,
} from "@vercel/blob";

const CREDENTIALS_FILE = ".data/tiktok-credentials.json";
const BLOB_PATH = "tiktok/credentials.json";

const BLOB_ACCESS = (process.env.BLOB_ACCESS ?? "private") as
  | "public"
  | "private";

export interface TikTokCredentials {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: number;  // Unix timestamp (ms)
  refreshTokenExpiry: number; // Unix timestamp (ms)
  openId: string;
  username: string;
  avatarUrl?: string;
}

// ---------------------------------------------------------------------------
// Blob helpers
// ---------------------------------------------------------------------------

async function getAllFromBlob(): Promise<TikTokCredentials[]> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return [];

  try {
    const result = await blobGet(BLOB_PATH, { access: BLOB_ACCESS, token });
    if (!result || result.statusCode !== 200) return [];

    const text = await new Response(result.stream).text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      if (parsed.accessToken && parsed.openId) return [parsed];
      return [];
    }
    return parsed.filter(
      (c: TikTokCredentials) => c.accessToken && c.openId,
    );
  } catch {
    return [];
  }
}

async function saveAllToBlob(accounts: TikTokCredentials[]): Promise<void> {
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

async function getAllFromFile(): Promise<TikTokCredentials[]> {
  try {
    const data = await readFile(credentialsPath(), "utf-8");
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      if (parsed.accessToken && parsed.openId) return [parsed];
      return [];
    }
    return parsed.filter(
      (c: TikTokCredentials) => c.accessToken && c.openId,
    );
  } catch {
    return [];
  }
}

async function saveAllToFile(accounts: TikTokCredentials[]): Promise<void> {
  const dir = join(process.cwd(), ".data");
  await mkdir(dir, { recursive: true });
  await writeFile(credentialsPath(), JSON.stringify(accounts, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Get all connected TikTok accounts. Filters out accounts with expired refresh tokens. */
export async function getAllCredentials(): Promise<TikTokCredentials[]> {
  const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
  const accounts = useBlob ? await getAllFromBlob() : await getAllFromFile();
  const now = Date.now();
  return accounts.filter((c) => !c.refreshTokenExpiry || now < c.refreshTokenExpiry);
}

/** Get the first connected account. */
export async function getCredentials(): Promise<TikTokCredentials | null> {
  const all = await getAllCredentials();
  return all[0] ?? null;
}

/** Get credentials for a specific account by openId. */
export async function getCredentialsById(
  openId: string,
): Promise<TikTokCredentials | null> {
  const all = await getAllCredentials();
  return all.find((c) => c.openId === openId) ?? null;
}

/** Upsert credentials — adds a new account or updates an existing one. */
export async function setCredentials(
  creds: TikTokCredentials,
): Promise<void> {
  const all = await getAllCredentials();
  const idx = all.findIndex((c) => c.openId === creds.openId);
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

/** Remove one account's credentials, or all if no openId given. */
export async function clearCredentials(openId?: string): Promise<void> {
  if (!openId) {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      await clearBlob();
    } else {
      try {
        const { unlink } = await import("fs/promises");
        await unlink(credentialsPath());
      } catch { /* ignore */ }
    }
    return;
  }

  const all = await getAllCredentials();
  const filtered = all.filter((c) => c.openId !== openId);

  if (filtered.length === 0) {
    await clearCredentials();
  } else if (process.env.BLOB_READ_WRITE_TOKEN) {
    await saveAllToBlob(filtered);
  } else {
    await saveAllToFile(filtered);
  }
}
