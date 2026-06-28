import { createGoogleAdsOAuth2 } from "@/lib/google-ads/oauth";
import { readGoogleAdsTokens } from "@/lib/google-ads/tokens";

export async function getGoogleMarketingAuthClient() {
  const refreshToken =
    process.env.GOOGLE_ADS_REFRESH_TOKEN ??
    (await readGoogleAdsTokens())?.refresh_token;
  if (!refreshToken) {
    throw new Error(
      "No Google marketing refresh token. Reconnect via Kreatli CRM → Connect Google Ads (includes Search Console + Analytics read access)."
    );
  }

  const oauth2 = createGoogleAdsOAuth2("http://localhost");
  if (!oauth2) {
    throw new Error(
      "Google OAuth is not configured (set ANIDACHI_GOOGLE_CLIENT_ID/SECRET)."
    );
  }

  oauth2.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2.refreshAccessToken();
  if (!credentials.access_token) {
    throw new Error("Failed to refresh Google access token.");
  }
  oauth2.setCredentials(credentials);
  return oauth2;
}
