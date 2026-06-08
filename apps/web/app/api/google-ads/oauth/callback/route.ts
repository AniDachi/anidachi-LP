import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { verifyKreatliCrmSession } from "@/lib/kreatli-crm/auth";
import {
  createGoogleAdsOAuth2,
  exchangeGoogleAdsCode,
  getGoogleAdsRedirectUri,
} from "@/lib/google-ads/oauth";
import { mergeGoogleAdsTokens } from "@/lib/google-ads/tokens";
import { getPublicOrigin } from "@/lib/public-origin";

export const dynamic = "force-dynamic";

function failRedirect(request: NextRequest, msg: string) {
  return NextResponse.redirect(
    new URL(
      `/kreatli-email-crm?google_ads_error=${encodeURIComponent(msg)}`,
      request.url
    )
  );
}

export async function GET(request: NextRequest) {
  if (!(await verifyKreatliCrmSession())) {
    return NextResponse.redirect(new URL("/kreatli-email-crm/login", request.url));
  }

  const err = request.nextUrl.searchParams.get("error");
  if (err) {
    return failRedirect(request, err);
  }

  const cookieStore = await cookies();
  const expected = cookieStore.get("google_ads_oauth_state")?.value;
  const state = request.nextUrl.searchParams.get("state");
  if (!state || !expected || state !== expected) {
    return failRedirect(request, "bad_state");
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return failRedirect(request, "missing_code");
  }

  const origin = getPublicOrigin(request);
  const redirectUri = getGoogleAdsRedirectUri(origin);
  const oauth2 = createGoogleAdsOAuth2(redirectUri);
  if (!oauth2) {
    return failRedirect(request, "config");
  }

  try {
    const tokens = await exchangeGoogleAdsCode(oauth2, code);
    if (!tokens.refresh_token) {
      return failRedirect(
        request,
        "missing_refresh_token_reauthorize_with_prompt_consent"
      );
    }
    await mergeGoogleAdsTokens({
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token ?? undefined,
      expiry_date: tokens.expiry_date ?? undefined,
    });
  } catch (error) {
    console.error("Google Ads OAuth token exchange failed:", error);
    const msg =
      error instanceof Error ? error.message : "token_exchange_failed";
    return failRedirect(request, msg.slice(0, 300));
  }

  const res = NextResponse.redirect(
    new URL("/kreatli-email-crm?google_ads=connected", request.url)
  );
  res.cookies.set("google_ads_oauth_state", "", {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return res;
}
