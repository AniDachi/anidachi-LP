import type { RecentPeopleResponse } from "@anidachi/protocol";
import { type NextRequest, NextResponse } from "next/server";
import { createAccountResponseMeta } from "@/lib/anidachi-auth/account-response";
import { getApiSession } from "@/lib/anidachi-auth/api-session";
import { listRecentPeople } from "@/lib/anidachi-auth/social";
import { socialErrorResponse } from "@/lib/anidachi-auth/social-routes";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const response: RecentPeopleResponse = {
      meta: createAccountResponseMeta(),
      people: await listRecentPeople(session.userId),
    };
    return NextResponse.json(response);
  } catch (error) {
    return socialErrorResponse(error);
  }
}
