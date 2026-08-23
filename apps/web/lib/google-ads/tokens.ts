import fs from "fs/promises";
import path from "path";
import { getCrmDataDir } from "@/lib/kreatli-crm/store";
import {
  deletePrivateIntegrationBlob,
  hasPrivateIntegrationBlobConfiguration,
  readPrivateIntegrationBlobText,
  writePrivateIntegrationBlobText,
} from "@/lib/private-integration-blob";

export type GoogleAdsStoredTokens = {
  refresh_token?: string;
  access_token?: string;
  expiry_date?: number;
  email?: string;
};

export const GOOGLE_ADS_TOKENS_BLOB_PATH = "google-ads/tokens.json";
const BLOB_PATH = GOOGLE_ADS_TOKENS_BLOB_PATH;

function tokenPath() {
  return path.join(getCrmDataDir(), "google-ads-tokens.json");
}

export async function readGoogleAdsTokens(): Promise<GoogleAdsStoredTokens | null> {
  if (hasPrivateIntegrationBlobConfiguration()) {
    const text = await readPrivateIntegrationBlobText(BLOB_PATH);
    return text ? (JSON.parse(text) as GoogleAdsStoredTokens) : null;
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
  if (hasPrivateIntegrationBlobConfiguration()) {
    await writePrivateIntegrationBlobText(
      BLOB_PATH,
      JSON.stringify(data, null, 2),
    );
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
  if (hasPrivateIntegrationBlobConfiguration()) {
    await deletePrivateIntegrationBlob(BLOB_PATH);
    return;
  }

  try {
    await fs.unlink(tokenPath());
  } catch {
    // ignore
  }
}
