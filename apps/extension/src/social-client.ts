import {
  type AcceptedRoomInviteResponse,
  AcceptedRoomInviteResponseSchema,
  type CreateRoomInviteRequest,
  CreateRoomInviteRequestSchema,
  type FriendGroup,
  FriendGroupSchema,
  FriendGroupsResponseSchema,
  type FriendListItem,
  FriendListItemSchema,
  FriendListResponseSchema,
  type InviteTargets,
  InviteTargetsSchema,
  RecentPeopleResponseSchema,
  type RoomInvite,
  RoomInviteSchema,
  type RoomInvitesResponse,
  RoomInvitesResponseSchema,
  type SocialDirectory,
  SocialDirectorySchema,
} from "@anidachi/protocol";
import { WEB_HTTP_BASE } from "./constants";
import { logDebug } from "./debug-log";
import { createWebsiteRoomHeaders, RoomApiError } from "./room-client";

const SOCIAL_HTTP_MESSAGE_TYPE = "ANIDACHI_SOCIAL_HTTP";
const INVALID_ACCOUNT_RESPONSE_MESSAGE =
  "Account data is temporarily unavailable. Try again.";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  SocialDirectory,
} from "@anidachi/protocol";

export type CreateRoomInviteInput = Omit<CreateRoomInviteRequest, "clientActionId"> & {
  clientActionId: string;
};

export interface CreateFriendGroupInput {
  name: string;
  clientRequestId?: string;
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
      command: "list-social-directory";
      accessToken: string;
    }
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
    }
  | {
      type: typeof SOCIAL_HTTP_MESSAGE_TYPE;
      command: "send-friend-request";
      accessToken: string;
      userId: string;
    }
  | {
      type: typeof SOCIAL_HTTP_MESSAGE_TYPE;
      command: "accept-friend-request" | "decline-friend-request";
      accessToken: string;
      requestId: string;
    };

export type SocialHttpMessageResponse =
  | { ok: true; directory: SocialDirectory }
  | { ok: true; targets: InviteTargets }
  | { ok: true; invite: RoomInvite }
  | { ok: true; group: FriendGroup }
  | { ok: true; archivedGroupId: string }
  | { ok: true; invites: RoomInvitesResponse }
  | { ok: true; acceptedInvite: AcceptedRoomInviteResponse }
  | { ok: true; request: FriendListItem }
  | { ok: false; error: string; code?: string };

export function listSocialDirectoryHttpMessage(accessToken: string): SocialHttpMessage {
  return {
    type: SOCIAL_HTTP_MESSAGE_TYPE,
    command: "list-social-directory",
    accessToken,
  };
}

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

export function sendFriendRequestHttpMessage(
  accessToken: string,
  userId: string,
): SocialHttpMessage {
  return {
    type: SOCIAL_HTTP_MESSAGE_TYPE,
    command: "send-friend-request",
    accessToken,
    userId,
  };
}

export function acceptFriendRequestHttpMessage(
  accessToken: string,
  requestId: string,
): SocialHttpMessage {
  return {
    type: SOCIAL_HTTP_MESSAGE_TYPE,
    command: "accept-friend-request",
    accessToken,
    requestId,
  };
}

export function declineFriendRequestHttpMessage(
  accessToken: string,
  requestId: string,
): SocialHttpMessage {
  return {
    type: SOCIAL_HTTP_MESSAGE_TYPE,
    command: "decline-friend-request",
    accessToken,
    requestId,
  };
}

export function isSocialHttpMessage(value: unknown): value is SocialHttpMessage {
  if (typeof value !== "object" || value === null) return false;
  const message = value as Partial<SocialHttpMessage>;
  if (message.type !== SOCIAL_HTTP_MESSAGE_TYPE || typeof message.accessToken !== "string") {
    return false;
  }
  if (message.command === "list-social-directory" || message.command === "list-invite-targets") {
    return true;
  }
  if (message.command === "list-invites") return true;
  if (message.command === "accept-invite" || message.command === "decline-invite") {
    return typeof message.inviteId === "string" && Boolean(message.inviteId.trim());
  }
  if (message.command === "send-friend-request") {
    return typeof message.userId === "string" && Boolean(message.userId.trim());
  }
  if (message.command === "accept-friend-request" || message.command === "decline-friend-request") {
    return typeof message.requestId === "string" && Boolean(message.requestId.trim());
  }
  if (message.command === "create-invite") {
    const result = CreateRoomInviteRequestSchema.safeParse(message.input);
    return result.success && typeof result.data.clientActionId === "string";
  }
  if (message.command === "create-group") {
    const input = message.input as Partial<CreateFriendGroupInput> | undefined;
    return (
      typeof input?.name === "string" &&
      Boolean(input.name.trim()) &&
      (input.clientRequestId === undefined ||
        (typeof input.clientRequestId === "string" && UUID_PATTERN.test(input.clientRequestId)))
    );
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

async function decodeSocialAccountResponse(response: Response, responseName: string): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    logDebug("social.http", "invalid account response", {
      responseName,
      issues: [{ code: "invalid_json", path: "" }],
    });
    throw new RoomApiError(INVALID_ACCOUNT_RESPONSE_MESSAGE, "INVALID_ACCOUNT_RESPONSE");
  }
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

export async function listSocialDirectoryFromApi(accessToken: string): Promise<SocialDirectory> {
  logDebug("social.http", "list social directory request", { webHttpBase: WEB_HTTP_BASE });
  const [friendsResponse, groupsResponse, recentPeopleResponse] = await Promise.all([
    fetch(new URL("/api/friends", WEB_HTTP_BASE), {
      headers: createWebsiteRoomHeaders(accessToken),
    }),
    fetch(new URL("/api/groups", WEB_HTTP_BASE), {
      headers: createWebsiteRoomHeaders(accessToken),
    }),
    fetch(new URL("/api/recent-people", WEB_HTTP_BASE), {
      headers: createWebsiteRoomHeaders(accessToken),
    }),
  ]);

  if (!friendsResponse.ok) {
    throw await socialHttpError(friendsResponse, "Failed to load friends");
  }
  if (!groupsResponse.ok) {
    throw await socialHttpError(groupsResponse, "Failed to load groups");
  }
  if (!recentPeopleResponse.ok) {
    throw await socialHttpError(recentPeopleResponse, "Failed to load recent people");
  }

  const [friendsBody, groupsBody, recentPeopleBody] = [
    parseSocialContract(
      FriendListResponseSchema,
      await decodeSocialAccountResponse(friendsResponse, "friends"),
      "friends",
    ),
    parseSocialContract(
      FriendGroupsResponseSchema,
      await decodeSocialAccountResponse(groupsResponse, "groups"),
      "groups",
    ),
    parseSocialContract(
      RecentPeopleResponseSchema,
      await decodeSocialAccountResponse(recentPeopleResponse, "recent people"),
      "recent people",
    ),
  ];
  return parseSocialContract(
    SocialDirectorySchema,
    {
      friends: friendsBody.friends,
      incomingRequests: friendsBody.incomingRequests,
      outgoingRequests: friendsBody.outgoingRequests,
      groups: groupsBody.groups.filter((group) => !group.archivedAt),
      recentPeople: recentPeopleBody.people,
    },
    "social directory",
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
    clientActionId: input.clientActionId,
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
    responseField(await response.json(), "invite"),
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
    responseField(await decodeSocialAccountResponse(response, "created group"), "group"),
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
    responseField(await decodeSocialAccountResponse(response, "updated group"), "group"),
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
    responseField(await decodeSocialAccountResponse(response, "group member update"), "group"),
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
    responseField(await decodeSocialAccountResponse(response, "group member update"), "group"),
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
    responseField(await response.json(), "invite"),
    "declined invite",
  );
}

export async function sendFriendRequestFromApi(
  accessToken: string,
  userId: string,
): Promise<FriendListItem> {
  logDebug("social.http", "send friend request", { webHttpBase: WEB_HTTP_BASE, userId });
  const response = await fetch(new URL("/api/friends/requests", WEB_HTTP_BASE), {
    method: "POST",
    headers: createWebsiteRoomHeaders(accessToken),
    body: JSON.stringify({ userId }),
  });

  if (!response.ok) {
    throw await socialHttpError(response, "Failed to send friend request");
  }

  return parseSocialContract(
    FriendListItemSchema,
    responseField(await decodeSocialAccountResponse(response, "friend request"), "request"),
    "sent friend request",
  );
}

export async function acceptFriendRequestFromApi(
  accessToken: string,
  requestId: string,
): Promise<FriendListItem> {
  logDebug("social.http", "accept friend request", { webHttpBase: WEB_HTTP_BASE, requestId });
  const response = await fetch(
    new URL(`/api/friends/requests/${encodeURIComponent(requestId)}/accept`, WEB_HTTP_BASE),
    {
      method: "POST",
      headers: createWebsiteRoomHeaders(accessToken),
    },
  );

  if (!response.ok) {
    throw await socialHttpError(response, "Failed to accept friend request");
  }

  return parseSocialContract(
    FriendListItemSchema,
    responseField(await decodeSocialAccountResponse(response, "friend request"), "friendship"),
    "accepted friend request",
  );
}

export async function declineFriendRequestFromApi(
  accessToken: string,
  requestId: string,
): Promise<FriendListItem> {
  logDebug("social.http", "decline friend request", { webHttpBase: WEB_HTTP_BASE, requestId });
  const response = await fetch(
    new URL(`/api/friends/requests/${encodeURIComponent(requestId)}/decline`, WEB_HTTP_BASE),
    {
      method: "POST",
      headers: createWebsiteRoomHeaders(accessToken),
    },
  );

  if (!response.ok) {
    throw await socialHttpError(response, "Failed to decline friend request");
  }

  return parseSocialContract(
    FriendListItemSchema,
    responseField(await decodeSocialAccountResponse(response, "friend request"), "friendship"),
    "declined friend request",
  );
}

export async function handleSocialHttpMessage(
  message: SocialHttpMessage,
): Promise<SocialHttpMessageResponse> {
  try {
    if (message.command === "list-social-directory") {
      return { ok: true, directory: await listSocialDirectoryFromApi(message.accessToken) };
    }
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
    if (message.command === "send-friend-request") {
      return { ok: true, request: await sendFriendRequestFromApi(message.accessToken, message.userId) };
    }
    if (message.command === "accept-friend-request") {
      return {
        ok: true,
        request: await acceptFriendRequestFromApi(message.accessToken, message.requestId),
      };
    }
    if (message.command === "decline-friend-request") {
      return {
        ok: true,
        request: await declineFriendRequestFromApi(message.accessToken, message.requestId),
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

export async function listSocialDirectory(accessToken: string): Promise<SocialDirectory> {
  const response = assertSocialHttpResponse(
    await sendSocialHttpMessage(listSocialDirectoryHttpMessage(accessToken)),
  );
  if (!response.ok) throw socialBridgeError(response);
  if (!("directory" in response)) throw new Error("Social bridge response is missing directory");
  return parseSocialContract(SocialDirectorySchema, response.directory, "social directory bridge");
}

export async function sendFriendRequest(accessToken: string, userId: string): Promise<FriendListItem> {
  const response = assertSocialHttpResponse(
    await sendSocialHttpMessage(sendFriendRequestHttpMessage(accessToken, userId)),
  );
  if (!response.ok) throw socialBridgeError(response);
  if (!("request" in response)) throw new Error("Social bridge response is missing friend request");
  return parseSocialContract(FriendListItemSchema, response.request, "friend request bridge");
}

export async function acceptFriendRequest(
  accessToken: string,
  requestId: string,
): Promise<FriendListItem> {
  const response = assertSocialHttpResponse(
    await sendSocialHttpMessage(acceptFriendRequestHttpMessage(accessToken, requestId)),
  );
  if (!response.ok) throw socialBridgeError(response);
  if (!("request" in response)) throw new Error("Social bridge response is missing friend request");
  return parseSocialContract(FriendListItemSchema, response.request, "friend request bridge");
}

export async function declineFriendRequest(
  accessToken: string,
  requestId: string,
): Promise<FriendListItem> {
  const response = assertSocialHttpResponse(
    await sendSocialHttpMessage(declineFriendRequestHttpMessage(accessToken, requestId)),
  );
  if (!response.ok) throw socialBridgeError(response);
  if (!("request" in response)) throw new Error("Social bridge response is missing friend request");
  return parseSocialContract(FriendListItemSchema, response.request, "friend request bridge");
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

function responseField(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || !(key in value)) return undefined;
  return (value as Record<string, unknown>)[key];
}
