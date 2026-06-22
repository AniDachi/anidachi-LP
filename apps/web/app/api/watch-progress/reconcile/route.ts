import { type NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/anidachi-auth/api-session";
import { readJsonBody } from "@/lib/anidachi-auth/social-routes";
import { reconcileWatchProgressBatch } from "@/lib/anidachi-auth/watch-library";
import { watchLibraryErrorResponse } from "@/lib/anidachi-auth/watch-library-routes";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await readJsonBody(request);
    return NextResponse.json(
      await reconcileWatchProgressBatch({
        userId: session.userId,
        entries: body,
      })
    );
  } catch (error) {
    return watchLibraryErrorResponse(error);
  }
}
