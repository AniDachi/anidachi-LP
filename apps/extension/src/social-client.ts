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

export interface CreateFriendGroupInput {
  name: string;
}

export interface UpdateFriendGroupInput {
  groupId: string;
  name: string;
}

export interface FriendGroupMemberInput {
  groupId: string;
  userId: string;
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
      command: "create-group";
      accessToken: string;
      input: CreateFriendGroupInput;
    }
  | {
      type: typeof SOCIAL_HTTP_MESSAGE_TYPE;
      command: "update-group";
      accessToken: string;
      input: UpdateFriendGroupInput;
    }
  | {
      type: typeof SOCIAL_HTTP_MESSAGE_TYPE;
      command: "archive-group";
      accessToken: string;
      groupId: string;
    }
  | {
      type: typeof SOCIAL_HTTP_MESSAGE_TYPE;
      command: "add-group-member" | "remove-group-member";
      accessToken: string;
      input: FriendGroupMemberInput;
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
  | { ok: true; group: FriendGroup }
  | { ok: true; archivedGroupId: string }
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

export function createGroupHttpMessage(
  accessToken: string,
  input: CreateFriendGroupInput,
): SocialHttpMessage {
  return {
    type: SOCIAL_HTTP_MESSAGE_TYPE,
    command: "create-group",
    accessToken,
    input,
  };
}

export function updateGroupHttpMessage(
  accessToken: string,
  input: UpdateFriendGroupInput,
): SocialHttpMessage {
  return {
    type: SOCIAL_HTTP_MESSAGE_TYPE,
    command: "update-group",
    accessToken,
    input,
  };
}

export function archiveGroupHttpMessage(
  accessToken: string,
  groupId: string,
): SocialHttpMessage {
  return {
    type: SOCIAL_HTTP_MESSAGE_TYPE,
    command: "archive-group",
    accessToken,
    groupId,
  };
}

export function addGroupMemberHttpMessage(
  accessToken: string,
  input: FriendGroupMemberInput,
): SocialHttpMessage {
  return {
    type: SOCIAL_HTTP_MESSAGE_TYPE,
    command: "add-group-member",
    accessToken,
    input,
  };
}

export function removeGroupMemberHttpMessage(
  accessToken: string,
  input: FriendGroupMemberInput,
): SocialHttpMessage {
  return {
    type: SOCIAL_HTTP_MESSAGE_TYPE,
    command: "remove-group-member",
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
  if (message.command === "create-invite") {
    const input = message.input as Partial<CreateRoomInviteInput> | undefined;
    return (
      typeof input?.roomId === "string" &&
      (input.recipientUserIds === undefined ||
        (Array.isArray(input.recipientUserIds) &&
          input.recipientUserIds.every((item) => typeof item === "string"))) &&
      (input.groupId === undefined || typeof input.groupId === "string")
    );
  }
  if (message.command === "create-group") {
    const input = message.input as Partial<CreateFriendGroupInput> | undefined;
    return typeof input?.name === "string" && Boolean(input.name.trim());
  }
  if (message.command === "update-group") {
    const input = message.input as Partial<UpdateFriendGroupInput> | undefined;
    return (
      typeof input?.groupId === "string" &&
      Boolean(input.groupId.trim()) &&
      typeof input.name === "string" &&
      Boolean(input.name.trim())
    );
  }
  if (message.command === "archive-group") {
    return typeof message.groupId === "string" && Boolean(message.groupId.trim());
  }
  if (message.command === "add-group-member" || message.command === "remove-group-member") {
    const input = message.input as Partial<FriendGroupMemberInput> | undefined;
    return (
      typeof input?.groupId === "string" &&
      Boolean(input.groupId.trim()) &&
      typeof input.userId === "string" &&
      Boolean(input.userId.trim())
    );
  }
  return false;
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

export async function createFriendGroupFromApi(
  accessToken: string,
  input: CreateFriendGroupInput,
): Promise<FriendGroup> {
  logDebug("social.http", "create group request", { webHttpBase: WEB_HTTP_BASE });
  const response = await fetch(new URL("/api/groups", WEB_HTTP_BASE), {
    method: "POST",
    headers: createWebsiteRoomHeaders(accessToken),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw await socialHttpError(response, "Failed to create group");
  }

  const payload = (await response.json()) as { group?: unknown };
  if (typeof payload.group !== "object" || payload.group === null) {
    throw new Error("Group response is missing group");
  }
  return payload.group as FriendGroup;
}

export async function updateFriendGroupFromApi(
  accessToken: string,
  input: UpdateFriendGroupInput,
): Promise<FriendGroup> {
  logDebug("social.http", "update group request", {
    webHttpBase: WEB_HTTP_BASE,
    groupId: input.groupId,
  });
  const response = await fetch(
    new URL(`/api/groups/${encodeURIComponent(input.groupId)}`, WEB_HTTP_BASE),
    {
      method: "PATCH",
      headers: createWebsiteRoomHeaders(accessToken),
      body: JSON.stringify({ name: input.name }),
    },
  );

  if (!response.ok) {
    throw await socialHttpError(response, "Failed to update group");
  }

  const payload = (await response.json()) as { group?: unknown };
  if (typeof payload.group !== "object" || payload.group === null) {
    throw new Error("Group response is missing group");
  }
  return payload.group as FriendGroup;
}

export async function archiveFriendGroupFromApi(
  accessToken: string,
  groupId: string,
): Promise<void> {
  logDebug("social.http", "archive group request", { webHttpBase: WEB_HTTP_BASE, groupId });
  const response = await fetch(
    new URL(`/api/groups/${encodeURIComponent(groupId)}`, WEB_HTTP_BASE),
    {
      method: "DELETE",
      headers: createWebsiteRoomHeaders(accessToken),
    },
  );

  if (!response.ok) {
    throw await socialHttpError(response, "Failed to archive group");
  }
}

export async function addFriendGroupMemberFromApi(
  accessToken: string,
  input: FriendGroupMemberInput,
): Promise<FriendGroup> {
  logDebug("social.http", "add group member request", {
    webHttpBase: WEB_HTTP_BASE,
    groupId: input.groupId,
  });
  const response = await fetch(
    new URL(`/api/groups/${encodeURIComponent(input.groupId)}/members`, WEB_HTTP_BASE),
    {
      method: "POST",
      headers: createWebsiteRoomHeaders(accessToken),
      body: JSON.stringify({ userId: input.userId }),
    },
  );

  if (!response.ok) {
    throw await socialHttpError(response, "Failed to add group member");
  }

  const payload = (await response.json()) as { group?: unknown };
  if (typeof payload.group !== "object" || payload.group === null) {
    throw new Error("Group response is missing group");
  }
  return payload.group as FriendGroup;
}

export async function removeFriendGroupMemberFromApi(
  accessToken: string,
  input: FriendGroupMemberInput,
): Promise<FriendGroup> {
  logDebug("social.http", "remove group member request", {
    webHttpBase: WEB_HTTP_BASE,
    groupId: input.groupId,
    userId: input.userId,
  });
  const response = await fetch(
    new URL(
      `/api/groups/${encodeURIComponent(input.groupId)}/members/${encodeURIComponent(input.userId)}`,
      WEB_HTTP_BASE,
    ),
    {
      method: "DELETE",
      headers: createWebsiteRoomHeaders(accessToken),
    },
  );

  if (!response.ok) {
    throw await socialHttpError(response, "Failed to remove group member");
  }

  const payload = (await response.json()) as { group?: unknown };
  if (typeof payload.group !== "object" || payload.group === null) {
    throw new Error("Group response is missing group");
  }
  return payload.group as FriendGroup;
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
    if (message.command === "create-group") {
      return {
        ok: true,
        group: await createFriendGroupFromApi(message.accessToken, message.input),
      };
    }
    if (message.command === "update-group") {
      return {
        ok: true,
        group: await updateFriendGroupFromApi(message.accessToken, message.input),
      };
    }
    if (message.command === "archive-group") {
      await archiveFriendGroupFromApi(message.accessToken, message.groupId);
      return { ok: true, archivedGroupId: message.groupId };
    }
    if (message.command === "add-group-member") {
      return {
        ok: true,
        group: await addFriendGroupMemberFromApi(message.accessToken, message.input),
      };
    }
    if (message.command === "remove-group-member") {
      return {
        ok: true,
        group: await removeFriendGroupMemberFromApi(message.accessToken, message.input),
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

export async function createFriendGroup(
  accessToken: string,
  input: CreateFriendGroupInput,
): Promise<FriendGroup> {
  const response = assertSocialHttpResponse(
    await sendSocialHttpMessage(createGroupHttpMessage(accessToken, input)),
  );
  if (!response.ok) throw socialBridgeError(response);
  if (!("group" in response)) throw new Error("Social bridge response is missing group");
  return response.group;
}

export async function updateFriendGroup(
  accessToken: string,
  input: UpdateFriendGroupInput,
): Promise<FriendGroup> {
  const response = assertSocialHttpResponse(
    await sendSocialHttpMessage(updateGroupHttpMessage(accessToken, input)),
  );
  if (!response.ok) throw socialBridgeError(response);
  if (!("group" in response)) throw new Error("Social bridge response is missing group");
  return response.group;
}

export async function archiveFriendGroup(
  accessToken: string,
  groupId: string,
): Promise<void> {
  const response = assertSocialHttpResponse(
    await sendSocialHttpMessage(archiveGroupHttpMessage(accessToken, groupId)),
  );
  if (!response.ok) throw socialBridgeError(response);
  if (!("archivedGroupId" in response)) {
    throw new Error("Social bridge response is missing archived group id");
  }
}

export async function addFriendGroupMember(
  accessToken: string,
  input: FriendGroupMemberInput,
): Promise<FriendGroup> {
  const response = assertSocialHttpResponse(
    await sendSocialHttpMessage(addGroupMemberHttpMessage(accessToken, input)),
  );
  if (!response.ok) throw socialBridgeError(response);
  if (!("group" in response)) throw new Error("Social bridge response is missing group");
  return response.group;
}

export async function removeFriendGroupMember(
  accessToken: string,
  input: FriendGroupMemberInput,
): Promise<FriendGroup> {
  const response = assertSocialHttpResponse(
    await sendSocialHttpMessage(removeGroupMemberHttpMessage(accessToken, input)),
  );
  if (!response.ok) throw socialBridgeError(response);
  if (!("group" in response)) throw new Error("Social bridge response is missing group");
  return response.group;
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
