import { randomUUID } from "node:crypto";
import {
  type CreateRoomInviteResponse,
  CreateRoomInviteRequestSchema,
  type RoomInvitesResponse,
} from "@anidachi/protocol";
import { after, type NextRequest, NextResponse } from "next/server";
import { createAccountResponseMeta } from "@/lib/anidachi-auth/account-response";
import { getApiSession } from "@/lib/anidachi-auth/api-session";
import { deferInboxChangedPushToUsers } from "@/lib/anidachi-auth/device-push";
import {
  cleanInviteMessage,
  createRoomInvite,
  listRoomInvites,
} from "@/lib/anidachi-auth/social";
import { readJsonBody, socialErrorResponse } from "@/lib/anidachi-auth/social-routes";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await listRoomInvites(session.userId);
    const response: RoomInvitesResponse = {
      meta: createAccountResponseMeta(),
      ...data,
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
  const parsed = CreateRoomInviteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid invite request" }, { status: 400 });
  }

  try {
    const { invite, created } = await createRoomInvite({
      senderUserId: session.userId,
      clientActionId: parsed.data.clientActionId ?? randomUUID(),
      roomId: parsed.data.roomId,
      groupId: parsed.data.groupId,
      recipientUserIds: parsed.data.recipientUserIds,
      message: cleanInviteMessage(parsed.data.message),
    });
    if (created) {
      const inviteRecipientUserIds = invite.recipients.map(
        (recipient) => recipient.user.userId,
      );
      deferInboxChangedPushToUsers(inviteRecipientUserIds, after);
    }
    const response: CreateRoomInviteResponse = { invite, created };
    return NextResponse.json(response);
  } catch (error) {
    return socialErrorResponse(error);
  }
}
