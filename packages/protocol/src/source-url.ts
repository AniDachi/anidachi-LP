import { z } from "zod";
import { MAX_URL_CHARS, MAX_VIDEO_FINGERPRINT_CHARS } from "./limits";

export const RoomSourceProviderSchema = z.enum(["crunchyroll", "youtube"]);

export type RoomSourceProvider = z.infer<typeof RoomSourceProviderSchema>;

export type RoomSourceUrlRejectionCode =
  | "CREDENTIALS_FORBIDDEN"
  | "INSECURE_URL"
  | "INVALID_URL"
  | "PROVIDER_MISMATCH"
  | "UNSUPPORTED_PROVIDER"
  | "UNSUPPORTED_ROUTE"
  | "URL_TOO_LONG";

type CanonicalRoomSource = {
  canonicalUrl: string;
  provider: RoomSourceProvider;
  sourceUrl: string;
  videoFingerprint: string;
};

const MAX_YOUTUBE_VIDEO_ID_CHARS = MAX_VIDEO_FINGERPRINT_CHARS - "youtube|".length;
const MAX_CRUNCHYROLL_EPISODE_ID_CHARS =
  MAX_VIDEO_FINGERPRINT_CHARS - "crunchyroll|watch/".length;

export type CanonicalRoomSourceUrlResult =
  | { ok: true; source: CanonicalRoomSource }
  | { code: RoomSourceUrlRejectionCode; ok: false };

export function canonicalizeRoomSourceUrl(
  value: string,
  pinnedProvider?: RoomSourceProvider,
): CanonicalRoomSourceUrlResult {
  if (value.length > MAX_URL_CHARS) {
    return { ok: false, code: "URL_TOO_LONG" };
  }
  if (
    value.trim() !== value ||
    /[\0-\x1F\x7F]/.test(value) ||
    value.includes("\\")
  ) {
    return { ok: false, code: "INVALID_URL" };
  }
  if (value.startsWith("http://")) {
    return { ok: false, code: "INSECURE_URL" };
  }
  if (!value.startsWith("https://")) {
    return { ok: false, code: "INVALID_URL" };
  }
  if (!/^https:\/\/[^/]+(?:\/|$)/.test(value)) {
    return { ok: false, code: "INVALID_URL" };
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, code: "INVALID_URL" };
  }

  if (url.username || url.password) {
    return { ok: false, code: "CREDENTIALS_FORBIDDEN" };
  }
  if (url.protocol !== "https:") {
    return { ok: false, code: "INSECURE_URL" };
  }
  if (url.port !== "") {
    return { ok: false, code: "INVALID_URL" };
  }

  const source = canonicalizeProviderUrl(url);
  if (!source) {
    return { ok: false, code: providerForHostname(url.hostname) ? "UNSUPPORTED_ROUTE" : "UNSUPPORTED_PROVIDER" };
  }
  if (pinnedProvider && source.provider !== pinnedProvider) {
    return { ok: false, code: "PROVIDER_MISMATCH" };
  }
  return { ok: true, source };
}

export function isLegacyRoomSourceFingerprintAlias(
  value: string,
  fingerprint: string,
): boolean {
  const canonical = canonicalizeRoomSourceUrl(value);
  if (!canonical.ok || canonical.source.provider !== "youtube") return false;

  const url = new URL(value);
  if (url.hostname !== "youtu.be" || url.searchParams.get("v")) return false;
  return fingerprint === `youtube|${url.pathname}`;
}

export const RoomSourceDescriptorSchema = z
  .strictObject({
    provider: RoomSourceProviderSchema,
    sourceUrl: z.string().max(MAX_URL_CHARS).url(),
    canonicalUrl: z.string().max(MAX_URL_CHARS).url(),
    videoFingerprint: z.string().min(1).max(MAX_VIDEO_FINGERPRINT_CHARS),
  })
  .superRefine((source, context) => {
    const canonical = canonicalizeRoomSourceUrl(source.sourceUrl, source.provider);
    if (!canonical.ok) {
      context.addIssue({
        code: "custom",
        message: `Invalid canonical room source: ${canonical.code}`,
        path: ["sourceUrl"],
      });
      return;
    }
    if (source.sourceUrl !== canonical.source.sourceUrl) {
      context.addIssue({
        code: "custom",
        message: "Room source URL must be canonical",
        path: ["sourceUrl"],
      });
    }
    if (source.canonicalUrl !== canonical.source.canonicalUrl) {
      context.addIssue({
        code: "custom",
        message: "Room canonical URL must match the source URL",
        path: ["canonicalUrl"],
      });
    }
    if (source.videoFingerprint !== canonical.source.videoFingerprint) {
      context.addIssue({
        code: "custom",
        message: "Room source fingerprint must match the canonical URL",
        path: ["videoFingerprint"],
      });
    }
  });

function canonicalizeProviderUrl(url: URL): CanonicalRoomSource | null {
  const provider = providerForHostname(url.hostname);
  if (provider === "youtube") {
    const videoId = youtubeVideoId(url);
    if (!videoId) return null;
    const canonicalUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    return boundedCanonicalRoomSource({
      provider,
      sourceUrl: canonicalUrl,
      canonicalUrl,
      videoFingerprint: `youtube|${videoId}`,
    });
  }
  if (provider === "crunchyroll") {
    const pathname = crunchyrollWatchPath(url);
    if (!pathname) return null;
    const canonicalUrl = `https://www.crunchyroll.com${pathname}`;
    const episodeId = pathname.split("/")[2];
    if (!episodeId) return null;
    return boundedCanonicalRoomSource({
      provider,
      sourceUrl: canonicalUrl,
      canonicalUrl,
      videoFingerprint: `crunchyroll|watch/${episodeId}`,
    });
  }
  return null;
}

function providerForHostname(hostname: string): RoomSourceProvider | null {
  const normalized = hostname.toLowerCase();
  if (
    normalized === "youtube.com" ||
    normalized === "www.youtube.com" ||
    normalized === "m.youtube.com" ||
    normalized === "youtu.be"
  ) {
    return "youtube";
  }
  if (normalized === "crunchyroll.com" || normalized === "www.crunchyroll.com") {
    return "crunchyroll";
  }
  return null;
}

function youtubeVideoId(url: URL): string | null {
  if (url.hostname.toLowerCase() === "youtu.be") {
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.length === 1 && isYouTubeVideoId(parts[0]) ? parts[0] : null;
  }
  if (!/^\/watch\/?$/.test(url.pathname)) return null;
  const ids = url.searchParams.getAll("v");
  return ids.length === 1 && isYouTubeVideoId(ids[0]) ? ids[0] : null;
}

function crunchyrollWatchPath(url: URL): string | null {
  const match = url.pathname.match(
    /^\/(?:[A-Za-z]{2}(?:-[A-Za-z]{2})?\/)?watch\/([A-Za-z0-9_-]+)(?:\/([A-Za-z0-9][A-Za-z0-9-]*))?\/?$/,
  );
  if (!match?.[1] || match[1].length > MAX_CRUNCHYROLL_EPISODE_ID_CHARS) return null;
  return `/watch/${match[1]}`;
}

function isYouTubeVideoId(value: string | undefined): value is string {
  return value !== undefined &&
    value.length <= MAX_YOUTUBE_VIDEO_ID_CHARS &&
    /^[A-Za-z0-9_-]{6,}$/.test(value);
}

function boundedCanonicalRoomSource(source: CanonicalRoomSource): CanonicalRoomSource | null {
  return source.sourceUrl.length <= MAX_URL_CHARS &&
      source.canonicalUrl.length <= MAX_URL_CHARS &&
      source.videoFingerprint.length <= MAX_VIDEO_FINGERPRINT_CHARS
    ? source
    : null;
}
