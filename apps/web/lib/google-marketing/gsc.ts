import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

export type GscPageRow = {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

function pickSiteUrl(
  sites: Array<{ siteUrl?: string | null }>,
  preferredHosts: string[]
): string {
  const urls = sites
    .map((s) => s.siteUrl)
    .filter((u): u is string => Boolean(u));

  for (const host of preferredHosts) {
    const match = urls.find(
      (u) => u.includes(host) || u === `sc-domain:${host.replace(/^www\./, "")}`
    );
    if (match) return match;
  }

  if (urls.length === 1) return urls[0];
  throw new Error(
    `Could not pick a Search Console property. Available: ${urls.join(", ") || "(none)"}`
  );
}

export async function listGscSiteUrls(auth: OAuth2Client): Promise<string[]> {
  const sc = google.searchconsole({ version: "v1", auth });
  const res = await sc.sites.list();
  return (res.data.siteEntry ?? [])
    .map((s) => s.siteUrl)
    .filter((u): u is string => Boolean(u));
}

export async function fetchGscTopPages(
  auth: OAuth2Client,
  options?: { days?: number; limit?: number; siteUrl?: string }
): Promise<GscPageRow[]> {
  const days = options?.days ?? 28;
  const limit = options?.limit ?? 25;
  const sc = google.searchconsole({ version: "v1", auth });

  const sites = await sc.sites.list();
  const siteUrl =
    options?.siteUrl ??
    pickSiteUrl(sites.data.siteEntry ?? [], [
      "www.anidachi.app",
      "anidachi.app",
    ]);

  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);

  const res = await sc.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      dimensions: ["page"],
      rowLimit: limit,
      dataState: "final",
    },
  });

  return (res.data.rows ?? []).map((row) => ({
    page: row.keys?.[0] ?? "",
    clicks: row.clicks ?? 0,
    impressions: row.impressions ?? 0,
    ctr: row.ctr ?? 0,
    position: row.position ?? 0,
  }));
}
