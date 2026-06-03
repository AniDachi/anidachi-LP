/**
 * Shared helpers for per-account filtering across Blou and OpenClaw routes.
 *
 * Semantics:
 *  - requestedIds === undefined  → field absent, no filtering (all accounts)
 *  - requestedIds === string[]   → filter to those IDs; unknown IDs are invalid
 */

import type { InstagramCredentials } from "@/lib/instagram/storage";
import type { TikTokCredentials } from "@/lib/tiktok/storage";

export interface AccountFilter {
  instagramAccountIds?: string[];
  tiktokAccountIds?: string[];
  hasAccountFilter: boolean;
}

export function filterIgCredentials(
  creds: InstagramCredentials[],
  requestedIds: string[] | undefined,
): InstagramCredentials[] {
  if (!requestedIds) return creds;
  const idSet = new Set(requestedIds);
  return creds.filter((c) => idSet.has(c.igUserId));
}

export function filterTtCredentials(
  creds: TikTokCredentials[],
  requestedIds: string[] | undefined,
): TikTokCredentials[] {
  if (!requestedIds) return creds;
  const idSet = new Set(requestedIds);
  return creds.filter((c) => idSet.has(c.openId));
}

export function validateFilteredIds(
  requestedIds: string[] | undefined,
  matchedIds: string[],
): string[] {
  if (!requestedIds) return [];
  const matchedSet = new Set(matchedIds);
  return requestedIds.filter((id) => !matchedSet.has(id));
}

// ---------------------------------------------------------------------------
// JSON body parsing (Blou routes)
// ---------------------------------------------------------------------------

export function parseAccountFilterFromJson(body: Record<string, unknown>): AccountFilter {
  const ig = Array.isArray(body.instagramAccountIds)
    ? (body.instagramAccountIds as unknown[]).filter((v): v is string => typeof v === "string")
    : undefined;
  const tt = Array.isArray(body.tiktokAccountIds)
    ? (body.tiktokAccountIds as unknown[]).filter((v): v is string => typeof v === "string")
    : undefined;

  return {
    instagramAccountIds: ig,
    tiktokAccountIds: tt,
    hasAccountFilter: ig !== undefined || tt !== undefined,
  };
}

// ---------------------------------------------------------------------------
// FormData parsing (OpenClaw routes)
// ---------------------------------------------------------------------------

/** Collect non-empty string values for any of the given keys (multipart clients vary). */
function formDataStringList(formData: FormData, keys: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const key of keys) {
    if (!formData.has(key)) continue;
    for (const v of formData.getAll(key)) {
      if (typeof v !== "string") continue;
      const t = v.trim();
      if (!t || seen.has(t)) continue;
      seen.add(t);
      out.push(t);
    }
  }
  return out;
}

/**
 * Parses per-account targeting from multipart form data.
 *
 * Accepts both `instagramAccountIds[]` (curl -F style) and plain `instagramAccountIds`
 * (repeated fields or single value — common in Python requests and other HTTP clients).
 * Same for TikTok (`tiktokAccountIds[]` / `tiktokAccountIds`).
 */
export function parseAccountFilterFromFormData(formData: FormData): AccountFilter {
  const igKeys = ["instagramAccountIds[]", "instagramAccountIds"];
  const ttKeys = ["tiktokAccountIds[]", "tiktokAccountIds"];

  const hasIg = igKeys.some((k) => formData.has(k));
  const hasTt = ttKeys.some((k) => formData.has(k));

  const ig = hasIg ? formDataStringList(formData, igKeys) : undefined;
  const tt = hasTt ? formDataStringList(formData, ttKeys) : undefined;

  return {
    instagramAccountIds: ig,
    tiktokAccountIds: tt,
    hasAccountFilter: hasIg || hasTt,
  };
}
