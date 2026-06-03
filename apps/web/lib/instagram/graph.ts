import {
  type InstagramCredentials,
  getCredentials,
  getAllCredentials,
  clearCredentials,
} from "./storage";

export type { InstagramCredentials };

/**
 * Instagram Graph API helpers (v21.0).
 * All publishing functions accept an explicit `creds` parameter so callers
 * can target a specific account.
 */
const GRAPH_BASE = "https://graph.instagram.com/v21.0";
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// ---------------------------------------------------------------------------
// Credential helpers
// ---------------------------------------------------------------------------

export async function getStoredCredentials() {
  return getCredentials();
}

/** Returns the first connected account or throws 401. */
export async function ensureCredentials(): Promise<InstagramCredentials> {
  const creds = await getCredentials();
  if (!creds) {
    const err = new Error("Reconnect Instagram") as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  return creds;
}

/** Returns all connected accounts or throws 401 if none. */
export async function ensureAllCredentials(): Promise<InstagramCredentials[]> {
  const all = await getAllCredentials();
  if (all.length === 0) {
    const err = new Error("Reconnect Instagram") as Error & { status?: number };
    err.status = 401;
    throw err;
  }
  return all;
}

// ---------------------------------------------------------------------------
// Low-level Graph helpers — accept explicit credentials
// ---------------------------------------------------------------------------

async function graphGet<T>(
  creds: InstagramCredentials,
  path: string,
  params: Record<string, string> = {},
): Promise<T> {
  const url = new URL(`${GRAPH_BASE}${path}`);
  url.searchParams.set("access_token", creds.accessToken);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  const data = (await res.json()) as T & { error?: { message: string; code?: number } };
  if (data.error) {
    const err = new Error(data.error.message) as Error & { status?: number };
    const msg = (data.error.message || "").toLowerCase();
    const isInvalidToken =
      msg.includes("invalid oauth access token") ||
      msg.includes("cannot parse access token") ||
      (msg.includes("access token") && (msg.includes("invalid") || msg.includes("expired")));
    if (isInvalidToken) {
      await clearCredentials(creds.igUserId);
    }
    err.status = isInvalidToken ? 401 : res.status;
    throw err;
  }
  return data;
}

async function graphPost(
  creds: InstagramCredentials,
  path: string,
  body: Record<string, string>,
): Promise<{ id?: string; error?: { message: string } }> {
  const url = new URL(`${GRAPH_BASE}${path}`);
  const formBody = new URLSearchParams({ ...body, access_token: creds.accessToken });
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody.toString(),
  });
  const data = (await res.json()) as { id?: string; error?: { message: string } };
  if (data.error) {
    const err = new Error(data.error.message) as Error & { status?: number };
    const msg = (data.error.message || "").toLowerCase();
    const isInvalidToken =
      msg.includes("invalid oauth access token") ||
      msg.includes("cannot parse access token") ||
      (msg.includes("access token") && (msg.includes("invalid") || msg.includes("expired")));
    if (isInvalidToken) {
      await clearCredentials(creds.igUserId);
    }
    err.status = isInvalidToken ? 401 : res.status;
    throw err;
  }
  return data;
}

// ---------------------------------------------------------------------------
// Public publishing helpers — all require explicit creds
// ---------------------------------------------------------------------------

/** Create a Reels container. Returns container id. */
export async function createReelContainer(
  creds: InstagramCredentials,
  videoUrl: string,
  caption: string,
): Promise<string> {
  const res = await graphPost(creds, `/${creds.igUserId}/media`, {
    media_type: "REELS",
    video_url: videoUrl,
    caption,
    share_to_feed: "true",
  });
  if (!res.id) throw new Error("No container id returned");
  return res.id;
}

/** Create carousel child (image). */
export async function createCarouselChildImage(
  creds: InstagramCredentials,
  imageUrl: string,
): Promise<string> {
  const res = await graphPost(creds, `/${creds.igUserId}/media`, {
    image_url: imageUrl,
    is_carousel_item: "true",
  });
  if (!res.id) throw new Error("No container id returned");
  return res.id;
}

/** Create carousel child (video). */
export async function createCarouselChildVideo(
  creds: InstagramCredentials,
  videoUrl: string,
): Promise<string> {
  const res = await graphPost(creds, `/${creds.igUserId}/media`, {
    video_url: videoUrl,
    media_type: "VIDEO",
    is_carousel_item: "true",
  });
  if (!res.id) throw new Error("No container id returned");
  return res.id;
}

/** Create carousel parent container. */
export async function createCarouselParent(
  creds: InstagramCredentials,
  childrenIds: string[],
  caption: string,
): Promise<string> {
  const res = await graphPost(creds, `/${creds.igUserId}/media`, {
    media_type: "CAROUSEL",
    children: childrenIds.join(","),
    caption,
  });
  if (!res.id) throw new Error("No container id returned");
  return res.id;
}

export type ContainerStatus = "EXPIRED" | "ERROR" | "FINISHED" | "IN_PROGRESS" | "PUBLISHED";

/** Get container status. */
export async function getContainerStatus(
  creds: InstagramCredentials,
  containerId: string,
): Promise<{ status_code: ContainerStatus; error_message?: string }> {
  return graphGet<{ status_code: ContainerStatus; error_message?: string }>(
    creds,
    `/${containerId}`,
    { fields: "status_code,error_message" },
  );
}

/** Poll container until FINISHED or ERROR or timeout. */
export async function pollContainerUntilFinished(
  creds: InstagramCredentials,
  containerId: string,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const { status_code, error_message } = await getContainerStatus(creds, containerId);
    if (status_code === "FINISHED" || status_code === "PUBLISHED") return;
    if (status_code === "ERROR") {
      throw new Error(error_message || "Container processing failed");
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error("Timeout waiting for container to finish processing");
}

/** Publish a container (creation_id). */
export async function publishContainer(
  creds: InstagramCredentials,
  creationId: string,
): Promise<{ id: string }> {
  const res = await graphPost(creds, `/${creds.igUserId}/media_publish`, {
    creation_id: creationId,
  });
  if (!res.id) throw new Error("Publish failed");
  return { id: res.id };
}
