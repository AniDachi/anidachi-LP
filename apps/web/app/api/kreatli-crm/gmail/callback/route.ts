import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { verifyKreatliCrmSession } from "@/lib/kreatli-crm/auth";
import {
  createGmailOAuth2,
  exchangeCodeForTokens,
  fetchGmailProfileEmail,
  getGmailRedirectUri,
} from "@/lib/kreatli-crm/gmail";
import { mergeGmailTokens } from "@/lib/kreatli-crm/gmail-tokens";
import { getPublicOrigin } from "@/lib/public-origin";

export const dynamic = "force-dynamic";

function failRedirect(request: NextRequest, msg: string) {
  return NextResponse.redirect(
    new URL(
      `/kreatli-email-crm?gmail_error=${encodeURIComponent(msg)}`,
      request.url
    )
  );
}

function errorToShortString(err: unknown): string {
  if (!err) return "unknown_error";
  if (err instanceof Error) return err.message || err.name;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "unstringifiable_error";
  }
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
  const expected = cookieStore.get("kreatli_gmail_oauth_state")?.value;
  const state = request.nextUrl.searchParams.get("state");
  if (!state || !expected || state !== expected) {
    return failRedirect(request, "bad_state");
  }

  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return failRedirect(request, "missing_code");
  }

  const origin = getPublicOrigin(request);
  const redirectUri = getGmailRedirectUri(origin);
  const oauth2 = createGmailOAuth2(redirectUri);
  if (!oauth2) {
    return failRedirect(request, "config");
  }

  try {
    const tokens = await exchangeCodeForTokens(oauth2, code);
    await mergeGmailTokens({
      refresh_token: tokens.refresh_token ?? undefined,
      access_token: tokens.access_token ?? undefined,
      expiry_date: tokens.expiry_date ?? undefined,
    });
    const email = await fetchGmailProfileEmail(redirectUri);
    if (email) {
      await mergeGmailTokens({ email });
    }
  } catch (err) {
    console.error("Gmail OAuth token exchange failed:", err);
    const msg = errorToShortString(err).slice(0, 300);
    return failRedirect(request, `token_exchange:${msg}`);
  }

  const res = NextResponse.redirect(
    new URL("/kreatli-email-crm?gmail=connected", request.url)
  );
  res.cookies.set("kreatli_gmail_oauth_state", "", {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return res;
}
