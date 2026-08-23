import { NextRequest, NextResponse } from "next/server";
import { upsertUser as defaultUpsertUser } from "./db";
import {
  consumeOAuthLoginTransaction,
  oauthCorrelationCookieName,
  oauthCorrelationCookiePath,
  type OAuthLoginProvider,
} from "./oauth-transaction";
import { sanitizeAuthReturnTo } from "./return-to";
import { setAuthCookies as defaultSetAuthCookies } from "./session";
import { issueTokenPair as defaultIssueTokenPair } from "./tokens";

type OAuthProfile = {
  providerId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

type HandleOAuthCallbackDependencies = {
  consumeTransaction?: typeof consumeOAuthLoginTransaction;
  upsertUser?: typeof defaultUpsertUser;
  issueTokenPair?: typeof defaultIssueTokenPair;
  setAuthCookies?: typeof defaultSetAuthCookies;
};

type HandleOAuthCallbackOptions = {
  provider: OAuthLoginProvider;
  request: NextRequest;
  exchangeFn: (
    code: string,
    origin: string,
    codeVerifier: string,
  ) => Promise<OAuthProfile>;
  dependencies?: HandleOAuthCallbackDependencies;
};

export async function handleOAuthCallback({
  provider,
  request,
  exchangeFn,
  dependencies = {},
}: HandleOAuthCallbackOptions): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const state = searchParams.get("state");
  if (!state) {
    return NextResponse.redirect(`${origin}/login?error=missing_params`);
  }

  let correlationCookieName: string;
  try {
    correlationCookieName = oauthCorrelationCookieName(state);
  } catch {
    return NextResponse.redirect(`${origin}/login?error=invalid_state`);
  }

  const correlationSecret = request.cookies.get(correlationCookieName)?.value;
  if (!correlationSecret) {
    return NextResponse.redirect(`${origin}/login?error=invalid_state`);
  }

  const consumeTransaction =
    dependencies.consumeTransaction ?? consumeOAuthLoginTransaction;
  let transaction: Awaited<ReturnType<typeof consumeOAuthLoginTransaction>>;
  try {
    transaction = await consumeTransaction({
      provider,
      state,
      correlationSecret,
    });
  } catch {
    return redirectAndClearTransaction(
      `${origin}/login?error=oauth_failed`,
      provider,
      correlationCookieName,
    );
  }

  if (!transaction) {
    return redirectAndClearTransaction(
      `${origin}/login?error=invalid_state`,
      provider,
      correlationCookieName,
    );
  }

  if (searchParams.has("error")) {
    return redirectAndClearTransaction(
      `${origin}/login?error=oauth_failed`,
      provider,
      correlationCookieName,
    );
  }

  const code = searchParams.get("code");
  if (!code) {
    return redirectAndClearTransaction(
      `${origin}/login?error=missing_params`,
      provider,
      correlationCookieName,
    );
  }

  let profile: OAuthProfile;
  try {
    profile = await exchangeFn(code, origin, transaction.codeVerifier);
  } catch {
    return redirectAndClearTransaction(
      `${origin}/login?error=oauth_failed`,
      provider,
      correlationCookieName,
    );
  }

  const userFields =
    provider === "discord"
      ? { discord_id: profile.providerId, google_id: null }
      : { google_id: profile.providerId, discord_id: null };

  const upsertUser = dependencies.upsertUser ?? defaultUpsertUser;
  let user;
  try {
    user = await upsertUser({
      email: profile.email,
      display_name: profile.displayName,
      avatar_url: profile.avatarUrl,
      ...userFields,
    });
  } catch {
    return redirectAndClearTransaction(
      `${origin}/login?error=db_error`,
      provider,
      correlationCookieName,
    );
  }

  const issueTokenPair = dependencies.issueTokenPair ?? defaultIssueTokenPair;
  let tokens;
  try {
    tokens = await issueTokenPair(user.id);
  } catch {
    return redirectAndClearTransaction(
      `${origin}/login?error=token_error`,
      provider,
      correlationCookieName,
    );
  }

  const safeReturnTo = sanitizeAuthReturnTo(transaction.returnTo);
  const response = redirectAndClearTransaction(
    safeReturnTo ? `${origin}${safeReturnTo}` : `${origin}/account`,
    provider,
    correlationCookieName,
  );
  const setAuthCookies = dependencies.setAuthCookies ?? defaultSetAuthCookies;
  setAuthCookies(response, tokens.accessToken, tokens.refreshToken);
  return response;
}

function redirectAndClearTransaction(
  location: string,
  provider: OAuthLoginProvider,
  correlationCookieName: string,
): NextResponse {
  const response = NextResponse.redirect(location);
  response.cookies.set(correlationCookieName, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: oauthCorrelationCookiePath(provider),
    maxAge: 0,
  });
  return response;
}
