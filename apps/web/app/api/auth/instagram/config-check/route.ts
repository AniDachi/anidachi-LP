import { NextResponse } from "next/server";
import { jsonUnauthorizedUnlessKreatliSession } from "@/lib/blou-access";

export const dynamic = "force-dynamic";

const OPTIONAL = ["INSTAGRAM_OAUTH_REDIRECT_URI"] as const;

/**
 * GET /api/auth/instagram/config-check
 * Returns which env vars are set (names only). Use to verify production config.
 * Remove or restrict in production once done debugging.
 */
export async function GET() {
  const denied = await jsonUnauthorizedUnlessKreatliSession();
  if (denied) return denied;

  const hasAppId =
    (process.env.INSTAGRAM_APP_ID || process.env.META_APP_ID || "").trim()
      .length > 0;
  const hasAppSecret =
    (process.env.INSTAGRAM_APP_SECRET || process.env.META_APP_SECRET || "").trim()
      .length > 0;

  const missing: string[] = [];
  if (!hasAppId) missing.push("INSTAGRAM_APP_ID or META_APP_ID");
  if (!hasAppSecret) missing.push("INSTAGRAM_APP_SECRET or META_APP_SECRET");

  const optionalSet = OPTIONAL.filter((key) => process.env[key]?.trim());
  const ok = missing.length === 0;

  return NextResponse.json({
    ok,
    missing,
    optionalSet,
    hint: ok
      ? "All required Instagram env vars are set."
      : `In Vercel: Settings → Environment Variables → add for Production: ${missing.join(", ")}. Then redeploy.`,
  });
}
