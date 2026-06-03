import fs from "fs/promises";
import path from "path";
import { get as blobGet, put as blobPut, list as blobList, del as blobDel } from "@vercel/blob";
import { getCrmDataDir } from "./store";

export type GmailStoredTokens = {
  refresh_token?: string;
  access_token?: string;
  expiry_date?: number;
  /** Filled after OAuth + profile fetch */
  email?: string;
};

const BLOB_PATH = "kreatli-crm/gmail-tokens.json";
const BLOB_ACCESS = (process.env.BLOB_ACCESS ?? "private") as "public" | "private";

function tokenPath() {
  return path.join(getCrmDataDir(), "gmail-tokens.json");
}

export async function readGmailTokens(): Promise<GmailStoredTokens | null> {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (blobToken) {
    try {
      const result = await blobGet(BLOB_PATH, { access: BLOB_ACCESS, token: blobToken });
      if (!result || result.statusCode !== 200) return null;
      const text = await new Response(result.stream).text();
      return JSON.parse(text) as GmailStoredTokens;
    } catch {
      return null;
    }
  }

  try {
    const raw = await fs.readFile(tokenPath(), "utf8");
    return JSON.parse(raw) as GmailStoredTokens;
  } catch {
    return null;
  }
}

export async function writeGmailTokens(data: GmailStoredTokens): Promise<void> {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (blobToken) {
    await blobPut(BLOB_PATH, JSON.stringify(data, null, 2), {
      access: BLOB_ACCESS,
      token: blobToken,
      addRandomSuffix: false,
      allowOverwrite: true,
    });
    return;
  }

  // Local dev fallback
  const dir = getCrmDataDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(tokenPath(), JSON.stringify(data, null, 2), "utf8");
}

export async function mergeGmailTokens(partial: GmailStoredTokens): Promise<GmailStoredTokens> {
  const cur = (await readGmailTokens()) ?? {};
  const next: GmailStoredTokens = {
    ...cur,
    ...partial,
    refresh_token: partial.refresh_token ?? cur.refresh_token,
  };
  await writeGmailTokens(next);
  return next;
}

export async function clearGmailTokens(): Promise<void> {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (blobToken) {
    try {
      const { blobs } = await blobList({ prefix: BLOB_PATH, token: blobToken });
      if (!blobs.length) return;
      await blobDel(blobs.map((b) => b.url), { token: blobToken });
    } catch {
      // ignore
    }
    return;
  }

  await fs.unlink(tokenPath()).catch(() => {});
}

export function isGmailConnected(tokens: GmailStoredTokens | null): boolean {
  return Boolean(tokens?.refresh_token);
}
