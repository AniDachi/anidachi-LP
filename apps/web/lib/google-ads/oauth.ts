import { google } from "googleapis";

export const GOOGLE_ADS_SCOPE = "https://www.googleapis.com/auth/adwords";

export function normalizeCustomerId(id: string): string {
  return id.replace(/\D/g, "");
}

export function getGoogleAdsRedirectUri(origin: string): string {
  const env = process.env.GOOGLE_ADS_REDIRECT_URI?.replace(/\/$/, "");
  if (env) return env;
  return `${origin.replace(/\/$/, "")}/api/google-ads/oauth/callback`;
}

export function getGoogleAdsOAuthCredentials(): {
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

export function isGoogleAdsOAuthConfigured(): boolean {
  return getGoogleAdsOAuthCredentials() !== null;
}

export function createGoogleAdsOAuth2(redirectUri: string) {
  const creds = getGoogleAdsOAuthCredentials();
  if (!creds) return null;
  return new google.auth.OAuth2(
    creds.clientId,
    creds.clientSecret,
    redirectUri
  );
}

export function googleAdsAuthUrl(
  oauth2: NonNullable<ReturnType<typeof createGoogleAdsOAuth2>>,
  state: string
) {
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [GOOGLE_ADS_SCOPE],
    state,
  });
}

export async function exchangeGoogleAdsCode(
  oauth2: NonNullable<ReturnType<typeof createGoogleAdsOAuth2>>,
  code: string
) {
  const { tokens } = await oauth2.getToken(code);
  return tokens;
}
