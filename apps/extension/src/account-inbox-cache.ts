import { type AccountInboxItem, type AccountInboxResponse, AccountInboxResponseSchema } from "@anidachi/protocol";
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
  return withAccountInboxLock(userId, () => readAccountInbox(userId));
}

async function readAccountInbox(userId: string): Promise<CachedAccountInbox | null> {
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
): Promise<AccountInboxResponse | null> {
  return writeAccountInbox(userId, data, now);
}

async function writeAccountInbox(
  userId: string,
  data: AccountInboxResponse,
  now = new Date(),
  expectedEqualSnapshot?: AccountInboxResponse,
  isCurrent: () => boolean | Promise<boolean> = () => true,
): Promise<AccountInboxResponse | null> {
  if (!userId.trim()) throw new Error("Account inbox cache requires a user ID");
  const inbox = AccountInboxResponseSchema.parse(data);
  if (inbox.meta.ownerUserId !== userId) {
    throw new Error("Account inbox response belongs to another account");
  }
  return withAccountInboxLock(userId, async () => {
    if (!(await isCurrent()) || !(await isCurrentStoredAccount(userId))) return null;
    const current = await readAccountInbox(userId);
    // A causal reread may resolve equal request-start timestamps, but only if
    // nobody published a different snapshot while that network call was pending.
    const replaceEqual = Boolean(expectedEqualSnapshot && current &&
      JSON.stringify(current.data) === JSON.stringify(expectedEqualSnapshot));
    const canonical = mergeAccountInboxResponses(current?.data ?? null, inbox, replaceEqual);
    const key = accountInboxCacheKeyForUser(userId);
    if (!(await isCurrent())) return null;
    const changed = !current || JSON.stringify(current.data) !== JSON.stringify(canonical);
    if (changed) {
      await storage.setItem(key, {
        schemaVersion: ACCOUNT_INBOX_CACHE_VERSION,
        userId,
        cachedAt: now.toISOString(),
        data: canonical,
      } satisfies CachedAccountInbox);
    }
    if (!(await isCurrentStoredAccount(userId))) {
      await storage.removeItem(key);
      return null;
    }
    if (!(await isCurrent())) {
      if (changed) await storage.removeItem(key);
      return null;
    }
    return canonical;
  });
}

export async function clearCachedAccountInboxForUser(userId: string): Promise<void> {
  await withAccountInboxLock(userId, () => storage.removeItem(accountInboxCacheKeyForUser(userId)));
}

export function subscribeToAccountInboxForUser(
  userId: string,
  listener: (inbox: AccountInboxResponse) => void,
): () => void {
  let active = true;
  const unwatch = storage.watch<unknown>(accountInboxCacheKeyForUser(userId), (value) => {
    const cached = parseCachedAccountInbox(value);
    if (active && cached?.userId === userId && cached.data.meta.ownerUserId === userId) {
      listener(cached.data);
    }
  });
  return () => { active = false; unwatch(); };
}

export function accountInboxItemInstanceKey(item: AccountInboxItem): string {
  const id = item.kind === "room-invite" ? item.inviteId : item.friendshipId;
  return `${item.kind}:${id}:${item.createdAt}`;
}

export function mergeAccountInboxResponses(
  current: AccountInboxResponse | null,
  incoming: AccountInboxResponse,
  replaceEqual = false,
): AccountInboxResponse {
  if (!current || current.meta.ownerUserId !== incoming.meta.ownerUserId) return incoming;
  const incomingTime = Date.parse(incoming.meta.serverTime);
  const currentTime = Date.parse(current.meta.serverTime);
  const useIncoming = incomingTime > currentTime || (replaceEqual && incomingTime === currentTime);
  const base = useIncoming ? incoming : current;
  const other = useIncoming ? current : incoming;
  const seen = new Map(other.items.filter((item) => item.seenAt !== null)
    .map((item) => [accountInboxItemInstanceKey(item), item.seenAt]));
  let newlySeen = 0;
  const items = base.items.map((item) => {
    const seenAt = seen.get(accountInboxItemInstanceKey(item));
    if (item.seenAt !== null || !seenAt) return item;
    newlySeen++;
    return { ...item, seenAt };
  });
  if (!newlySeen) return base;
  // Counts cover the entire inbox, not just this (at most 100 item) page.
  return { ...base, items, counts: { ...base.counts, unseen: Math.max(0, base.counts.unseen - newlySeen) } };
}

export async function publishAccountInboxForUser(
  userId: string,
  inbox: AccountInboxResponse,
  options: {
    isCurrent: () => boolean | Promise<boolean>;
    reread: () => Promise<AccountInboxResponse>;
    seenItems?: AccountInboxItem[];
  },
): Promise<AccountInboxResponse | null> {
  if (!(await options.isCurrent())) return null;
  // Normalize field ordering before comparing serialized snapshots.
  inbox = AccountInboxResponseSchema.parse(inbox);
  const canonical = await writeAccountInbox(userId, inbox, new Date(), undefined, options.isCurrent);
  if (!canonical || !(await options.isCurrent())) return null;
  const equalConflict = Date.parse(canonical.meta.serverTime) === Date.parse(inbox.meta.serverTime) &&
    inboxStructure(canonical) !== inboxStructure(mergeAccountInboxResponses(canonical, inbox, true));
  const visible = new Set(canonical.items.map(accountInboxItemInstanceKey));
  const seenOutsidePage = options.seenItems?.some((item) => !visible.has(accountInboxItemInstanceKey(item)));
  if (!equalConflict && !seenOutsidePage) return canonical;
  // Never triggered by a subscription; one completed HTTP operation gets at
  // most one causal reread. No network work is held under the storage lock.
  const reread = await options.reread();
  if (!(await options.isCurrent())) return null;
  return writeAccountInbox(userId, reread, new Date(), canonical, options.isCurrent);
}

function inboxStructure(inbox: AccountInboxResponse): string {
  return JSON.stringify({
    items: inbox.items.map(({ seenAt: _seenAt, ...item }) => item),
    counts: inbox.counts,
    nextCursor: inbox.nextCursor,
  });
}

const localMutationTails = new Map<string, Promise<void>>();

function withAccountInboxLock<T>(userId: string, mutation: () => Promise<T>): Promise<T> {
  const name = `anidachi:account-inbox:${encodeURIComponent(userId)}`;
  if (globalThis.navigator?.locks) return navigator.locks.request(name, mutation);
  // Non-browser test/legacy contexts still serialize within this module.
  const result = (localMutationTails.get(name) ?? Promise.resolve()).then(mutation);
  const tail = result.then(() => {}, () => {});
  localMutationTails.set(name, tail);
  void tail.then(() => { if (localMutationTails.get(name) === tail) localMutationTails.delete(name); });
  return result;
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
