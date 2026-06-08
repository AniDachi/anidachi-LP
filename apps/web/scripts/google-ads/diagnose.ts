/**
 * Debug Google Ads auth / account access.
 * Usage: pnpm --filter @anidachi/web google-ads:diagnose
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createGoogleAdsOAuth2, normalizeCustomerId } from "../../lib/google-ads/oauth";
import { readGoogleAdsTokens } from "../../lib/google-ads/tokens";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_VERSION = "v20";

function loadEnvLocal() {
  const envPath = path.join(__dirname, "../../.env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i > 0 && process.env[t.slice(0, i)] === undefined) {
      process.env[t.slice(0, i)] = t.slice(i + 1);
    }
  }
}

async function googleAdsFetch(
  accessToken: string,
  developerToken: string,
  url: string,
  init?: RequestInit
) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": developerToken,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let json: unknown = text;
  try {
    json = JSON.parse(text);
  } catch {
    // keep text
  }
  return { status: res.status, body: json };
}

async function main() {
  loadEnvLocal();

  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim();
  const customerId = normalizeCustomerId(process.env.GOOGLE_ADS_CUSTOMER_ID ?? "");
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID?.trim();

  if (!developerToken) throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN missing");
  if (!customerId) throw new Error("GOOGLE_ADS_CUSTOMER_ID missing");

  const stored = await readGoogleAdsTokens();
  const refreshToken =
    process.env.GOOGLE_ADS_REFRESH_TOKEN ?? stored?.refresh_token;
  if (!refreshToken) throw new Error("No refresh token — reconnect Google Ads OAuth");

  const oauth2 = createGoogleAdsOAuth2("http://localhost");
  if (!oauth2) throw new Error("OAuth client not configured");
  oauth2.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2.refreshAccessToken();
  if (!credentials.access_token) throw new Error("Failed to refresh access token");

  console.log("Configured customer ID:", customerId);
  if (loginCustomerId) {
    console.log("Login customer ID:", normalizeCustomerId(loginCustomerId));
  } else {
    console.log("Login customer ID: (not set)");
  }
  console.log("Refresh token: stored in crm-data or env\n");

  const list = await googleAdsFetch(
    credentials.access_token,
    developerToken,
    `https://googleads.googleapis.com/${API_VERSION}/customers:listAccessibleCustomers`
  );
  console.log("listAccessibleCustomers:", list.status);
  console.log(JSON.stringify(list.body, null, 2));

  const headers: Record<string, string> = {};
  if (loginCustomerId) {
    headers["login-customer-id"] = normalizeCustomerId(loginCustomerId);
  }

  const accessibleIds =
    typeof list.body === "object" &&
    list.body !== null &&
    "resourceNames" in list.body &&
    Array.isArray((list.body as { resourceNames: string[] }).resourceNames)
      ? (list.body as { resourceNames: string[] }).resourceNames.map((name) =>
          name.replace("customers/", "")
        )
      : [];

  const testIds = [customerId, ...accessibleIds.filter((id) => id !== customerId)];
  for (const testId of testIds) {
    const keywordTest = await googleAdsFetch(
      credentials.access_token,
      developerToken,
      `https://googleads.googleapis.com/${API_VERSION}/customers/${testId}:generateKeywordIdeas`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          language: "languageConstants/1000",
          geoTargetConstants: ["geoTargetConstants/2840"],
          keywordPlanNetwork: "GOOGLE_SEARCH",
          keywordSeed: { keywords: ["watch anime with friends"] },
        }),
      }
    );
    console.log(`\ngenerateKeywordIdeas (${testId}):`, keywordTest.status);
    console.log(JSON.stringify(keywordTest.body, null, 2));
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
