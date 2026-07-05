import { Readable } from "stream";
import { google } from "googleapis";
import { createYouTubeOAuth2 } from "@/lib/youtube/oauth";
import {
  getCredentialsByChannelId,
  setCredentials,
  type YouTubeCredentials,
} from "@/lib/youtube/storage";

export type { YouTubeCredentials };

const TOKEN_REFRESH_BUFFER_MS = 60_000;

export class YouTubeApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "YouTubeApiError";
    this.status = status;
  }
}

function isInvalidGrant(err: unknown): boolean {
  const e = err as { message?: string; response?: { status?: number; data?: { error?: string } } };
  return (
    e.response?.status === 401 ||
    e.response?.data?.error === "invalid_grant" ||
    /invalid_grant/i.test(e.message ?? "")
  );
}

export async function ensureAuthClient(
  creds: YouTubeCredentials,
): Promise<{
  oauth2: NonNullable<ReturnType<typeof createYouTubeOAuth2>>;
  creds: YouTubeCredentials;
}> {
  const oauth2 = createYouTubeOAuth2("http://localhost");
  if (!oauth2) {
    throw new YouTubeApiError("YouTube OAuth is not configured", 500);
  }

  const now = Date.now();
  const needsRefresh =
    !creds.accessToken ||
    !creds.tokenExpiry ||
    now >= creds.tokenExpiry - TOKEN_REFRESH_BUFFER_MS;

  oauth2.setCredentials({
    refresh_token: creds.refreshToken,
    access_token: creds.accessToken,
    expiry_date: creds.tokenExpiry,
  });

  if (!needsRefresh) {
    return { oauth2, creds };
  }

  try {
    const { credentials } = await oauth2.refreshAccessToken();
    if (!credentials.access_token) {
      throw new YouTubeApiError("Failed to refresh YouTube access token", 401);
    }

    const updated: YouTubeCredentials = {
      ...creds,
      accessToken: credentials.access_token,
      tokenExpiry: credentials.expiry_date ?? now + 3600 * 1000,
      refreshToken: credentials.refresh_token ?? creds.refreshToken,
    };

    oauth2.setCredentials(credentials);
    await setCredentials(updated);
    return { oauth2, creds: updated };
  } catch (err) {
    if (isInvalidGrant(err)) {
      throw new YouTubeApiError("YouTube token expired — reconnect account", 401);
    }
    throw err;
  }
}

export async function ensureAllCredentials(): Promise<YouTubeCredentials[]> {
  const { getAllCredentials } = await import("@/lib/youtube/storage");
  const all = await getAllCredentials();
  const refreshed: YouTubeCredentials[] = [];

  for (const creds of all) {
    const { creds: fresh } = await ensureAuthClient(creds);
    refreshed.push(fresh);
  }

  return refreshed;
}

export async function probeChannelHealth(
  creds: YouTubeCredentials,
): Promise<boolean> {
  try {
    const { oauth2 } = await ensureAuthClient(creds);
    const youtube = google.youtube({ version: "v3", auth: oauth2 });
    const { data } = await youtube.channels.list({
      part: ["id"],
      id: [creds.channelId],
    });
    return (data.items?.length ?? 0) > 0;
  } catch {
    return false;
  }
}

export interface UploadShortVideoInput {
  fileStream: Readable;
  mimeType: string;
  title: string;
  description: string;
}

export async function uploadShortVideo(
  creds: YouTubeCredentials,
  input: UploadShortVideoInput,
): Promise<{ videoId: string; status: "published" }> {
  try {
    const { oauth2 } = await ensureAuthClient(creds);
    const youtube = google.youtube({ version: "v3", auth: oauth2 });

    const response = await youtube.videos.insert({
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title: input.title,
          description: input.description,
          categoryId: "22",
        },
        status: {
          privacyStatus: "public",
        },
      },
      media: {
        mimeType: input.mimeType || "video/mp4",
        body: input.fileStream,
      },
    });

    const videoId = response.data.id;
    if (!videoId) {
      throw new YouTubeApiError("YouTube upload succeeded but no video ID returned", 500);
    }

    return { videoId, status: "published" };
  } catch (err) {
    if (isInvalidGrant(err)) {
      throw new YouTubeApiError("YouTube token expired — reconnect account", 401);
    }
    const e = err as Error & { response?: { data?: { error?: { message?: string } } } };
    const message =
      e.response?.data?.error?.message ||
      e.message ||
      "Failed to upload to YouTube";
    throw new YouTubeApiError(message, 500);
  }
}

export async function uploadShortVideoFromUrl(
  creds: YouTubeCredentials,
  videoUrl: string,
  title: string,
  description: string,
): Promise<{ videoId: string; status: "published" }> {
  const response = await fetch(videoUrl);
  if (!response.ok) {
    throw new YouTubeApiError(`Failed to fetch video from storage (${response.status})`, 500);
  }

  const mimeType = response.headers.get("content-type") || "video/mp4";
  const body = response.body;
  if (!body) {
    throw new YouTubeApiError("Video response had no body", 500);
  }

  const fileStream = Readable.fromWeb(body as import("stream/web").ReadableStream);

  return uploadShortVideo(creds, {
    fileStream,
    mimeType,
    title,
    description,
  });
}

export async function getCredentialsForChannel(
  channelId: string,
): Promise<YouTubeCredentials | null> {
  return getCredentialsByChannelId(channelId);
}
