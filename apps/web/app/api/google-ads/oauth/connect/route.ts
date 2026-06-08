import { NextRequest, NextResponse } from "next/server";
import { verifyKreatliCrmSession } from "@/lib/kreatli-crm/auth";
import {
  createGoogleAdsOAuth2,
  getGoogleAdsRedirectUri,
  googleAdsAuthUrl,
  isGoogleAdsOAuthConfigured,
} from "@/lib/google-ads/oauth";
import { getPublicOrigin } from "@/lib/public-origin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await verifyKreatliCrmSession())) {
    return NextResponse.redirect(new URL("/kreatli-email-crm/login", request.url));
  }

  if (!isGoogleAdsOAuthConfigured()) {
    return NextResponse.redirect(
      new URL(
        "/kreatli-email-crm?google_ads_error=config",
        request.url
      )
    );
  }

  const origin = getPublicOrigin(request);
  const redirectUri = getGoogleAdsRedirectUri(origin);
  const oauth2 = createGoogleAdsOAuth2(redirectUri);
  if (!oauth2) {
    return NextResponse.redirect(
      new URL(
        "/kreatli-email-crm?google_ads_error=config",
        request.url
      )
    );
  }

  const state = crypto.randomUUID();
  const url = googleAdsAuthUrl(oauth2, state);
  const isSecure = origin.startsWith("https://");
  const res = NextResponse.redirect(url);
  res.cookies.set("google_ads_oauth_state", state, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/",
  });
  return res;
}
