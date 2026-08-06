import type { FriendGroupsResponse } from "@anidachi/protocol";
import { type NextRequest, NextResponse } from "next/server";
import { createAccountResponseMeta } from "@/lib/anidachi-auth/account-response";
import { getApiSession } from "@/lib/anidachi-auth/api-session";
import {
  cleanGroupName,
  createFriendGroup,
  listFriendGroups,
} from "@/lib/anidachi-auth/social";
import { readJsonBody, socialErrorResponse } from "@/lib/anidachi-auth/social-routes";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const response: FriendGroupsResponse = {
      meta: createAccountResponseMeta(),
      groups: await listFriendGroups(session.userId),
    };
    return NextResponse.json(response);
  } catch (error) {
    return socialErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await readJsonBody(request);
  const rawName =
    body && typeof body === "object"
      ? (body as Record<string, unknown>).name
      : undefined;
  const name = cleanGroupName(rawName);
  if (!name) {
    return NextResponse.json({ error: "Invalid group name" }, { status: 400 });
  }

  try {
    const group = await createFriendGroup({ ownerUserId: session.userId, name });
    return NextResponse.json({ group });
  } catch (error) {
    return socialErrorResponse(error);
  }
}
