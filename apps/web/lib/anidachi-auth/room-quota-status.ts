import { ROOM_QUOTA_OWNER_HEADER, RoomQuotaStatusSchema } from "@anidachi/protocol";
import { NextResponse, type NextRequest } from "next/server";
import { getAccountAccessSession } from "./watch-history-access";
import { resolveAccountEntitlements } from "./account-entitlements";
import { getHostQuotaView, quotaSummaryForResponse } from "./room-usage";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" };

export function createRoomQuotaStatusHandler(deps = {
  getSession: getAccountAccessSession,
  resolve: resolveAccountEntitlements,
  getQuota: getHostQuotaView,
  now: () => new Date(),
}) {
  return async (request: NextRequest) => {
    try {
      const session = await deps.getSession(request);
      if (!session) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401, headers: PRIVATE_HEADERS });
      if (request.headers.get(ROOM_QUOTA_OWNER_HEADER) !== session.userId) {
        return NextResponse.json({ code: "QUOTA_OWNER_CHANGED" }, { status: 409, headers: PRIVATE_HEADERS });
      }
      // Resolve current paid access rather than trusting a stale plan in a token.
      const access = await deps.resolve(session.userId, deps.now());
      const now = deps.now();
      const view = await deps.getQuota(session.userId, access.policy.planCode, now);
      const body = RoomQuotaStatusSchema.parse({
        schemaVersion: 1, ownerUserId: session.userId, serverTime: now.toISOString(),
        quota: quotaSummaryForResponse(access.policy.planCode, view),
      });
      return NextResponse.json(body, { headers: PRIVATE_HEADERS });
    } catch {
      return NextResponse.json({ code: "QUOTA_UNAVAILABLE" }, { status: 503, headers: PRIVATE_HEADERS });
    }
  };
}
