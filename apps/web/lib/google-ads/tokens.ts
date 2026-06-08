import fs from "fs/promises";
import path from "path";
import {
  del as blobDel,
  get as blobGet,
  list as blobList,
  put as blobPut,
} from "@vercel/blob";
import { getCrmDataDir } from "@/lib/kreatli-crm/store";

export type GoogleAdsStoredTokens = {
  refresh_token?: string;
  access_token?: string;
  expiry_date?: number;
  email?: string;
};

const BLOB_PATH = "google-ads/tokens.json";
const BLOB_ACCESS = (process.env.BLOB_ACCESS ?? "private") as "public" | "private";

function tokenPath() {
  return path.join(getCrmDataDir(), "google-ads-tokens.json");
}

export async function readGoogleAdsTokens(): Promise<GoogleAdsStoredTokens | null> {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (blobToken) {
    try {
      const result = await blobGet(BLOB_PATH, {
        access: BLOB_ACCESS,
        token: blobToken,
      });
      if (!result || result.statusCode !== 200) return null;
      const text = await new Response(result.stream).text();
      return JSON.parse(text) as GoogleAdsStoredTokens;
    } catch {
      return null;
    }
  }

  try {
    const raw = await fs.readFile(tokenPath(), "utf8");
    return JSON.parse(raw) as GoogleAdsStoredTokens;
  } catch {
    return null;
  }
}

export async function writeGoogleAdsTokens(
  data: GoogleAdsStoredTokens
): Promise<void> {
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

  const dir = getCrmDataDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(tokenPath(), JSON.stringify(data, null, 2), "utf8");
}

export async function mergeGoogleAdsTokens(
  partial: GoogleAdsStoredTokens
): Promise<GoogleAdsStoredTokens> {
  const cur = (await readGoogleAdsTokens()) ?? {};
  const next: GoogleAdsStoredTokens = {
    ...cur,
    ...partial,
    refresh_token: partial.refresh_token ?? cur.refresh_token,
  };
  await writeGoogleAdsTokens(next);
  return next;
}

export async function clearGoogleAdsTokens(): Promise<void> {
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (blobToken) {
    try {
      const { blobs } = await blobList({ prefix: BLOB_PATH, token: blobToken });
      if (!blobs.length) return;
      await blobDel(
        blobs.map((b) => b.url),
        { token: blobToken }
      );
    } catch {
      // ignore
    }
    return;
  }

  try {
    await fs.unlink(tokenPath());
  } catch {
    // ignore
  }
}
