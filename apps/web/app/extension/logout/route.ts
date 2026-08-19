import {
  ExtensionAuthClientIdSchema,
  ExtensionAuthStateSchema,
} from "@anidachi/protocol";
import { type NextRequest, NextResponse } from "next/server";
import {
  isSafeExtensionRedirectUri,
  readApprovedExtensionClientId,
} from "@/lib/anidachi-auth/extension-codes";
import {
  REFRESH_TOKEN_COOKIE,
  clearAuthCookies,
} from "@/lib/anidachi-auth/session";
import { revokeRefreshToken } from "@/lib/anidachi-auth/tokens";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const keys = [...request.nextUrl.searchParams.keys()];
  const clientId = request.nextUrl.searchParams.get("client_id") ?? "";
  const redirectUri = request.nextUrl.searchParams.get("redirect_uri") ?? "";
  const state = request.nextUrl.searchParams.get("state") ?? "";
  const approvedClientId = readApprovedExtensionClientId();

  if (
    keys.length !== 3 ||
    !keys.includes("client_id") ||
    !keys.includes("redirect_uri") ||
    !keys.includes("state") ||
    !ExtensionAuthClientIdSchema.safeParse(clientId).success ||
    !ExtensionAuthStateSchema.safeParse(state).success ||
    clientId !== approvedClientId ||
    !isSafeExtensionRedirectUri(redirectUri, "/logout", approvedClientId)
  ) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (refreshToken) {
    await revokeRefreshToken(refreshToken, "website");
  }

  const callback = new URL(redirectUri);
  callback.searchParams.set("signed_out", "1");
  callback.searchParams.set("state", state);

  const response = NextResponse.redirect(callback.toString(), 303);
  clearAuthCookies(response);
  return response;
}
