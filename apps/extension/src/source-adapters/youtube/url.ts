const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{6,}$/;

export function isYouTubeProviderHost(hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase();
  return (
    isYouTubeHost(normalizedHostname) ||
    isYouTubeNoCookieHost(normalizedHostname) ||
    normalizedHostname === "youtu.be" ||
    normalizedHostname.endsWith(".youtu.be")
  );
}

export function isYouTubeWatchPage(url: URL): boolean {
  const hostname = url.hostname.toLowerCase();
  if (hostname === "youtu.be" || hostname.endsWith(".youtu.be")) {
    const segments = url.pathname.split("/").filter(Boolean);
    return segments.length === 1 && cleanYouTubeVideoId(segments[0]) !== null;
  }

  if (!isYouTubeHost(hostname) || !/^\/watch\/?$/.test(url.pathname)) {
    return false;
  }

  return cleanYouTubeVideoId(url.searchParams.get("v")) !== null;
}

export function getYouTubeFingerprintKey(url: URL): string {
  const watchId = url.searchParams.get("v");
  if (watchId) {
    return watchId;
  }

  const embedMatch = url.pathname.match(/\/(?:embed|shorts)\/([^/?#]+)/);
  return embedMatch?.[1] ?? url.pathname;
}

export function parseYouTubeVideoId(url: URL): string | null {
  if (url.hostname === "youtu.be") {
    return cleanYouTubeVideoId(url.pathname.split("/").filter(Boolean)[0]);
  }

  if (isYouTubeNoCookieHost(url.hostname)) {
    return cleanYouTubeVideoId(getPathVideoId(url, "embed"));
  }

  if (!isYouTubeHost(url.hostname)) {
    return null;
  }

  return (
    cleanYouTubeVideoId(url.searchParams.get("v")) ??
    cleanYouTubeVideoId(getPathVideoId(url, "shorts")) ??
    cleanYouTubeVideoId(getPathVideoId(url, "embed"))
  );
}

function isYouTubeHost(hostname: string): boolean {
  return hostname === "youtube.com" || hostname.endsWith(".youtube.com");
}

function isYouTubeNoCookieHost(hostname: string): boolean {
  return hostname === "youtube-nocookie.com" || hostname.endsWith(".youtube-nocookie.com");
}

function getPathVideoId(url: URL, route: "embed" | "shorts"): string | undefined {
  const segments = url.pathname.split("/").filter(Boolean);
  return segments[0] === route ? segments[1] : undefined;
}

function cleanYouTubeVideoId(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const cleaned = value.trim();
  return YOUTUBE_VIDEO_ID_PATTERN.test(cleaned) ? cleaned : null;
}
