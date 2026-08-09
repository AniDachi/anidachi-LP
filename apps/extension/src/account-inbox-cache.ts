import { type AccountInboxResponse, AccountInboxResponseSchema } from "@anidachi/protocol";
import { storage } from "wxt/utils/storage";
import { AUTH_TOKENS_KEY, normalizeExtensionAuthTokens } from "./auth-tokens";

export const ACCOUNT_INBOX_CACHE_VERSION = 1 as const;

export type CachedAccountInbox = {
  schemaVersion: typeof ACCOUNT_INBOX_CACHE_VERSION;
  userId: string;
  cachedAt: string;
  data: AccountInboxResponse;
};

export function accountInboxCacheKeyForUser(userId: string): `local:${string}` {
  return `local:anidachi.accountInbox.v1.${encodeURIComponent(userId)}`;
}

export async function getCachedAccountInboxForUser(
  userId: string,
): Promise<CachedAccountInbox | null> {
  const key = accountInboxCacheKeyForUser(userId);
  const stored = await storage.getItem<unknown>(key);
  if (stored === null || stored === undefined) return null;

  const parsed = parseCachedAccountInbox(stored);
  if (!parsed || parsed.userId !== userId || parsed.data.meta.ownerUserId !== userId) {
    await storage.removeItem(key);
    return null;
  }
  return parsed;
}

export async function setCachedAccountInboxForUser(
  userId: string,
  data: AccountInboxResponse,
  now = new Date(),
): Promise<boolean> {
  if (!userId.trim()) throw new Error("Account inbox cache requires a user ID");
  const inbox = AccountInboxResponseSchema.parse(data);
  if (inbox.meta.ownerUserId !== userId) {
    throw new Error("Account inbox response belongs to another account");
  }
  if (!(await isCurrentStoredAccount(userId))) return false;

  const key = accountInboxCacheKeyForUser(userId);
  await storage.setItem(key, {
    schemaVersion: ACCOUNT_INBOX_CACHE_VERSION,
    userId,
    cachedAt: now.toISOString(),
    data: inbox,
  } satisfies CachedAccountInbox);

  if (!(await isCurrentStoredAccount(userId))) {
    await storage.removeItem(key);
    return false;
  }
  return true;
}

export async function clearCachedAccountInboxForUser(userId: string): Promise<void> {
  await storage.removeItem(accountInboxCacheKeyForUser(userId));
}

async function isCurrentStoredAccount(userId: string): Promise<boolean> {
  const tokens = normalizeExtensionAuthTokens(await storage.getItem<unknown>(AUTH_TOKENS_KEY));
  return tokens?.user.id === userId;
}

function parseCachedAccountInbox(value: unknown): CachedAccountInbox | null {
  if (!isRecord(value)) return null;
  if (
    value.schemaVersion !== ACCOUNT_INBOX_CACHE_VERSION ||
    typeof value.userId !== "string" ||
    !value.userId.trim() ||
    typeof value.cachedAt !== "string" ||
    !isCanonicalUtcTimestamp(value.cachedAt)
  ) {
    return null;
  }

  const data = AccountInboxResponseSchema.safeParse(value.data);
  if (!data.success) return null;
  return {
    schemaVersion: ACCOUNT_INBOX_CACHE_VERSION,
    userId: value.userId,
    cachedAt: value.cachedAt,
    data: data.data,
  };
}

function isCanonicalUtcTimestamp(value: string): boolean {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
