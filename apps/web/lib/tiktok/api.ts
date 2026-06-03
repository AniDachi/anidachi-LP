/**
 * TikTok Content Posting API helpers.
 *
 * Uses the "Upload to Inbox" (drafts) flow via video.upload scope.
 * Content lands in the creator's TikTok inbox for manual review and publishing.
 */

import {
  type TikTokCredentials,
  getAllCredentials,
  getCredentials,
  setCredentials,
} from "./storage";

export type { TikTokCredentials };

const TIKTOK_API_BASE = "https://open.tiktokapis.com";
const TOKEN_REFRESH_BUFFER_MS = 60 * 60 * 1000; // refresh 1 hour before expiry

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

/** Refresh the access token if it's near expiry. Returns updated credentials. */
export async function refreshIfNeeded(
  creds: TikTokCredentials,
): Promise<TikTokCredentials> {
  if (Date.now() < creds.accessTokenExpiry - TOKEN_REFRESH_BUFFER_MS) {
    return creds;
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    throw apiError("TikTok client credentials not configured", 500);
  }

  const res = await fetch(`${TIKTOK_API_BASE}/v2/oauth/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: creds.refreshToken,
    }),
  });

  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    refresh_expires_in?: number;
    open_id?: string;
    error?: string;
    error_description?: string;
  };

  if (!data.access_token) {
    throw apiError(
      data.error_description || data.error || "Token refresh failed",
      401,
    );
  }

  const updated: TikTokCredentials = {
    ...creds,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || creds.refreshToken,
    accessTokenExpiry: Date.now() + (data.expires_in ?? 86400) * 1000,
    refreshTokenExpiry: data.refresh_expires_in
      ? Date.now() + data.refresh_expires_in * 1000
      : creds.refreshTokenExpiry,
  };

  await setCredentials(updated);
  return updated;
}

// ---------------------------------------------------------------------------
// Credential helpers
// ---------------------------------------------------------------------------

/** Returns the first connected account (auto-refreshed) or throws 401. */
export async function ensureCredentials(): Promise<TikTokCredentials> {
  const creds = await getCredentials();
  if (!creds) {
    throw apiError("Connect TikTok", 401);
  }
  return refreshIfNeeded(creds);
}

/** Returns all connected accounts (auto-refreshed) or throws 401 if none. */
export async function ensureAllCredentials(): Promise<TikTokCredentials[]> {
  const all = await getAllCredentials();
  if (all.length === 0) {
    throw apiError("Connect TikTok", 401);
  }
  const results = await Promise.allSettled(all.map(refreshIfNeeded));
  const fresh: TikTokCredentials[] = [];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled") {
      fresh.push(r.value);
    } else {
      console.error(
        `TikTok token refresh failed for ${all[i].username} (${all[i].openId}):`,
        r.reason,
      );
    }
  }
  if (fresh.length === 0) {
    throw apiError("All TikTok token refreshes failed", 401);
  }
  return fresh;
}

// ---------------------------------------------------------------------------
// Content Posting API — Upload to Inbox (drafts)
// ---------------------------------------------------------------------------

export type PublishStatus =
  | "PROCESSING_UPLOAD"
  | "PROCESSING_DOWNLOAD"
  | "SEND_TO_USER_INBOX"
  | "PUBLISH_COMPLETE"
  | "FAILED";

/**
 * Upload photo carousel to creator's inbox (drafts).
 * Images must be publicly accessible URLs from a verified domain.
 * Returns the publish_id for status polling.
 */
export async function initInboxPhotoPost(
  creds: TikTokCredentials,
  imageUrls: string[],
  title: string,
  description?: string,
): Promise<string> {
  const fresh = await refreshIfNeeded(creds);

  const body = {
    post_info: {
      title: title.slice(0, 90),
      description: (description ?? title).slice(0, 4000),
    },
    source_info: {
      source: "PULL_FROM_URL",
      photo_cover_index: 0,
      photo_images: imageUrls,
    },
    post_mode: "MEDIA_UPLOAD",
    media_type: "PHOTO",
  };

  const res = await fetch(
    `${TIKTOK_API_BASE}/v2/post/publish/content/init/`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${fresh.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify(body),
    },
  );

  const data = (await res.json()) as {
    data?: { publish_id?: string };
    error?: { code?: string; message?: string };
  };

  if (data.error?.code && data.error.code !== "ok") {
    throw apiError(
      data.error.message || `TikTok photo init failed: ${data.error.code}`,
      res.status,
    );
  }

  if (!data.data?.publish_id) {
    throw apiError("No publish_id returned from TikTok", 500);
  }

  return data.data.publish_id;
}

/**
 * Upload video to creator's inbox (drafts).
 * Video must be a publicly accessible URL from a verified domain.
 * Returns the publish_id for status polling.
 */
export async function initInboxVideoPost(
  creds: TikTokCredentials,
  videoUrl: string,
  title: string,
  description?: string,
): Promise<string> {
  const fresh = await refreshIfNeeded(creds);

  const body = {
    post_info: {
      title: title.slice(0, 90),
      ...(description && description.trim()
        ? { description: description.slice(0, 4000) }
        : {}),
    },
    source_info: {
      source: "PULL_FROM_URL",
      video_url: videoUrl,
    },
  };

  const res = await fetch(
    `${TIKTOK_API_BASE}/v2/post/publish/inbox/video/init/`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${fresh.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify(body),
    },
  );

  const data = (await res.json()) as {
    data?: { publish_id?: string };
    error?: { code?: string; message?: string };
  };

  if (data.error?.code && data.error.code !== "ok") {
    throw apiError(
      data.error.message || `TikTok video init failed: ${data.error.code}`,
      res.status,
    );
  }

  if (!data.data?.publish_id) {
    throw apiError("No publish_id returned from TikTok", 500);
  }

  return data.data.publish_id;
}

/**
 * Poll publish status.
 * For inbox uploads, success = SEND_TO_USER_INBOX.
 */
export async function fetchPublishStatus(
  creds: TikTokCredentials,
  publishId: string,
): Promise<{ status: PublishStatus; failReason?: string }> {
  const fresh = await refreshIfNeeded(creds);

  const res = await fetch(
    `${TIKTOK_API_BASE}/v2/post/publish/status/fetch/`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${fresh.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({ publish_id: publishId }),
    },
  );

  const data = (await res.json()) as {
    data?: { status?: PublishStatus; fail_reason?: string };
    error?: { code?: string; message?: string };
  };

  if (data.error?.code && data.error.code !== "ok") {
    throw apiError(
      data.error.message || `Status fetch failed: ${data.error.code}`,
      res.status,
    );
  }

  return {
    status: data.data?.status ?? "PROCESSING_UPLOAD",
    failReason: data.data?.fail_reason,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function apiError(message: string, status: number): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}
