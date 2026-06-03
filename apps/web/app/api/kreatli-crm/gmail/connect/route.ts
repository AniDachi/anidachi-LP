import { NextRequest, NextResponse } from "next/server";
import { verifyKreatliCrmSession } from "@/lib/kreatli-crm/auth";
import {
  createGmailOAuth2,
  gmailAuthUrl,
  getGmailRedirectUri,
  isGmailConfigured,
} from "@/lib/kreatli-crm/gmail";
import { getPublicOrigin } from "@/lib/public-origin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if (!(await verifyKreatliCrmSession())) {
    return NextResponse.redirect(new URL("/kreatli-email-crm/login", request.url));
  }

  if (!isGmailConfigured()) {
    return NextResponse.redirect(
      new URL("/kreatli-email-crm?gmail_error=config", request.url)
    );
  }

  const origin = getPublicOrigin(request);
  const redirectUri = getGmailRedirectUri(origin);
  const oauth2 = createGmailOAuth2(redirectUri);
  if (!oauth2) {
    return NextResponse.redirect(
      new URL("/kreatli-email-crm?gmail_error=config", request.url)
    );
  }

  const state = crypto.randomUUID();
  const url = gmailAuthUrl(oauth2, state);
  const isSecure = origin.startsWith("https://");
  const res = NextResponse.redirect(url);
  res.cookies.set("kreatli_gmail_oauth_state", state, {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax",
    maxAge: 10 * 60,
    path: "/",
  });
  return res;
}
