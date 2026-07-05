/** OpenClaw / Blou YouTube Shorts are always uploaded private — never public via API. */
export const YOUTUBE_SHORTS_PRIVACY = "private" as const;

export type YouTubePrivacyStatus = typeof YOUTUBE_SHORTS_PRIVACY;

export function youtubeUploadStepLabel(): string {
  return "Uploaded to YouTube (private)";
}
