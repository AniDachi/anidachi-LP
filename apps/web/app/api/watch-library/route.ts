import { type NextRequest, NextResponse } from "next/server";
import { getApiSession } from "@/lib/anidachi-auth/api-session";
import { listWatchLibrary } from "@/lib/anidachi-auth/watch-library";
import { watchLibraryErrorResponse } from "@/lib/anidachi-auth/watch-library-routes";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await listWatchLibrary(session.userId));
  } catch (error) {
    return watchLibraryErrorResponse(error);
  }
}
