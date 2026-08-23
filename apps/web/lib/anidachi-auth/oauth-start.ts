import { NextRequest, NextResponse } from "next/server";
import { buildDiscordAuthUrl } from "./oauth/discord";
import { buildGoogleAuthUrl } from "./oauth/google";
import {
  createOAuthLoginTransaction,
  oauthCorrelationCookiePath,
  OAUTH_LOGIN_TRANSACTION_TTL_SECONDS,
  type OAuthLoginProvider,
  type OAuthLoginTransactionStart,
} from "./oauth-transaction";

type OAuthStartDependencies = {
  createTransaction: () => Promise<OAuthLoginTransactionStart>;
};

export function handleGoogleOAuthStart(
  request: NextRequest,
  dependencies?: OAuthStartDependencies,
) {
  return handleOAuthStart("google", request, buildGoogleAuthUrl, dependencies);
}

export function handleDiscordOAuthStart(
  request: NextRequest,
  dependencies?: OAuthStartDependencies,
) {
  return handleOAuthStart("discord", request, buildDiscordAuthUrl, dependencies);
}

async function handleOAuthStart(
  provider: OAuthLoginProvider,
  request: NextRequest,
  buildAuthUrl: (state: string, origin: string, challenge: string) => string,
  dependencies?: OAuthStartDependencies,
) {
  try {
    const createTransaction =
      dependencies?.createTransaction ??
      (() =>
        createOAuthLoginTransaction({
          provider,
          returnTo: request.nextUrl.searchParams.get("returnTo"),
        }));
    const transaction = await createTransaction();
    const authUrl = buildAuthUrl(
      transaction.state,
      request.nextUrl.origin,
      transaction.codeChallenge,
    );
    const response = NextResponse.redirect(authUrl);
    response.cookies.set(
      transaction.correlationCookieName,
      transaction.correlationSecret,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: oauthCorrelationCookiePath(provider),
        maxAge: OAUTH_LOGIN_TRANSACTION_TTL_SECONDS,
      },
    );
    return response;
  } catch (error) {
    console.error("[anidachi/auth] OAuth start failed", {
      provider,
      error,
    });
    return NextResponse.redirect(
      `${request.nextUrl.origin}/login?error=oauth_failed`,
    );
  }
}
