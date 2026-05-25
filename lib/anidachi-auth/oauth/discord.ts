const DISCORD_OAUTH_URL = "https://discord.com/oauth2/authorize";
const DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token";
const DISCORD_USER_URL = "https://discord.com/api/users/@me";

const DISCORD_SCOPES = ["identify", "email"].join(" ");

function getCredentials() {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("DISCORD_CLIENT_ID or DISCORD_CLIENT_SECRET is not set");
  }
  return { clientId, clientSecret };
}

function getRedirectUri(origin: string): string {
  return (
    process.env.DISCORD_REDIRECT_URI ||
    `${origin}/api/auth/callback/discord`
  );
}

export function buildDiscordAuthUrl(state: string, origin: string): string {
  const { clientId } = getCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(origin),
    response_type: "code",
    scope: DISCORD_SCOPES,
    state,
    prompt: "none",
  });
  return `${DISCORD_OAUTH_URL}?${params.toString()}`;
}

export type OAuthProfile = {
  providerId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

export async function exchangeDiscordCode(
  code: string,
  origin: string
): Promise<OAuthProfile> {
  const { clientId, clientSecret } = getCredentials();
  const redirectUri = getRedirectUri(origin);

  const tokenRes = await fetch(DISCORD_TOKEN_URL, {
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
    throw new Error(`Discord token exchange failed: ${tokenRes.status}`);
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token as string;

  const userRes = await fetch(DISCORD_USER_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!userRes.ok) {
    throw new Error(`Discord user fetch failed: ${userRes.status}`);
  }

  const user = await userRes.json();

  if (!user.email || !user.verified) {
    throw new Error("Discord account must have a verified email address");
  }

  const avatarUrl = user.avatar
    ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
    : null;

  return {
    providerId: user.id as string,
    email: user.email as string,
    displayName: user.global_name ?? user.username ?? "Anonymous",
    avatarUrl,
  };
}
