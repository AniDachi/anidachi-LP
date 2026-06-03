import { NextRequest, NextResponse } from "next/server";
import {
  validateOpenClawSecret,
  unauthorizedResponse,
} from "@/lib/openclaw-auth";
import { getAllCredentials as getAllIg } from "@/lib/instagram/storage";
import { getAllCredentials as getAllTt } from "@/lib/tiktok/storage";
import { refreshIfNeeded } from "@/lib/tiktok/api";

const IG_GRAPH_BASE = "https://graph.instagram.com/v21.0";
const TT_API_BASE = "https://open.tiktokapis.com";

export const dynamic = "force-dynamic";

/** Safely refresh TikTok token; returns creds as-is or refreshed, or null if refresh fails. */
async function safeRefreshTiktok(
  creds: Awaited<ReturnType<typeof getAllTt>>[0],
): Promise<Awaited<ReturnType<typeof getAllTt>>[0] | null> {
  try {
    return await refreshIfNeeded(creds);
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  if (!validateOpenClawSecret(request)) {
    return unauthorizedResponse();
  }

  let igAccounts: Awaited<ReturnType<typeof getAllIg>>;
  let ttAccounts: Awaited<ReturnType<typeof getAllTt>>;
  try {
    [igAccounts, ttAccounts] = await Promise.all([
      getAllIg(),
      getAllTt(),
    ]);
  } catch (err) {
    console.error("[openclaw/health] Storage error:", err);
    return NextResponse.json(
      {
        healthy: false,
        error: "storage_error",
        message: "Failed to load connected accounts",
        instagram: [],
        tiktok: [],
      },
      { status: 503 },
    );
  }

  if (igAccounts.length === 0 && ttAccounts.length === 0) {
    return NextResponse.json({
      healthy: false,
      reason: "no_accounts_connected",
      instagram: [],
      tiktok: [],
    });
  }

  try {
    const igResults = await Promise.all(
      igAccounts.map(async (creds) => {
        try {
          const url = new URL(`${IG_GRAPH_BASE}/${creds.igUserId}`);
          url.searchParams.set("fields", "id");
          url.searchParams.set("access_token", creds.accessToken);
          const res = await fetch(url.toString());
          return {
            accountId: creds.igUserId,
            username: creds.igUsername,
            healthy: res.ok,
            reason: res.ok ? undefined : "graph_api_error",
          };
        } catch {
          return {
            accountId: creds.igUserId,
            username: creds.igUsername,
            healthy: false,
            reason: "request_failed",
          };
        }
      }),
    );

    const ttResults = await Promise.all(
      ttAccounts.map(async (creds) => {
        const fresh = await safeRefreshTiktok(creds);
        if (!fresh) {
          return {
            accountId: creds.openId,
            username: creds.username,
            healthy: false,
            reason: "token_expired_or_refresh_failed",
          };
        }
        try {
          const res = await fetch(
            `${TT_API_BASE}/v2/user/info/?fields=open_id,display_name`,
            { headers: { Authorization: `Bearer ${fresh.accessToken}` } },
          );
          const data = (await res.json()) as { error?: { code?: string } };
          const ok = !data.error?.code || data.error.code === "ok";
          return {
            accountId: creds.openId,
            username: creds.username,
            healthy: ok,
            reason: ok ? undefined : "token_expired_or_invalid",
          };
        } catch {
          return {
            accountId: creds.openId,
            username: creds.username,
            healthy: false,
            reason: "request_failed",
          };
        }
      }),
    );

    const allHealthy = [...igResults, ...ttResults].every((r) => r.healthy);

    return NextResponse.json({
      healthy: allHealthy,
      instagram: igResults,
      tiktok: ttResults,
    });
  } catch (err) {
    console.error("[openclaw/health] Health check error:", err);
    return NextResponse.json(
      {
        healthy: false,
        error: "health_check_failed",
        message: err instanceof Error ? err.message : "Unknown error",
        instagram: [],
        tiktok: [],
      },
      { status: 500 },
    );
  }
}
