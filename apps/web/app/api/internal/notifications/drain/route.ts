import { type NextRequest, NextResponse } from "next/server";
import { drainInboxPushOutbox } from "@/lib/anidachi-auth/inbox-push-outbox";
import { hasValidInternalServiceAuthorization } from "@/lib/internal-service-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "POST" } });
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  // Temporary legacy compatibility supports ordered cutover and rollback. The
  // drain-only secret is deliberately not added to the shared room auth helper.
  const drainAuthorized = hasValidInternalServiceAuthorization(
    authorization, process.env.ANIDACHI_NOTIFICATION_DRAIN_SECRET ?? "",
  );
  if (!drainAuthorized && !hasValidInternalServiceAuthorization(authorization)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const startedAt = performance.now();
  try {
    const { pruned, ...summary } = await drainInboxPushOutbox();
    const failed = summary.errors > 0 || summary.stopReason === "database_error";
    // A prune operation may affect zero rows after endpoint rotation.
    console.info("[anidachi/inbox-push] scheduled-drain", {
      ...summary, pruneOperations: pruned, outcome: failed ? "unavailable" : "completed",
    });
    if (!failed) return NextResponse.json({ ok: true });
  } catch {
    console.error("[anidachi/inbox-push] scheduled-drain", {
      outcome: "unavailable", elapsedMs: Math.max(0, performance.now() - startedAt),
    });
  }
  return NextResponse.json({ error: "Notification drain unavailable" }, { status: 503 });
}
