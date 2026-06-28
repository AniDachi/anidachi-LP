import { google } from "googleapis";

export const GOOGLE_MARKETING_SCOPES = [
  "https://www.googleapis.com/auth/adwords",
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/analytics.readonly",
] as const;

export function getGoogleMarketingOAuthCredentials(): {
  clientId: string;
  clientSecret: string;
} | null {
  const clientId =
    process.env.GOOGLE_ADS_CLIENT_ID ?? process.env.ANIDACHI_GOOGLE_CLIENT_ID;
  const clientSecret =
    process.env.GOOGLE_ADS_CLIENT_SECRET ??
    process.env.ANIDACHI_GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export function createGoogleMarketingOAuth2(redirectUri: string) {
  const creds = getGoogleMarketingOAuthCredentials();
  if (!creds) return null;
  return new google.auth.OAuth2(
    creds.clientId,
    creds.clientSecret,
    redirectUri
  );
}
