import { NextRequest } from "next/server";
import { handleGoogleOAuthStart } from "@/lib/anidachi-auth/oauth-start";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleGoogleOAuthStart(request);
}
