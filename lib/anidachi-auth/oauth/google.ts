const GOOGLE_OAUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

const GOOGLE_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

function getCredentials() {
  const clientId = process.env.ANIDACHI_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.ANIDACHI_GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "ANIDACHI_GOOGLE_CLIENT_ID or ANIDACHI_GOOGLE_CLIENT_SECRET is not set"
    );
  }
  return { clientId, clientSecret };
}

function getRedirectUri(origin: string): string {
  return (
    process.env.GOOGLE_ANIDACHI_REDIRECT_URI ||
    `${origin}/api/auth/callback/google`
  );
}

export function buildGoogleAuthUrl(state: string, origin: string): string {
  const { clientId } = getCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(origin),
    response_type: "code",
    scope: GOOGLE_SCOPES,
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `${GOOGLE_OAUTH_URL}?${params.toString()}`;
}

export type OAuthProfile = {
  providerId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

export async function exchangeGoogleCode(
  code: string,
  origin: string
): Promise<OAuthProfile> {
  const { clientId, clientSecret } = getCredentials();
  const redirectUri = getRedirectUri(origin);

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`Google token exchange failed: ${tokenRes.status}`);
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token as string;

  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!userRes.ok) {
    throw new Error(`Google user fetch failed: ${userRes.status}`);
  }

  const user = await userRes.json();

  if (!user.email) {
    throw new Error("Google account did not return an email address");
  }

  return {
    providerId: user.sub as string,
    email: user.email as string,
    displayName: user.name ?? user.given_name ?? "Anonymous",
    avatarUrl: (user.picture as string | undefined) ?? null,
  };
}
