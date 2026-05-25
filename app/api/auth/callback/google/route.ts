import { NextRequest } from "next/server";
import { handleOAuthCallback } from "@/lib/anidachi-auth/handle-oauth-callback";
import { exchangeGoogleCode } from "@/lib/anidachi-auth/oauth/google";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleOAuthCallback({
    provider: "google",
    request,
    exchangeFn: exchangeGoogleCode,
  });
}
