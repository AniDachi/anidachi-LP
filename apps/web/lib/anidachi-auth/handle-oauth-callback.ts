import { NextRequest, NextResponse } from "next/server";
import { upsertUser } from "./db";
import { issueTokenPair } from "./tokens";
import { setAuthCookies } from "./session";
import { sanitizeAuthReturnTo } from "./return-to";

type OAuthProfile = {
  providerId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

type HandleOAuthCallbackOptions = {
  provider: "discord" | "google";
  request: NextRequest;
  exchangeFn: (code: string, origin: string) => Promise<OAuthProfile>;
};

type StatePayload = {
  provider: string;
  returnTo: string;
};

function parseState(raw: string): StatePayload | null {
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf-8"));
  } catch {
    return null;
  }
}

export async function handleOAuthCallback({
  provider,
  request,
  exchangeFn,
}: HandleOAuthCallbackOptions): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");

  if (!code || !stateParam) {
    return NextResponse.redirect(`${origin}/login?error=missing_params`);
  }

  // Validate state cookie to prevent CSRF
  const stateCookie = request.cookies.get("anidachi_oauth_state")?.value;
  if (!stateCookie || stateCookie !== stateParam) {
    return NextResponse.redirect(`${origin}/login?error=invalid_state`);
  }

  const statePayload = parseState(stateParam);
  if (!statePayload || statePayload.provider !== provider) {
    return NextResponse.redirect(`${origin}/login?error=invalid_state`);
  }

  let profile: OAuthProfile;
  try {
    profile = await exchangeFn(code, origin);
  } catch {
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
  }

  const userFields =
    provider === "discord"
      ? { discord_id: profile.providerId, google_id: null }
      : { google_id: profile.providerId, discord_id: null };

  let user;
  try {
    user = await upsertUser({
      email: profile.email,
      display_name: profile.displayName,
      avatar_url: profile.avatarUrl,
      ...userFields,
    });
  } catch {
    return NextResponse.redirect(`${origin}/login?error=db_error`);
  }

  let tokens;
  try {
    tokens = await issueTokenPair(user.id);
  } catch {
    return NextResponse.redirect(`${origin}/login?error=token_error`);
  }

  const safeReturnTo = sanitizeAuthReturnTo(statePayload.returnTo);
  const redirectTo = safeReturnTo ? `${origin}${safeReturnTo}` : `${origin}/`;

  const response = NextResponse.redirect(redirectTo);
  // Clear the state cookie
  response.cookies.set("anidachi_oauth_state", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  setAuthCookies(response, tokens.accessToken, tokens.refreshToken);
  return response;
}
