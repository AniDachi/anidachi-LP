import {
  type AcceptedRoomInviteResponse,
  AcceptedRoomInviteResponseSchema,
  type FriendGroup,
  FriendGroupSchema,
  FriendGroupsResponseSchema,
  FriendListResponseSchema,
  type InviteTargets,
  InviteTargetsSchema,
  type RoomInvite,
  RoomInviteSchema,
  type RoomInvitesResponse,
  RoomInvitesResponseSchema,
} from "@anidachi/protocol";
import { WEB_HTTP_BASE } from "./constants";
import { logDebug } from "./debug-log";
import { createWebsiteRoomHeaders, RoomApiError } from "./room-client";

const SOCIAL_HTTP_MESSAGE_TYPE = "ANIDACHI_SOCIAL_HTTP";
const INVALID_ACCOUNT_RESPONSE_MESSAGE =
  "Account data is temporarily unavailable. Try again.";

interface SocialContractIssue {
  readonly code: string;
  readonly path: readonly PropertyKey[];
}

interface SocialContractSchema<T> {
  safeParse(value: unknown):
    | { success: true; data: T }
    | { success: false; error: { issues: readonly SocialContractIssue[] } };
}

export type {
  AcceptedRoomInviteResponse,
  FriendGroup,
  FriendListItem,
  InviteTargets,
  PublicProfile,
  RoomInvite,
  RoomInvitesResponse,
} from "@anidachi/protocol";

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

function parseSocialContract<T>(
  schema: SocialContractSchema<T>,
  value: unknown,
  responseName: string,
): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  logDebug("social.http", "invalid account response", {
    responseName,
    issues: result.error.issues.map((issue) => ({
      code: issue.code,
      path: issue.path.join("."),
    })),
  });
  throw new RoomApiError(INVALID_ACCOUNT_RESPONSE_MESSAGE, "INVALID_ACCOUNT_RESPONSE");
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

  const friendsBody = parseSocialContract(
    FriendListResponseSchema,
    await friendsResponse.json(),
    "friends",
  );
  const groupsBody = parseSocialContract(
    FriendGroupsResponseSchema,
    await groupsResponse.json(),
    "groups",
  );
  return parseSocialContract(
    InviteTargetsSchema,
    {
      friends: friendsBody.friends,
      groups: groupsBody.groups.filter((group) => !group.archivedAt),
    },
    "invite targets",
  );
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

  return parseSocialContract(RoomInvitesResponseSchema, await response.json(), "invites");
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

  return parseSocialContract(
    RoomInviteSchema,
    responseField(await response.json(), "invite", "invite"),
    "created invite",
  );
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

  return parseSocialContract(
    FriendGroupSchema,
    responseField(await response.json(), "group", "group"),
    "created group",
  );
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

  return parseSocialContract(
    FriendGroupSchema,
    responseField(await response.json(), "group", "group"),
    "updated group",
  );
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

  return parseSocialContract(
    FriendGroupSchema,
    responseField(await response.json(), "group", "group"),
    "group member update",
  );
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

  return parseSocialContract(
    FriendGroupSchema,
    responseField(await response.json(), "group", "group"),
    "group member update",
  );
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

  return parseSocialContract(
    AcceptedRoomInviteResponseSchema,
    await response.json(),
    "accepted invite",
  );
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

  return parseSocialContract(
    RoomInviteSchema,
    responseField(await response.json(), "invite", "invite"),
    "declined invite",
  );
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
  return parseSocialContract(InviteTargetsSchema, response.targets, "invite targets bridge");
}

export async function listRoomInvites(accessToken: string): Promise<RoomInvitesResponse> {
  const response = assertSocialHttpResponse(
    await sendSocialHttpMessage(listInvitesHttpMessage(accessToken)),
  );
  if (!response.ok) throw socialBridgeError(response);
  if (!("invites" in response)) throw new Error("Social bridge response is missing invites");
  return parseSocialContract(RoomInvitesResponseSchema, response.invites, "invites bridge");
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
  return parseSocialContract(RoomInviteSchema, response.invite, "created invite bridge");
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
  return parseSocialContract(FriendGroupSchema, response.group, "created group bridge");
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
  return parseSocialContract(FriendGroupSchema, response.group, "updated group bridge");
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
  return parseSocialContract(FriendGroupSchema, response.group, "group member bridge");
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
  return parseSocialContract(FriendGroupSchema, response.group, "group member bridge");
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
  return parseSocialContract(
    AcceptedRoomInviteResponseSchema,
    response.acceptedInvite,
    "accepted invite bridge",
  );
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
  return parseSocialContract(RoomInviteSchema, response.invite, "declined invite bridge");
}

function responseField(value: unknown, key: string, label: string): unknown {
  if (!value || typeof value !== "object" || !(key in value)) {
    throw new Error(`${label[0]?.toUpperCase()}${label.slice(1)} response is missing ${label}`);
  }
  return (value as Record<string, unknown>)[key];
}
