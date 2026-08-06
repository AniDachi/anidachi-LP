import { SocialSnapshotSchema, type SocialSnapshot } from "@anidachi/protocol";
import { storage } from "wxt/utils/storage";

export const SOCIAL_SNAPSHOT_CACHE_VERSION = 1 as const;
export const SOCIAL_SNAPSHOT_CACHE_MAX_AGE_MS = 60_000;

export type CachedSocialSnapshot = {
  schemaVersion: typeof SOCIAL_SNAPSHOT_CACHE_VERSION;
  userId: string;
  cachedAt: string;
  data: SocialSnapshot;
};

export function socialSnapshotCacheKeyForUser(userId: string): `local:${string}` {
  return `local:anidachi.socialSnapshot.v1.${encodeURIComponent(userId)}`;
}

export async function getCachedSocialSnapshotForUser(
  userId: string,
): Promise<CachedSocialSnapshot | null> {
  const key = socialSnapshotCacheKeyForUser(userId);
  const stored = await storage.getItem<unknown>(key);
  if (stored === null || stored === undefined) return null;

  const parsed = parseCachedSocialSnapshot(stored);
  if (!parsed || parsed.userId !== userId) {
    await storage.removeItem(key);
    return null;
  }
  return parsed;
}

export async function setCachedSocialSnapshotForUser(
  userId: string,
  data: SocialSnapshot,
  now = new Date(),
): Promise<void> {
  if (!userId.trim()) throw new Error("Social snapshot cache requires a user ID");
  const snapshot = SocialSnapshotSchema.parse(data);
  await storage.setItem(socialSnapshotCacheKeyForUser(userId), {
    schemaVersion: SOCIAL_SNAPSHOT_CACHE_VERSION,
    userId,
    cachedAt: now.toISOString(),
    data: snapshot,
  } satisfies CachedSocialSnapshot);
}

export async function clearCachedSocialSnapshotForUser(userId: string): Promise<void> {
  await storage.removeItem(socialSnapshotCacheKeyForUser(userId));
}

export function isSocialSnapshotCacheFresh(
  cached: CachedSocialSnapshot,
  nowMs = Date.now(),
): boolean {
  const cachedAtMs = Date.parse(cached.cachedAt);
  const ageMs = nowMs - cachedAtMs;
  return Number.isFinite(cachedAtMs) && ageMs >= 0 && ageMs <= SOCIAL_SNAPSHOT_CACHE_MAX_AGE_MS;
}

function parseCachedSocialSnapshot(value: unknown): CachedSocialSnapshot | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value);
  if (
    keys.length !== 4 ||
    !keys.includes("schemaVersion") ||
    !keys.includes("userId") ||
    !keys.includes("cachedAt") ||
    !keys.includes("data")
  ) {
    return null;
  }
  if (
    value.schemaVersion !== SOCIAL_SNAPSHOT_CACHE_VERSION ||
    typeof value.userId !== "string" ||
    !value.userId.trim() ||
    typeof value.cachedAt !== "string" ||
    !isCanonicalUtcTimestamp(value.cachedAt)
  ) {
    return null;
  }

  const data = SocialSnapshotSchema.safeParse(value.data);
  if (!data.success) return null;
  return {
    schemaVersion: SOCIAL_SNAPSHOT_CACHE_VERSION,
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
