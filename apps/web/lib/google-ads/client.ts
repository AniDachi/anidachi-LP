import { createGoogleAdsOAuth2, normalizeCustomerId } from "./oauth";
import { readGoogleAdsTokens } from "./tokens";

const GOOGLE_ADS_API_VERSION = "v24";

export type KeywordIdeaResult = {
  text: string;
  avgMonthlySearches?: number;
  competition?: string;
  competitionIndex?: number;
  lowTopOfPageBidMicros?: number;
  highTopOfPageBidMicros?: number;
};

export type GenerateKeywordIdeasInput = {
  keywords: string[];
  url?: string;
  languageId?: number;
  locationIds?: number[];
  customerId?: string;
};

export type KeywordVolumeResult = {
  text: string;
  /** Other spellings Google merged into this keyword (same volume). */
  closeVariants: string[];
  avgMonthlySearches?: number;
  competition?: string;
  competitionIndex?: number;
  lowTopOfPageBidMicros?: number;
  highTopOfPageBidMicros?: number;
  /** Last 12 months, oldest first. */
  monthlySearches: Array<{ year: number; month: string; searches: number }>;
};

export type GetKeywordVolumesInput = {
  keywords: string[];
  languageId?: number;
  /** Empty array means worldwide. Defaults to the United States. */
  locationIds?: number[];
  customerId?: string;
};

function getDeveloperToken(): string {
  const token = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  if (!token) {
    throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN is not set");
  }
  return token;
}

function getCustomerId(override?: string): string {
  const raw = override ?? process.env.GOOGLE_ADS_CUSTOMER_ID;
  if (!raw) {
    throw new Error("GOOGLE_ADS_CUSTOMER_ID is not set");
  }
  const normalized = normalizeCustomerId(raw);
  if (normalized.length !== 10) {
    throw new Error(
      `GOOGLE_ADS_CUSTOMER_ID must be 10 digits after normalization (got "${normalized}")`
    );
  }
  return normalized;
}

async function getAccessToken(): Promise<string> {
  const refreshToken =
    process.env.GOOGLE_ADS_REFRESH_TOKEN ??
    (await readGoogleAdsTokens())?.refresh_token;
  if (!refreshToken) {
    throw new Error(
      "No Google Ads refresh token. Visit /api/google-ads/oauth/connect while logged into Kreatli CRM, or set GOOGLE_ADS_REFRESH_TOKEN."
    );
  }

  const oauth2 = createGoogleAdsOAuth2("http://localhost");
  if (!oauth2) {
    throw new Error(
      "Google Ads OAuth is not configured (set ANIDACHI_GOOGLE_CLIENT_ID/SECRET or GOOGLE_ADS_CLIENT_ID/SECRET)"
    );
  }

  oauth2.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2.refreshAccessToken();
  if (!credentials.access_token) {
    throw new Error("Failed to refresh Google Ads access token");
  }
  return credentials.access_token;
}

function buildSeed(keywords: string[], url?: string) {
  if (keywords.length > 0 && url) {
    return { keywordAndUrlSeed: { keywords, url } };
  }
  if (url) {
    return { urlSeed: { url } };
  }
  return { keywordSeed: { keywords } };
}

async function postKeywordPlanner(
  method: "generateKeywordIdeas" | "generateKeywordHistoricalMetrics",
  customerIdOverride: string | undefined,
  body: Record<string, unknown>
): Promise<string> {
  const customerId = getCustomerId(customerIdOverride);
  const accessToken = await getAccessToken();
  const developerToken = getDeveloperToken();

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": developerToken,
    "Content-Type": "application/json",
  };

  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim();
  if (loginCustomerId) {
    headers["login-customer-id"] = normalizeCustomerId(loginCustomerId);
  }

  const endpoint = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}:${method}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 1200);
    let authError = "";
    try {
      const parsed = JSON.parse(text) as {
        error?: {
          message?: string;
          details?: Array<{
            errors?: Array<{
              message?: string;
              errorCode?: { authorizationError?: string };
            }>;
          }>;
        };
      };
      if (parsed.error?.message) detail = parsed.error.message;
      authError =
        parsed.error?.details?.[0]?.errors?.[0]?.errorCode?.authorizationError ??
        "";
      const specific = parsed.error?.details?.[0]?.errors?.[0]?.message;
      if (specific) detail = specific;
    } catch {
      // keep raw body
    }
    if (res.status === 403 && detail.includes("has not been used in project")) {
      throw new Error(
        `${detail} Enable Google Ads API in Google Cloud Console for your AniDachi project, wait a few minutes, then retry.`
      );
    }
    if (authError === "DEVELOPER_TOKEN_NOT_APPROVED") {
      throw new Error(
        "Developer token has Explorer (test) access only. Keyword Planner requires Basic or Standard access. Apply at Google Ads → Tools → API Center, then retry. See: https://developers.google.com/google-ads/api/docs/access-levels"
      );
    }
    if (authError === "USER_PERMISSION_DENIED") {
      throw new Error(
        `${detail} Run pnpm --filter @anidachi/web google-ads:diagnose to list accessible customer IDs, update GOOGLE_ADS_CUSTOMER_ID, or reconnect OAuth with the Google account that owns the Ads account.`
      );
    }
    throw new Error(`Google Ads ${method} failed (${res.status}): ${detail}`);
  }
  return text;
}

function toNumber(value: string | number | undefined): number | undefined {
  return value != null && value !== "" ? Number(value) : undefined;
}

export async function generateKeywordIdeas(
  input: GenerateKeywordIdeasInput
): Promise<KeywordIdeaResult[]> {
  const keywords = input.keywords.map((k) => k.trim()).filter(Boolean);
  const url = input.url?.trim();
  if (keywords.length === 0 && !url) {
    throw new Error("Provide at least one keyword or a URL seed");
  }

  const languageId = input.languageId ?? 1000;
  const locationIds = input.locationIds ?? [2840];
  const text = await postKeywordPlanner("generateKeywordIdeas", input.customerId, {
    language: `languageConstants/${languageId}`,
    geoTargetConstants: locationIds.map((id) => `geoTargetConstants/${id}`),
    includeAdultKeywords: false,
    keywordPlanNetwork: "GOOGLE_SEARCH",
    ...buildSeed(keywords, url),
  });

  const data = JSON.parse(text) as {
    results?: Array<{
      text?: string;
      keywordIdeaMetrics?: {
        avgMonthlySearches?: string;
        competition?: string;
        competitionIndex?: number;
        lowTopOfPageBidMicros?: string;
        highTopOfPageBidMicros?: string;
      };
    }>;
  };

  return (data.results ?? []).map((row) => ({
    text: row.text ?? "",
    avgMonthlySearches: toNumber(row.keywordIdeaMetrics?.avgMonthlySearches),
    competition: row.keywordIdeaMetrics?.competition,
    competitionIndex: row.keywordIdeaMetrics?.competitionIndex,
    lowTopOfPageBidMicros: toNumber(row.keywordIdeaMetrics?.lowTopOfPageBidMicros),
    highTopOfPageBidMicros: toNumber(row.keywordIdeaMetrics?.highTopOfPageBidMicros),
  }));
}

/**
 * Exact search volumes for the keywords you pass (Keyword Planner "historical
 * metrics"). Unlike generateKeywordIdeas, the result does not depend on which
 * other keywords share the request. Google merges close variants into one row
 * and lists the others in closeVariants.
 */
export async function getKeywordVolumes(
  input: GetKeywordVolumesInput
): Promise<KeywordVolumeResult[]> {
  const keywords = [...new Set(input.keywords.map((k) => k.trim()).filter(Boolean))];
  if (keywords.length === 0) {
    throw new Error("Provide at least one keyword");
  }
  if (keywords.length > 10000) {
    throw new Error("Keyword Planner accepts at most 10,000 keywords per request");
  }

  const languageId = input.languageId ?? 1000;
  const locationIds = input.locationIds ?? [2840];
  const text = await postKeywordPlanner(
    "generateKeywordHistoricalMetrics",
    input.customerId,
    {
      keywords,
      language: `languageConstants/${languageId}`,
      geoTargetConstants: locationIds.map((id) => `geoTargetConstants/${id}`),
      includeAdultKeywords: false,
      keywordPlanNetwork: "GOOGLE_SEARCH",
    }
  );

  const data = JSON.parse(text) as {
    results?: Array<{
      text?: string;
      closeVariants?: string[];
      keywordMetrics?: {
        avgMonthlySearches?: string;
        competition?: string;
        competitionIndex?: string | number;
        lowTopOfPageBidMicros?: string;
        highTopOfPageBidMicros?: string;
        monthlySearchVolumes?: Array<{
          year?: string | number;
          month?: string;
          monthlySearches?: string;
        }>;
      };
    }>;
  };

  return (data.results ?? []).map((row) => {
    const metrics = row.keywordMetrics;
    return {
      text: row.text ?? "",
      closeVariants: row.closeVariants ?? [],
      avgMonthlySearches: toNumber(metrics?.avgMonthlySearches),
      competition: metrics?.competition,
      competitionIndex: toNumber(metrics?.competitionIndex),
      lowTopOfPageBidMicros: toNumber(metrics?.lowTopOfPageBidMicros),
      highTopOfPageBidMicros: toNumber(metrics?.highTopOfPageBidMicros),
      monthlySearches: (metrics?.monthlySearchVolumes ?? []).map((m) => ({
        year: Number(m.year ?? 0),
        month: m.month ?? "",
        searches: Number(m.monthlySearches ?? 0),
      })),
    };
  });
}
