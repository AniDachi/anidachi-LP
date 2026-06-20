import { WEB_HTTP_BASE } from "./constants";
import { logDebug } from "./debug-log";
import { createWebsiteRoomHeaders, RoomApiError } from "./room-client";

const SOCIAL_HTTP_MESSAGE_TYPE = "ANIDACHI_SOCIAL_HTTP";

export interface PublicProfile {
  userId: string;
  handle: string | null;
  displayName: string;
  avatarUrl: string | null;
}

export interface FriendListItem {
  friendshipId: string;
  user: PublicProfile;
  status: string;
  direction: string;
  requestedAt: string;
  respondedAt: string | null;
  updatedAt: string;
}

export interface FriendGroup {
  id: string;
  name: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  members: Array<{
    user: PublicProfile;
    addedAt: string;
  }>;
}

export interface InviteTargets {
  friends: FriendListItem[];
  groups: FriendGroup[];
}

export interface CreateRoomInviteInput {
  roomId: string;
  recipientUserIds?: string[];
  groupId?: string;
}

export interface RoomInvite {
  id: string;
  roomId: string;
  targetKind: "direct" | "group";
  targetGroupId: string | null;
  expiresAt: string;
  recipients: Array<{
    user: PublicProfile;
    status: string;
  }>;
}

export type SocialHttpMessage =
  | {
      type: typeof SOCIAL_HTTP_MESSAGE_TYPE;
      command: "list-invite-targets";
      accessToken: string;
    }
  | {
      type: typeof SOCIAL_HTTP_MESSAGE_TYPE;
      command: "create-invite";
      accessToken: string;
      input: CreateRoomInviteInput;
    };

export type SocialHttpMessageResponse =
  | { ok: true; targets: InviteTargets }
  | { ok: true; invite: RoomInvite }
  | { ok: false; error: string; code?: string };

export function listInviteTargetsHttpMessage(accessToken: string): SocialHttpMessage {
  return {
    type: SOCIAL_HTTP_MESSAGE_TYPE,
    command: "list-invite-targets",
    accessToken,
  };
}

export function createInviteHttpMessage(
  accessToken: string,
  input: CreateRoomInviteInput,
): SocialHttpMessage {
  return {
    type: SOCIAL_HTTP_MESSAGE_TYPE,
    command: "create-invite",
    accessToken,
    input,
  };
}

export function isSocialHttpMessage(value: unknown): value is SocialHttpMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Partial<SocialHttpMessage>;
  if (message.type !== SOCIAL_HTTP_MESSAGE_TYPE || typeof message.accessToken !== "string") {
    return false;
  }
  if (message.command === "list-invite-targets") return true;
  if (message.command !== "create-invite") return false;
  const input = message.input as Partial<CreateRoomInviteInput> | undefined;
  return (
    typeof input?.roomId === "string" &&
    (input.recipientUserIds === undefined ||
      (Array.isArray(input.recipientUserIds) &&
        input.recipientUserIds.every((item) => typeof item === "string"))) &&
    (input.groupId === undefined || typeof input.groupId === "string")
  );
}

async function socialHttpError(response: Response, fallback: string): Promise<RoomApiError> {
  const body = (await response.json().catch(() => null)) as {
    error?: unknown;
    code?: unknown;
    message?: unknown;
  } | null;
  const detail =
    (typeof body?.message === "string" && body.message) ||
    (typeof body?.error === "string" && body.error) ||
    (typeof body?.code === "string" && body.code) ||
    fallback;
  return new RoomApiError(
    `${detail} (${response.status})`,
    typeof body?.code === "string" ? body.code : undefined,
  );
}

export async function listInviteTargetsFromApi(accessToken: string): Promise<InviteTargets> {
  logDebug("social.http", "list invite targets request", { webHttpBase: WEB_HTTP_BASE });
  const [friendsResponse, groupsResponse] = await Promise.all([
    fetch(new URL("/api/friends", WEB_HTTP_BASE), {
      headers: createWebsiteRoomHeaders(accessToken),
    }),
    fetch(new URL("/api/groups", WEB_HTTP_BASE), {
      headers: createWebsiteRoomHeaders(accessToken),
    }),
  ]);

  if (!friendsResponse.ok) {
    throw await socialHttpError(friendsResponse, "Failed to load friends");
  }
  if (!groupsResponse.ok) {
    throw await socialHttpError(groupsResponse, "Failed to load groups");
  }

  const friendsBody = (await friendsResponse.json()) as { friends?: unknown };
  const groupsBody = (await groupsResponse.json()) as { groups?: unknown };
  const friends = Array.isArray(friendsBody.friends)
    ? (friendsBody.friends as FriendListItem[])
    : [];
  const groups = Array.isArray(groupsBody.groups)
    ? (groupsBody.groups as FriendGroup[]).filter((group) => !group.archivedAt)
    : [];
  return { friends, groups };
}

export async function createRoomInviteFromApi(
  accessToken: string,
  input: CreateRoomInviteInput,
): Promise<RoomInvite> {
  logDebug("social.http", "create invite request", {
    webHttpBase: WEB_HTTP_BASE,
    roomId: input.roomId,
    groupId: input.groupId ?? null,
    recipientCount: input.recipientUserIds?.length ?? 0,
  });
  const response = await fetch(new URL("/api/invites", WEB_HTTP_BASE), {
    method: "POST",
    headers: createWebsiteRoomHeaders(accessToken),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw await socialHttpError(response, "Failed to create invite");
  }

  const payload = (await response.json()) as { invite?: unknown };
  if (typeof payload.invite !== "object" || payload.invite === null) {
    throw new Error("Invite response is missing invite");
  }
  return payload.invite as RoomInvite;
}

export async function handleSocialHttpMessage(
  message: SocialHttpMessage,
): Promise<SocialHttpMessageResponse> {
  try {
    if (message.command === "list-invite-targets") {
      return { ok: true, targets: await listInviteTargetsFromApi(message.accessToken) };
    }
    return {
      ok: true,
      invite: await createRoomInviteFromApi(message.accessToken, message.input),
    };
  } catch (error) {
    if (error instanceof RoomApiError) {
      return { ok: false, error: error.message, code: error.code };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Social request failed",
    };
  }
}

async function sendSocialHttpMessage(
  message: SocialHttpMessage,
): Promise<SocialHttpMessageResponse> {
  return chrome.runtime.sendMessage(message);
}

function assertSocialHttpResponse(
  response: SocialHttpMessageResponse | null | undefined,
): SocialHttpMessageResponse {
  if (!response || typeof response !== "object") {
    throw new Error("Social bridge did not return a response");
  }
  return response;
}

function socialBridgeError(response: Extract<SocialHttpMessageResponse, { ok: false }>): Error {
  return new RoomApiError(response.error, response.code);
}

export async function listInviteTargets(accessToken: string): Promise<InviteTargets> {
  const response = assertSocialHttpResponse(
    await sendSocialHttpMessage(listInviteTargetsHttpMessage(accessToken)),
  );
  if (!response.ok) throw socialBridgeError(response);
  if (!("targets" in response)) throw new Error("Social bridge response is missing targets");
  return response.targets;
}

export async function createRoomInvite(
  accessToken: string,
  input: CreateRoomInviteInput,
): Promise<RoomInvite> {
  const response = assertSocialHttpResponse(
    await sendSocialHttpMessage(createInviteHttpMessage(accessToken, input)),
  );
  if (!response.ok) throw socialBridgeError(response);
  if (!("invite" in response)) throw new Error("Social bridge response is missing invite");
  return response.invite;
}
