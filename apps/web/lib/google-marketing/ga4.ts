import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

export type Ga4PageRow = {
  pagePath: string;
  sessions: number;
  views: number;
  engagedSessions: number;
};

async function resolveGa4PropertyName(
  auth: OAuth2Client,
  override?: string
): Promise<string> {
  if (override?.trim()) {
    const id = override.replace(/\D/g, "");
    return id.startsWith("properties/") ? id : `properties/${id}`;
  }

  const env = process.env.GA4_PROPERTY_ID?.replace(/\D/g, "");
  if (env) return `properties/${env}`;

  const admin = google.analyticsadmin({ version: "v1beta", auth });
  const accounts = await admin.accounts.list();
  const accountNames = (accounts.data.accounts ?? [])
    .map((a) => a.name)
    .filter((n): n is string => Boolean(n));

  for (const accountName of accountNames) {
    const props = await admin.properties.list({
      filter: `parent:${accountName}`,
    });
    for (const prop of props.data.properties ?? []) {
      const display = (prop.displayName ?? "").toLowerCase();
      if (display.includes("anidachi") && prop.name) {
        return prop.name;
      }
    }
  }

  for (const accountName of accountNames) {
    const props = await admin.properties.list({
      filter: `parent:${accountName}`,
    });
    const first = props.data.properties?.[0]?.name;
    if (first) return first;
  }

  throw new Error(
    "Could not resolve GA4 property. Set GA4_PROPERTY_ID in .env.local."
  );
}

export async function fetchGa4TopPages(
  auth: OAuth2Client,
  options?: { days?: number; limit?: number; propertyId?: string }
): Promise<Ga4PageRow[]> {
  const days = options?.days ?? 28;
  const limit = options?.limit ?? 25;
  const property = await resolveGa4PropertyName(auth, options?.propertyId);

  const data = google.analyticsdata({ version: "v1beta", auth });
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);

  const res = await data.properties.runReport({
    property,
    requestBody: {
      dateRanges: [
        {
          startDate: start.toISOString().slice(0, 10),
          endDate: end.toISOString().slice(0, 10),
        },
      ],
      dimensions: [{ name: "landingPagePlusQueryString" }],
      metrics: [
        { name: "sessions" },
        { name: "screenPageViews" },
        { name: "engagedSessions" },
      ],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
      limit: String(limit),
    },
  });

  return (res.data.rows ?? []).map((row) => ({
    pagePath: row.dimensionValues?.[0]?.value ?? "",
    sessions: Number(row.metricValues?.[0]?.value ?? 0),
    views: Number(row.metricValues?.[1]?.value ?? 0),
    engagedSessions: Number(row.metricValues?.[2]?.value ?? 0),
  }));
}
