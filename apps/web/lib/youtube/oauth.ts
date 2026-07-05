import { google } from "googleapis";

export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
];

export function getYouTubeRedirectUri(origin: string): string {
  const env = process.env.YOUTUBE_REDIRECT_URI?.replace(/\/$/, "");
  if (env) return env;
  return `${origin.replace(/\/$/, "")}/api/auth/youtube/callback`;
}

export function getYouTubeOAuthCredentials(): {
  clientId: string;
  clientSecret: string;
} | null {
  const clientId = process.env.YOUTUBE_CLIENT_ID || "";
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET || "";
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function isYouTubeOAuthConfigured(): boolean {
  return getYouTubeOAuthCredentials() !== null;
}

export function createYouTubeOAuth2(redirectUri: string) {
  const creds = getYouTubeOAuthCredentials();
  if (!creds) return null;
  return new google.auth.OAuth2(
    creds.clientId,
    creds.clientSecret,
    redirectUri,
  );
}

export function youtubeAuthUrl(
  oauth2: NonNullable<ReturnType<typeof createYouTubeOAuth2>>,
  state: string,
) {
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [...YOUTUBE_SCOPES],
    state,
  });
}

export async function exchangeYouTubeCode(
  oauth2: NonNullable<ReturnType<typeof createYouTubeOAuth2>>,
  code: string,
) {
  const { tokens } = await oauth2.getToken(code);
  return tokens;
}

export interface YouTubeChannelInfo {
  channelId: string;
  channelTitle: string;
  thumbnailUrl?: string;
}

export async function fetchChannelInfo(
  accessToken: string,
): Promise<YouTubeChannelInfo | null> {
  const oauth2 = createYouTubeOAuth2("http://localhost");
  if (!oauth2) return null;

  oauth2.setCredentials({ access_token: accessToken });
  const youtube = google.youtube({ version: "v3", auth: oauth2 });
  const { data } = await youtube.channels.list({
    part: ["snippet"],
    mine: true,
  });

  const channel = data.items?.[0];
  if (!channel?.id) return null;

  return {
    channelId: channel.id,
    channelTitle: channel.snippet?.title || channel.id,
    thumbnailUrl: channel.snippet?.thumbnails?.default?.url ?? undefined,
  };
}
