/**
 * YouTube credentials storage — supports multiple channels.
 *
 * Uses the same Vercel Blob / local-file pattern as Instagram and TikTok storage.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import {
  get as blobGet,
  put as blobPut,
  list as blobList,
  del as blobDel,
} from "@vercel/blob";

const CREDENTIALS_FILE = ".data/youtube-credentials.json";
export const YOUTUBE_CREDENTIALS_BLOB_PATH = "youtube/credentials.json";
const BLOB_PATH = YOUTUBE_CREDENTIALS_BLOB_PATH;

const BLOB_ACCESS = (process.env.BLOB_ACCESS ?? "private") as
  | "public"
  | "private";

export interface YouTubeCredentials {
  channelId: string;
  channelTitle: string;
  refreshToken: string;
  accessToken: string;
  tokenExpiry: number; // Unix timestamp (ms)
  thumbnailUrl?: string;
}

// ---------------------------------------------------------------------------
// Blob helpers
// ---------------------------------------------------------------------------

async function getAllFromBlob(): Promise<YouTubeCredentials[]> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return [];

  try {
    const result = await blobGet(BLOB_PATH, { access: BLOB_ACCESS, token });
    if (!result || result.statusCode !== 200) return [];

    const text = await new Response(result.stream).text();
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      if (parsed.refreshToken && parsed.channelId) return [parsed];
      return [];
    }
    return parsed.filter(
      (c: YouTubeCredentials) => c.refreshToken && c.channelId,
    );
  } catch {
    return [];
  }
}

async function saveAllToBlob(accounts: YouTubeCredentials[]): Promise<void> {
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

async function getAllFromFile(): Promise<YouTubeCredentials[]> {
  try {
    const data = await readFile(credentialsPath(), "utf-8");
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) {
      if (parsed.refreshToken && parsed.channelId) return [parsed];
      return [];
    }
    return parsed.filter(
      (c: YouTubeCredentials) => c.refreshToken && c.channelId,
    );
  } catch {
    return [];
  }
}

async function saveAllToFile(accounts: YouTubeCredentials[]): Promise<void> {
  const dir = join(process.cwd(), ".data");
  await mkdir(dir, { recursive: true });
  await writeFile(credentialsPath(), JSON.stringify(accounts, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getAllCredentials(): Promise<YouTubeCredentials[]> {
  const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
  return useBlob ? await getAllFromBlob() : await getAllFromFile();
}

export async function getCredentials(): Promise<YouTubeCredentials | null> {
  const all = await getAllCredentials();
  return all[0] ?? null;
}

export async function getCredentialsByChannelId(
  channelId: string,
): Promise<YouTubeCredentials | null> {
  const all = await getAllCredentials();
  return all.find((c) => c.channelId === channelId) ?? null;
}

export async function setCredentials(
  creds: YouTubeCredentials,
): Promise<void> {
  const all = await getAllCredentials();
  const idx = all.findIndex((c) => c.channelId === creds.channelId);
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

export async function clearCredentials(channelId?: string): Promise<void> {
  if (!channelId) {
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
  const filtered = all.filter((c) => c.channelId !== channelId);

  if (filtered.length === 0) {
    await clearCredentials();
  } else if (process.env.BLOB_READ_WRITE_TOKEN) {
    await saveAllToBlob(filtered);
  } else {
    await saveAllToFile(filtered);
  }
}
