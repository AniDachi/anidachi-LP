import { isHboMaxHistoryKey } from "@anidachi/protocol";
import { unstable_cache } from "next/cache";
import type { NextRequest } from "next/server";
import { getApiSession } from "@/lib/anidachi-auth/api-session";
import { resolveHboMaxHistoryPoster } from "@/lib/hbomax-history-poster";

const cachedPoster = unstable_cache(
  (kind: "series" | "movie", id: string) => resolveHboMaxHistoryPoster(kind, id),
  ["hbomax-history-poster-v1"], { revalidate: 3600 },
);

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const key = params.get("titleKey") ?? "";
  const kind = key.split(":")[1];
  const failure = (status: number) => new Response(null, { status, headers: { "Cache-Control": "no-store" } });
  if ((kind !== "series" && kind !== "movie") || !isHboMaxHistoryKey(key, kind)) return failure(400);
  if (!(await getApiSession(request))) return failure(401);
  try {
    const url = await cachedPoster(kind, key.split(":")[2]);
    if (!url) return failure(404);
    // The popup loads the image separately. Its account token stays on the AniDachi origin.
    if (params.get("format") === "json") return Response.json({ url }, { headers: { "Cache-Control": "private, max-age=3600" } });
    return new Response(null, { status: 302, headers: {
      Location: url, "Cache-Control": "private, max-age=3600", "Referrer-Policy": "no-referrer",
    } });
  } catch {
    return failure(502);
  }
}
