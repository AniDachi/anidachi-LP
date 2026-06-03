import {
  getCrunchyrollRelatedSeriesId,
  selectCrunchyrollPosterTall,
} from "./crunchyroll-artwork-select";
import { runCrunchyrollMainCommand } from "./video-adapter";

const CRUNCHYROLL_AUTH_CLIENT_ID = "noaihdevm_6iyg0a8l0q";

let contentToken: { value: string; expiresAt: number } | null = null;

export { selectCrunchyrollPosterTall } from "./crunchyroll-artwork-select";

export async function loadCrunchyrollSeriesPoster(seriesId: string): Promise<string | null> {
  return loadCrunchyrollPosterArtwork({ seriesId });
}

export async function loadCrunchyrollPosterArtwork({
  contentId,
  seriesId,
}: {
  contentId?: string;
  seriesId?: string;
}): Promise<string | null> {
  if (!contentId && !seriesId) {
    return null;
  }

  if (isCrunchyrollPage()) {
    const bridgePoster = await loadCrunchyrollPosterFromMainWorld({ contentId, seriesId });
    if (bridgePoster) {
      return bridgePoster;
    }
  }

  const token = await getCrunchyrollContentToken();
  if (!token) {
    return null;
  }

  const primaryObject = await loadCrunchyrollCmsObject(seriesId ?? contentId, token);
  const primaryPoster = selectCrunchyrollPosterTall(primaryObject);
  if (primaryPoster) {
    return primaryPoster;
  }

  const relatedSeriesId = getCrunchyrollRelatedSeriesId(primaryObject);
  if (!relatedSeriesId || relatedSeriesId === seriesId) {
    return null;
  }

  return selectCrunchyrollPosterTall(await loadCrunchyrollCmsObject(relatedSeriesId, token));
}

async function loadCrunchyrollPosterFromMainWorld({
  contentId,
  seriesId,
}: {
  contentId?: string;
  seriesId?: string;
}): Promise<string | null> {
  try {
    const result = await runCrunchyrollMainCommand(
      "seriesPoster",
      {
        ...(contentId ? { contentId } : {}),
        locale: getCrunchyrollLocale(),
        ...(seriesId ? { seriesId } : {}),
      },
      3500,
    );
    return result.ok ? (result.posterUrl ?? null) : null;
  } catch {
    return null;
  }
}

async function loadCrunchyrollCmsObject(
  objectId: string | undefined,
  token: string,
): Promise<unknown> {
  if (!objectId) {
    return null;
  }

  const response = await fetch(
    getCrunchyrollApiUrl(
      `/content/v2/cms/objects/${encodeURIComponent(
        objectId,
      )}?ratings=true&preferred_audio_language=en-US&locale=${encodeURIComponent(getCrunchyrollLocale())}`,
    ),
    {
      credentials: "include",
      headers: {
        authorization: `Bearer ${token}`,
      },
    },
  );
  return response.ok ? response.json() : null;
}

async function getCrunchyrollContentToken(): Promise<string | null> {
  const now = Date.now();
  if (contentToken && contentToken.expiresAt > now + 30_000) {
    return contentToken.value;
  }

  const response = await fetch(getCrunchyrollApiUrl("/auth/v1/token"), {
    method: "POST",
    credentials: "include",
    headers: {
      authorization: `Basic ${btoa(`${CRUNCHYROLL_AUTH_CLIENT_ID}:`)}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_id" }),
  });
  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { access_token?: unknown; expires_in?: unknown };
  if (typeof data.access_token !== "string") {
    return null;
  }

  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 3600;
  contentToken = {
    value: data.access_token,
    expiresAt: now + Math.max(60, expiresIn - 60) * 1000,
  };
  return contentToken.value;
}

function getCrunchyrollLocale(): string {
  if (document.documentElement.lang) {
    return document.documentElement.lang;
  }

  return navigator.language || "en-US";
}

function getCrunchyrollApiUrl(path: string): string {
  return new URL(path, getCrunchyrollOrigin()).toString();
}

function getCrunchyrollOrigin(): string {
  return isCrunchyrollPage() ? window.location.origin : "https://www.crunchyroll.com";
}

function isCrunchyrollPage(): boolean {
  return window.location.hostname.endsWith("crunchyroll.com");
}
