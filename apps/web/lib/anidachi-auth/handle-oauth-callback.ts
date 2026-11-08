import { recordVerifiedAccountEmail } from "./verified-email";
import { checkoutLoginErrorPath } from "../checkout-selection";
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
import {
  emitServerEvent,
  readFirstTouch,
  SIGNUP_FLAG_COOKIE,
} from "../analytics-server-events";

type OAuthProfile = {
  emailVerified?: boolean;
  providerId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
};

type HandleOAuthCallbackDependencies = {
  recordVerifiedEmail?: typeof recordVerifiedAccountEmail;
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

/** Where the person was heading when they signed in. Prefix only, never ids. */
function signInFlow(returnTo: string | null | undefined): string {
  const path = returnTo ?? "";
  if (path.startsWith("/extension/connect")) return "extension";
  if (path.startsWith("/room/")) return "room_invite";
  if (path.startsWith("/friend/invite/")) return "friend_invite";
  if (path.startsWith("/checkout")) return "checkout";
  if (path.startsWith("/uninstall")) return "uninstall";
  if (path.startsWith("/account")) return "account";
  return "website";
}

/** A row created seconds ago means this sign-in made the account. */
function createdJustNow(createdAt: unknown): boolean {
  if (typeof createdAt !== "string") return false;
  const ms = Date.parse(createdAt);
  return Number.isFinite(ms) && Date.now() - ms >= 0 && Date.now() - ms < 60_000;
}

export async function handleOAuthCallback(
  options: HandleOAuthCallbackOptions,
): Promise<NextResponse> {
  const response = await handleOAuthCallbackInner(options);
  try {
    const location = response.headers.get("location");
    const failure = location
      ? new URL(location, options.request.nextUrl.origin).searchParams.get("error")
      : null;
    if (failure) {
      emitServerEvent({
        eventType: "login_failed",
        request: options.request,
        properties: { provider: options.provider, error: failure.slice(0, 40) },
      });
    }
  } catch {
    // Never let analytics change the sign-in response.
  }
  return response;
}

async function handleOAuthCallbackInner({
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
      `${origin}${checkoutLoginErrorPath("oauth_failed", transaction.returnTo)}`,
      provider,
      correlationCookieName,
    );
  }

  const code = searchParams.get("code");
  if (!code) {
    return redirectAndClearTransaction(
      `${origin}${checkoutLoginErrorPath("missing_params", transaction.returnTo)}`,
      provider,
      correlationCookieName,
    );
  }

  let profile: OAuthProfile;
  try {
    profile = await exchangeFn(code, origin, transaction.codeVerifier);
  } catch {
    return redirectAndClearTransaction(
      `${origin}${checkoutLoginErrorPath("oauth_failed", transaction.returnTo)}`,
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
      `${origin}${checkoutLoginErrorPath("db_error", transaction.returnTo)}`,
      provider,
      correlationCookieName,
    );
  }

  // This proof gates only the new cardless trial. Storage outages must not
  // break ordinary login or change existing paid rights.
  if (profile.emailVerified === true) {
    try { await (dependencies.recordVerifiedEmail ?? recordVerifiedAccountEmail)(user.id, profile.email); }
    catch { /* No proof is recorded; trial start will ask for a fresh verified login. */ }
  }

  const issueTokenPair = dependencies.issueTokenPair ?? defaultIssueTokenPair;
  let tokens;
  try {
    tokens = await issueTokenPair(user.id);
  } catch {
    return redirectAndClearTransaction(
      `${origin}${checkoutLoginErrorPath("token_error", transaction.returnTo)}`,
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

  try {
    const isNew = createdJustNow((user as { created_at?: unknown }).created_at);
    const flow = signInFlow(transaction.returnTo);
    emitServerEvent({
      eventType: isNew ? "sign_up" : "login",
      userId: user.id,
      request,
      properties: {
        provider,
        flow,
        ...(isNew ? readFirstTouch(request.headers.get("cookie")) : {}),
      },
    });
    if (isNew) {
      // Lets the browser send GA4 sign_up once; the cookie is cleared right after.
      response.cookies.set(SIGNUP_FLAG_COOKIE, `${provider}.${flow}`, {
        path: "/",
        maxAge: 600,
        sameSite: "lax",
        secure: true,
      });
    }
  } catch {
    // Analytics only.
  }
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
