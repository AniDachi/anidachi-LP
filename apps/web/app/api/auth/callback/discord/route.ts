import { NextRequest } from "next/server";
import { handleOAuthCallback } from "@/lib/anidachi-auth/handle-oauth-callback";
import { exchangeDiscordCode } from "@/lib/anidachi-auth/oauth/discord";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleOAuthCallback({
    provider: "discord",
    request,
    exchangeFn: exchangeDiscordCode,
  });
}
