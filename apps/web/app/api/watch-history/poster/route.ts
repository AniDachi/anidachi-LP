import { isHboMaxHistoryKey } from "@anidachi/protocol";
import { unstable_cache } from "next/cache";
import { getSession } from "@/lib/anidachi-auth/session";
import { resolveHboMaxHistoryPoster } from "@/lib/hbomax-history-poster";

const cachedPoster = unstable_cache(
  (kind: "series" | "movie", id: string) => resolveHboMaxHistoryPoster(kind, id),
  ["hbomax-history-poster-v1"], { revalidate: 3600 },
);

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("titleKey") ?? "";
  const kind = key.split(":")[1];
  const failure = (status: number) => new Response(null, { status, headers: { "Cache-Control": "no-store" } });
  if ((kind !== "series" && kind !== "movie") || !isHboMaxHistoryKey(key, kind)) return failure(400);
  if (!(await getSession())) return failure(401);
  try {
    const url = await cachedPoster(kind, key.split(":")[2]);
    return url ? new Response(null, { status: 302, headers: {
      Location: url, "Cache-Control": "private, max-age=3600", "Referrer-Policy": "no-referrer",
    } }) : failure(404);
  } catch {
    return failure(502);
  }
}
