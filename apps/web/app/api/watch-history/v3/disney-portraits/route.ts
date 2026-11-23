import { DisneyPortraitBatchSchema } from "@anidachi/protocol";
import { NextResponse, type NextRequest } from "next/server";
import { checkPersonalHistoryOperation, withPersonalHistoryRead } from "@/lib/anidachi-auth/personal-history-policy";
import { db } from "@/lib/anidachi-auth/db";
import { getExtensionSessionFromAuthorization } from "@/lib/anidachi-auth/extension-session";
import { HISTORY_PRIVATE_HEADERS } from "@/lib/anidachi-auth/watch-history-access";
import { WatchHistoryV3ApiError } from "@/lib/anidachi-auth/watch-history-v3";
import { readBoundedJson } from "@/lib/anidachi-auth/watch-history-v3-routes";

// Return only the owner's saved title IDs. Browsing a Disney shelf never uploads the shelf.
export async function GET(request: NextRequest) {
  const session = await getExtensionSessionFromAuthorization(request.headers.get("authorization"));
  if (!session) return NextResponse.json(null, { status: 401, headers: HISTORY_PRIVATE_HEADERS });
  try {
    const result = await withPersonalHistoryRead(session.sub, async () => {
      const { access } = await checkPersonalHistoryOperation(session.sub, "personal");
      if (!access) throw new Error("Missing history access");
      const keys: string[] = [];
      const signal = AbortSignal.timeout(3500);
      for (;;) {
        let query = db().from("watch_history_title_summaries").select("title_key")
          .eq("user_id", session.sub).eq("provider", "disneyplus").eq("history_generation", access.accountGeneration)
          .order("title_key").limit(500);
        if (keys.length) query = query.gt("title_key", keys[keys.length - 1]!);
        const { data, error } = await query.abortSignal(signal);
        if (error) throw error;
        keys.push(...data.map(row => row.title_key));
        if (data.length < 500) break;
      }
      return { owner: session.sub, generation: access.accountGeneration, epoch: access.accessEpoch, keys };
    });
    return NextResponse.json(result, { headers: HISTORY_PRIVATE_HEADERS });
  } catch (error) {
    return NextResponse.json(null, { status: error instanceof WatchHistoryV3ApiError ? error.status : 503, headers: HISTORY_PRIVATE_HEADERS });
  }
}
export async function POST(request: NextRequest) {
  const respond = (data: unknown, status: number) => NextResponse.json(data, { status, headers: HISTORY_PRIVATE_HEADERS });
  const session = await getExtensionSessionFromAuthorization(request.headers.get("authorization"));
  if (!session) return respond(null, 401);
  const parsed = DisneyPortraitBatchSchema.safeParse(await readBoundedJson(request, 32_768).catch(() => null));
  if (!parsed.success) return respond(null, 400);
  const { generation, epoch, cards } = parsed.data;
  const { data, error } = await db().rpc("save_disney_history_portraits_v1", {
    p_user_id: session.sub, p_generation: generation, p_epoch: epoch, p_cards: cards,
  }).abortSignal(AbortSignal.timeout(5000));
  if (error) return respond(null, error.message.includes("HISTORY_PLAN_REQUIRED") ? 403 : error.message.includes("HISTORY_ACCESS_CHANGED") ? 409 : 503);
  return respond(data, 200);
}
