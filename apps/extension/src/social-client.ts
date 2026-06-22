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
  sender: PublicProfile;
  targetKind: "direct" | "group";
  targetGroupId: string | null;
  message: string | null;
  roomTitle: string | null;
  sourceUrl: string | null;
  videoFingerprint: string | null;
  createdAt: string;
  expiresAt: string;
  recipients: Array<{
    user: PublicProfile;
    status: string;
    updatedAt: string;
    respondedAt: string | null;
  }>;
}

export interface RoomInvitesResponse {
  inbox: RoomInvite[];
  sent: RoomInvite[];
}

export interface AcceptedRoomInviteResponse {
  invite: RoomInvite;
  roomId: string;
  joinUrl: string;
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
    }
  | {
      type: typeof SOCIAL_HTTP_MESSAGE_TYPE;
      command: "list-invites";
      accessToken: string;
    }
  | {
      type: typeof SOCIAL_HTTP_MESSAGE_TYPE;
      command: "accept-invite" | "decline-invite";
      accessToken: string;
      inviteId: string;
    };

export type SocialHttpMessageResponse =
  | { ok: true; targets: InviteTargets }
  | { ok: true; invite: RoomInvite }
  | { ok: true; invites: RoomInvitesResponse }
  | { ok: true; acceptedInvite: AcceptedRoomInviteResponse }
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

export function listInvitesHttpMessage(accessToken: string): SocialHttpMessage {
  return {
    type: SOCIAL_HTTP_MESSAGE_TYPE,
    command: "list-invites",
    accessToken,
  };
}

export function acceptInviteHttpMessage(
  accessToken: string,
  inviteId: string,
): SocialHttpMessage {
  return {
    type: SOCIAL_HTTP_MESSAGE_TYPE,
    command: "accept-invite",
    accessToken,
    inviteId,
  };
}

export function declineInviteHttpMessage(
  accessToken: string,
  inviteId: string,
): SocialHttpMessage {
  return {
    type: SOCIAL_HTTP_MESSAGE_TYPE,
    command: "decline-invite",
    accessToken,
    inviteId,
  };
}

export function isSocialHttpMessage(value: unknown): value is SocialHttpMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Partial<SocialHttpMessage>;
  if (message.type !== SOCIAL_HTTP_MESSAGE_TYPE || typeof message.accessToken !== "string") {
    return false;
  }
  if (message.command === "list-invite-targets") return true;
  if (message.command === "list-invites") return true;
  if (message.command === "accept-invite" || message.command === "decline-invite") {
    return typeof message.inviteId === "string" && Boolean(message.inviteId.trim());
  }
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

export async function listRoomInvitesFromApi(
  accessToken: string,
): Promise<RoomInvitesResponse> {
  logDebug("social.http", "list invites request", { webHttpBase: WEB_HTTP_BASE });
  const response = await fetch(new URL("/api/invites", WEB_HTTP_BASE), {
    headers: createWebsiteRoomHeaders(accessToken),
  });

  if (!response.ok) {
    throw await socialHttpError(response, "Failed to load invites");
  }

  const payload = (await response.json()) as Partial<RoomInvitesResponse>;
  return {
    inbox: Array.isArray(payload.inbox) ? (payload.inbox as RoomInvite[]) : [],
    sent: Array.isArray(payload.sent) ? (payload.sent as RoomInvite[]) : [],
  };
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

export async function acceptRoomInviteFromApi(
  accessToken: string,
  inviteId: string,
): Promise<AcceptedRoomInviteResponse> {
  logDebug("social.http", "accept invite request", { webHttpBase: WEB_HTTP_BASE, inviteId });
  const response = await fetch(
    new URL(`/api/invites/${encodeURIComponent(inviteId)}/accept`, WEB_HTTP_BASE),
    {
      method: "POST",
      headers: createWebsiteRoomHeaders(accessToken),
    },
  );

  if (!response.ok) {
    throw await socialHttpError(response, "Failed to accept invite");
  }

  return (await response.json()) as AcceptedRoomInviteResponse;
}

export async function declineRoomInviteFromApi(
  accessToken: string,
  inviteId: string,
): Promise<RoomInvite> {
  logDebug("social.http", "decline invite request", { webHttpBase: WEB_HTTP_BASE, inviteId });
  const response = await fetch(
    new URL(`/api/invites/${encodeURIComponent(inviteId)}/decline`, WEB_HTTP_BASE),
    {
      method: "POST",
      headers: createWebsiteRoomHeaders(accessToken),
    },
  );

  if (!response.ok) {
    throw await socialHttpError(response, "Failed to decline invite");
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
    if (message.command === "list-invites") {
      return { ok: true, invites: await listRoomInvitesFromApi(message.accessToken) };
    }
    if (message.command === "accept-invite") {
      return {
        ok: true,
        acceptedInvite: await acceptRoomInviteFromApi(message.accessToken, message.inviteId),
      };
    }
    if (message.command === "decline-invite") {
      return {
        ok: true,
        invite: await declineRoomInviteFromApi(message.accessToken, message.inviteId),
      };
    }
    if (message.command === "create-invite") {
      return {
        ok: true,
        invite: await createRoomInviteFromApi(message.accessToken, message.input),
      };
    }
    return { ok: false, error: "Unsupported social command" };
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

export async function listRoomInvites(accessToken: string): Promise<RoomInvitesResponse> {
  const response = assertSocialHttpResponse(
    await sendSocialHttpMessage(listInvitesHttpMessage(accessToken)),
  );
  if (!response.ok) throw socialBridgeError(response);
  if (!("invites" in response)) throw new Error("Social bridge response is missing invites");
  return response.invites;
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

export async function acceptRoomInvite(
  accessToken: string,
  inviteId: string,
): Promise<AcceptedRoomInviteResponse> {
  const response = assertSocialHttpResponse(
    await sendSocialHttpMessage(acceptInviteHttpMessage(accessToken, inviteId)),
  );
  if (!response.ok) throw socialBridgeError(response);
  if (!("acceptedInvite" in response)) {
    throw new Error("Social bridge response is missing accepted invite");
  }
  return response.acceptedInvite;
}

export async function declineRoomInvite(
  accessToken: string,
  inviteId: string,
): Promise<RoomInvite> {
  const response = assertSocialHttpResponse(
    await sendSocialHttpMessage(declineInviteHttpMessage(accessToken, inviteId)),
  );
  if (!response.ok) throw socialBridgeError(response);
  if (!("invite" in response)) throw new Error("Social bridge response is missing invite");
  return response.invite;
}
