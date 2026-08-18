import fs from "fs/promises";
import path from "path";
import { getCrmDataDir } from "./store";
import {
  deletePrivateIntegrationBlob,
  hasPrivateIntegrationBlobConfiguration,
  readPrivateIntegrationBlobText,
  writePrivateIntegrationBlobText,
} from "@/lib/private-integration-blob";

export type GmailStoredTokens = {
  refresh_token?: string;
  access_token?: string;
  expiry_date?: number;
  /** Filled after OAuth + profile fetch */
  email?: string;
};

export const GMAIL_TOKENS_BLOB_PATH = "kreatli-crm/gmail-tokens.json";
const BLOB_PATH = GMAIL_TOKENS_BLOB_PATH;

function tokenPath() {
  return path.join(getCrmDataDir(), "gmail-tokens.json");
}

export async function readGmailTokens(): Promise<GmailStoredTokens | null> {
  if (hasPrivateIntegrationBlobConfiguration()) {
    const text = await readPrivateIntegrationBlobText(BLOB_PATH);
    return text ? (JSON.parse(text) as GmailStoredTokens) : null;
  }

  try {
    const raw = await fs.readFile(tokenPath(), "utf8");
    return JSON.parse(raw) as GmailStoredTokens;
  } catch {
    return null;
  }
}

export async function writeGmailTokens(data: GmailStoredTokens): Promise<void> {
  if (hasPrivateIntegrationBlobConfiguration()) {
    await writePrivateIntegrationBlobText(
      BLOB_PATH,
      JSON.stringify(data, null, 2),
    );
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
  if (hasPrivateIntegrationBlobConfiguration()) {
    await deletePrivateIntegrationBlob(BLOB_PATH).catch(() => undefined);
    return;
  }

  await fs.unlink(tokenPath()).catch(() => {});
}

export function isGmailConnected(tokens: GmailStoredTokens | null): boolean {
  return Boolean(tokens?.refresh_token);
}
