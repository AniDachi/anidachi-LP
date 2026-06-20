import { db, getRoomById, getUserById, type UserRow } from "./db";
import { getPlanEntitlements } from "./plan-entitlements";

const UNIQUE_VIOLATION = "23505";
const HANDLE_PATTERN = /^[a-z0-9_]{3,24}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type FriendshipStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "blocked"
  | "removed";

export type ProfileRow = {
  user_id: string;
  handle: string | null;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type FriendshipRow = {
  id: string;
  requester_user_id: string;
  addressee_user_id: string;
  status: FriendshipStatus;
  blocked_by_user_id: string | null;
  requested_at: string;
  responded_at: string | null;
  updated_at: string;
};

export type RecentPeopleHiddenRow = {
  user_id: string;
  hidden_user_id: string;
  hidden_at: string;
};

export type FriendGroupRow = {
  id: string;
  owner_user_id: string;
  name: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FriendGroupMemberRow = {
  group_id: string;
  friend_user_id: string;
  added_at: string;
};

export type InviteTargetKind = "direct" | "group";
export type InviteRecipientStatus = "pending" | "accepted" | "declined" | "expired";

export type RoomInviteRow = {
  id: string;
  room_id: string;
  sender_user_id: string;
  target_kind: InviteTargetKind;
  target_group_id: string | null;
  message: string | null;
  room_title: string | null;
  source_url: string | null;
  video_fingerprint: string | null;
  created_at: string;
  expires_at: string;
};

export type RoomInviteRecipientRow = {
  invite_id: string;
  recipient_user_id: string;
  status: InviteRecipientStatus;
  created_at: string;
  updated_at: string;
  responded_at: string | null;
};

export type PublicProfile = {
  userId: string;
  handle: string | null;
  displayName: string;
  avatarUrl: string | null;
};

export type FriendListItem = {
  friendshipId: string;
  user: PublicProfile;
  status: FriendshipStatus;
  direction: "incoming" | "outgoing" | "mutual" | "blocked-by-me" | "blocked-me";
  requestedAt: string;
  respondedAt: string | null;
  updatedAt: string;
};

export type RecentPerson = {
  user: PublicProfile;
  lastWatchedAt: string;
  sharedRoomCount: number;
  relationshipStatus: FriendshipStatus | "none";
};

export type FriendGroup = {
  id: string;
  name: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  members: Array<{
    user: PublicProfile;
    addedAt: string;
  }>;
};

export type RoomInvite = {
  id: string;
  roomId: string;
  sender: PublicProfile;
  targetKind: InviteTargetKind;
  targetGroupId: string | null;
  message: string | null;
  roomTitle: string | null;
  sourceUrl: string | null;
  videoFingerprint: string | null;
  createdAt: string;
  expiresAt: string;
  recipients: Array<{
    user: PublicProfile;
    status: InviteRecipientStatus;
    updatedAt: string;
    respondedAt: string | null;
  }>;
};

export function normalizeHandle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  return HANDLE_PATTERN.test(normalized) ? normalized : null;
}

export function cleanDisplayName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) return null;
  return cleaned.slice(0, 80);
}

export function cleanGroupName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) return null;
  return cleaned.slice(0, 80);
}

export function cleanInviteMessage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (!cleaned) return null;
  return cleaned.slice(0, 180);
}

export function friendshipPairKey(userA: string, userB: string): [string, string] {
  return userA < userB ? [userA, userB] : [userB, userA];
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function assertUuid(value: string, label: string): void {
  if (!isUuid(value)) throw new SocialApiError(400, `Invalid ${label}`);
}

export function publicProfileFromRows(
  userId: string,
  profile: ProfileRow | null | undefined,
  user: Pick<UserRow, "display_name" | "avatar_url"> | null | undefined
): PublicProfile {
  return {
    userId,
    handle: profile?.handle ?? null,
    displayName: profile?.display_name ?? user?.display_name ?? "AniDachi user",
    avatarUrl: profile?.avatar_url ?? user?.avatar_url ?? null,
  };
}

function otherUserId(viewerUserId: string, friendship: FriendshipRow): string {
  return friendship.requester_user_id === viewerUserId
    ? friendship.addressee_user_id
    : friendship.requester_user_id;
}

function directionFor(viewerUserId: string, friendship: FriendshipRow): FriendListItem["direction"] {
  if (friendship.status === "accepted") return "mutual";
  if (friendship.status === "blocked") {
    return friendship.blocked_by_user_id === viewerUserId ? "blocked-by-me" : "blocked-me";
  }
  return friendship.requester_user_id === viewerUserId ? "outgoing" : "incoming";
}

async function getProfilesByUserIds(userIds: string[]): Promise<Map<string, ProfileRow>> {
  if (userIds.length === 0) return new Map();
  const { data, error } = await db()
    .from("profiles")
    .select("*")
    .in("user_id", Array.from(new Set(userIds)));
  if (error) throw new Error(`Failed to load profiles: ${error.message}`);
  return new Map(((data as ProfileRow[] | null) ?? []).map((row) => [row.user_id, row]));
}

async function getUsersByIds(userIds: string[]): Promise<Map<string, UserRow>> {
  if (userIds.length === 0) return new Map();
  const { data, error } = await db()
    .from("users")
    .select("*")
    .in("id", Array.from(new Set(userIds)));
  if (error) throw new Error(`Failed to load users: ${error.message}`);
  return new Map(((data as UserRow[] | null) ?? []).map((row) => [row.id, row]));
}

export async function ensureProfileForUser(userId: string): Promise<ProfileRow | null> {
  const user = await getUserById(userId);
  if (!user) return null;

  const { data, error } = await db()
    .from("profiles")
    .upsert(
      {
        user_id: user.id,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();
  if (error) throw new Error(`Failed to ensure profile: ${error.message}`);
  return data as ProfileRow;
}

export async function updateOwnProfile(params: {
  userId: string;
  displayName?: string;
  handle?: string | null;
  avatarUrl?: string | null;
}): Promise<PublicProfile> {
  await ensureProfileForUser(params.userId);

  const profileUpdates: Partial<ProfileRow> = {
    updated_at: new Date().toISOString(),
  };
  const userUpdates: Partial<Pick<UserRow, "display_name" | "avatar_url">> = {};

  if (params.displayName !== undefined) {
    profileUpdates.display_name = params.displayName;
    userUpdates.display_name = params.displayName;
  }
  if (params.handle !== undefined) profileUpdates.handle = params.handle;
  if (params.avatarUrl !== undefined) {
    profileUpdates.avatar_url = params.avatarUrl;
    userUpdates.avatar_url = params.avatarUrl;
  }

  const { data, error } = await db()
    .from("profiles")
    .update(profileUpdates)
    .eq("user_id", params.userId)
    .select()
    .single();
  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      throw new SocialApiError(409, "Handle is already taken");
    }
    throw new Error(`Failed to update profile: ${error.message}`);
  }

  if (Object.keys(userUpdates).length > 0) {
    const { error: userError } = await db()
      .from("users")
      .update(userUpdates)
      .eq("id", params.userId);
    if (userError) throw new Error(`Failed to update user profile: ${userError.message}`);
  }

  return publicProfileFromRows(params.userId, data as ProfileRow, null);
}

async function getFriendshipBetween(
  userA: string,
  userB: string
): Promise<FriendshipRow | null> {
  const { data, error } = await db()
    .from("friendships")
    .select("*")
    .or(
      `and(requester_user_id.eq.${userA},addressee_user_id.eq.${userB}),and(requester_user_id.eq.${userB},addressee_user_id.eq.${userA})`
    )
    .maybeSingle();
  if (error) throw new Error(`Failed to load friendship: ${error.message}`);
  return (data as FriendshipRow | null) ?? null;
}

export class SocialApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export async function listFriends(viewerUserId: string): Promise<{
  friends: FriendListItem[];
  incomingRequests: FriendListItem[];
  outgoingRequests: FriendListItem[];
  blocked: FriendListItem[];
}> {
  await ensureProfileForUser(viewerUserId);

  const { data, error } = await db()
    .from("friendships")
    .select("*")
    .or(`requester_user_id.eq.${viewerUserId},addressee_user_id.eq.${viewerUserId}`)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Failed to list friendships: ${error.message}`);

  const friendships = (data as FriendshipRow[] | null) ?? [];
  const otherIds = friendships.map((friendship) => otherUserId(viewerUserId, friendship));
  const [profiles, users] = await Promise.all([
    getProfilesByUserIds(otherIds),
    getUsersByIds(otherIds),
  ]);

  const toItem = (friendship: FriendshipRow): FriendListItem => {
    const userId = otherUserId(viewerUserId, friendship);
    return {
      friendshipId: friendship.id,
      user: publicProfileFromRows(userId, profiles.get(userId), users.get(userId)),
      status: friendship.status,
      direction: directionFor(viewerUserId, friendship),
      requestedAt: friendship.requested_at,
      respondedAt: friendship.responded_at,
      updatedAt: friendship.updated_at,
    };
  };

  return {
    friends: friendships.filter((row) => row.status === "accepted").map(toItem),
    incomingRequests: friendships
      .filter((row) => row.status === "pending" && row.addressee_user_id === viewerUserId)
      .map(toItem),
    outgoingRequests: friendships
      .filter((row) => row.status === "pending" && row.requester_user_id === viewerUserId)
      .map(toItem),
    blocked: friendships.filter((row) => row.status === "blocked").map(toItem),
  };
}

export async function sendFriendRequest(params: {
  requesterUserId: string;
  addresseeUserId: string;
}): Promise<FriendListItem> {
  assertUuid(params.requesterUserId, "requesterUserId");
  assertUuid(params.addresseeUserId, "addresseeUserId");
  if (params.requesterUserId === params.addresseeUserId) {
    throw new SocialApiError(400, "Cannot send a friend request to yourself");
  }

  const [requester, addressee] = await Promise.all([
    ensureProfileForUser(params.requesterUserId),
    ensureProfileForUser(params.addresseeUserId),
  ]);
  if (!requester || !addressee) throw new SocialApiError(404, "User not found");

  const existing = await getFriendshipBetween(
    params.requesterUserId,
    params.addresseeUserId
  );

  if (existing?.status === "blocked") {
    throw new SocialApiError(403, "This relationship is blocked");
  }
  if (existing?.status === "accepted") {
    return itemForFriendship(params.requesterUserId, existing);
  }
  if (
    existing?.status === "pending" &&
    existing.addressee_user_id === params.requesterUserId
  ) {
    return acceptFriendRequest(params.requesterUserId, existing.id);
  }
  if (existing?.status === "pending") {
    return itemForFriendship(params.requesterUserId, existing);
  }

  const now = new Date().toISOString();
  const payload = {
    requester_user_id: params.requesterUserId,
    addressee_user_id: params.addresseeUserId,
    status: "pending" as FriendshipStatus,
    blocked_by_user_id: null,
    requested_at: now,
    responded_at: null,
    updated_at: now,
  };

  const query = existing
    ? db().from("friendships").update(payload).eq("id", existing.id)
    : db().from("friendships").insert(payload);

  const { data, error } = await query.select().single();
  if (error) throw new Error(`Failed to send friend request: ${error.message}`);
  return itemForFriendship(params.requesterUserId, data as FriendshipRow);
}

export async function acceptFriendRequest(
  viewerUserId: string,
  friendshipId: string
): Promise<FriendListItem> {
  assertUuid(viewerUserId, "viewerUserId");
  assertUuid(friendshipId, "requestId");
  const friendship = await getFriendshipById(friendshipId);
  if (!friendship) throw new SocialApiError(404, "Friend request not found");
  if (friendship.addressee_user_id !== viewerUserId) {
    throw new SocialApiError(403, "Only the addressee can accept this request");
  }
  if (friendship.status !== "pending") {
    throw new SocialApiError(409, "Friend request is not pending");
  }

  const { data, error } = await db()
    .from("friendships")
    .update({
      status: "accepted",
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", friendshipId)
    .select()
    .single();
  if (error) throw new Error(`Failed to accept friend request: ${error.message}`);
  return itemForFriendship(viewerUserId, data as FriendshipRow);
}

export async function declineFriendRequest(
  viewerUserId: string,
  friendshipId: string
): Promise<FriendListItem> {
  assertUuid(viewerUserId, "viewerUserId");
  assertUuid(friendshipId, "requestId");
  const friendship = await getFriendshipById(friendshipId);
  if (!friendship) throw new SocialApiError(404, "Friend request not found");
  if (friendship.addressee_user_id !== viewerUserId) {
    throw new SocialApiError(403, "Only the addressee can decline this request");
  }
  if (friendship.status !== "pending") {
    throw new SocialApiError(409, "Friend request is not pending");
  }

  const { data, error } = await db()
    .from("friendships")
    .update({
      status: "declined",
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", friendshipId)
    .select()
    .single();
  if (error) throw new Error(`Failed to decline friend request: ${error.message}`);
  return itemForFriendship(viewerUserId, data as FriendshipRow);
}

export async function removeFriendship(
  viewerUserId: string,
  otherUserIdValue: string
): Promise<void> {
  assertUuid(viewerUserId, "viewerUserId");
  assertUuid(otherUserIdValue, "userId");
  const friendship = await getFriendshipBetween(viewerUserId, otherUserIdValue);
  if (!friendship) return;
  if (
    friendship.requester_user_id !== viewerUserId &&
    friendship.addressee_user_id !== viewerUserId
  ) {
    throw new SocialApiError(403, "Cannot remove this relationship");
  }
  if (friendship.status === "blocked") {
    throw new SocialApiError(409, "Blocked relationships cannot be removed here");
  }

  const { error } = await db()
    .from("friendships")
    .update({
      status: "removed",
      blocked_by_user_id: null,
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", friendship.id);
  if (error) throw new Error(`Failed to remove friendship: ${error.message}`);
}

export async function blockUser(
  viewerUserId: string,
  blockedUserId: string
): Promise<FriendListItem> {
  assertUuid(viewerUserId, "viewerUserId");
  assertUuid(blockedUserId, "userId");
  if (viewerUserId === blockedUserId) {
    throw new SocialApiError(400, "Cannot block yourself");
  }
  const [viewer, target] = await Promise.all([
    ensureProfileForUser(viewerUserId),
    ensureProfileForUser(blockedUserId),
  ]);
  if (!viewer || !target) throw new SocialApiError(404, "User not found");

  const existing = await getFriendshipBetween(viewerUserId, blockedUserId);
  const now = new Date().toISOString();
  const payload = {
    requester_user_id: viewerUserId,
    addressee_user_id: blockedUserId,
    status: "blocked" as FriendshipStatus,
    blocked_by_user_id: viewerUserId,
    responded_at: now,
    updated_at: now,
  };
  const query = existing
    ? db().from("friendships").update(payload).eq("id", existing.id)
    : db().from("friendships").insert({ ...payload, requested_at: now });

  const { data, error } = await query.select().single();
  if (error) throw new Error(`Failed to block user: ${error.message}`);
  return itemForFriendship(viewerUserId, data as FriendshipRow);
}

export async function hideRecentPerson(
  viewerUserId: string,
  hiddenUserId: string
): Promise<void> {
  assertUuid(viewerUserId, "viewerUserId");
  assertUuid(hiddenUserId, "userId");
  if (viewerUserId === hiddenUserId) {
    throw new SocialApiError(400, "Cannot hide yourself");
  }
  const { error } = await db()
    .from("recent_people_hidden")
    .upsert(
      {
        user_id: viewerUserId,
        hidden_user_id: hiddenUserId,
        hidden_at: new Date().toISOString(),
      },
      { onConflict: "user_id,hidden_user_id" }
    );
  if (error) throw new Error(`Failed to hide recent person: ${error.message}`);
}

export async function listRecentPeople(viewerUserId: string): Promise<RecentPerson[]> {
  const { data: memberships, error: membershipError } = await db()
    .from("room_members")
    .select("room_id, joined_at")
    .eq("user_id", viewerUserId)
    .order("joined_at", { ascending: false })
    .limit(100);
  if (membershipError) {
    throw new Error(`Failed to load viewer room memberships: ${membershipError.message}`);
  }

  const roomIds = Array.from(
    new Set(((memberships as { room_id: string }[] | null) ?? []).map((row) => row.room_id))
  );
  if (roomIds.length === 0) return [];

  const [{ data: otherMembers, error: memberError }, hiddenRows, relationships] =
    await Promise.all([
      db()
        .from("room_members")
        .select("room_id, user_id, joined_at")
        .in("room_id", roomIds)
        .neq("user_id", viewerUserId),
      listHiddenRecentPeople(viewerUserId),
      listFriendshipsForViewer(viewerUserId),
    ]);
  if (memberError) throw new Error(`Failed to load recent people: ${memberError.message}`);

  const hidden = new Set(hiddenRows.map((row) => row.hidden_user_id));
  const relationshipByUserId = new Map(
    relationships.map((relationship) => [otherUserId(viewerUserId, relationship), relationship])
  );

  const aggregate = new Map<string, { lastWatchedAt: string; roomIds: Set<string> }>();
  for (const member of (otherMembers as { room_id: string; user_id: string; joined_at: string }[] | null) ?? []) {
    if (hidden.has(member.user_id)) continue;
    const relationship = relationshipByUserId.get(member.user_id);
    if (relationship?.status === "blocked") continue;
    const current = aggregate.get(member.user_id);
    if (!current) {
      aggregate.set(member.user_id, {
        lastWatchedAt: member.joined_at,
        roomIds: new Set([member.room_id]),
      });
      continue;
    }
    current.roomIds.add(member.room_id);
    if (member.joined_at > current.lastWatchedAt) current.lastWatchedAt = member.joined_at;
  }

  const userIds = Array.from(aggregate.keys());
  const [profiles, users] = await Promise.all([
    getProfilesByUserIds(userIds),
    getUsersByIds(userIds),
  ]);

  return userIds
    .map((userId) => {
      const relationship = relationshipByUserId.get(userId);
      const recent = aggregate.get(userId);
      if (!recent) return null;
      return {
        user: publicProfileFromRows(userId, profiles.get(userId), users.get(userId)),
        lastWatchedAt: recent.lastWatchedAt,
        sharedRoomCount: recent.roomIds.size,
        relationshipStatus: relationship?.status ?? "none",
      } satisfies RecentPerson;
    })
    .filter((person): person is RecentPerson => person !== null)
    .sort((a, b) => b.lastWatchedAt.localeCompare(a.lastWatchedAt))
    .slice(0, 50);
}

export async function listFriendGroups(ownerUserId: string): Promise<FriendGroup[]> {
  assertUuid(ownerUserId, "ownerUserId");
  await archiveGroupsOverLimit(ownerUserId);

  const { data: groupsData, error: groupsError } = await db()
    .from("friend_groups")
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .order("archived_at", { ascending: true, nullsFirst: true })
    .order("updated_at", { ascending: false });
  if (groupsError) throw new Error(`Failed to list groups: ${groupsError.message}`);

  const groups = (groupsData as FriendGroupRow[] | null) ?? [];
  if (groups.length === 0) return [];

  const groupIds = groups.map((group) => group.id);
  const { data: memberData, error: memberError } = await db()
    .from("friend_group_members")
    .select("*")
    .in("group_id", groupIds);
  if (memberError) throw new Error(`Failed to list group members: ${memberError.message}`);

  const members = (memberData as FriendGroupMemberRow[] | null) ?? [];
  const memberUserIds = members.map((member) => member.friend_user_id);
  const [profiles, users] = await Promise.all([
    getProfilesByUserIds(memberUserIds),
    getUsersByIds(memberUserIds),
  ]);

  const membersByGroupId = new Map<string, FriendGroup["members"]>();
  for (const member of members) {
    const list = membersByGroupId.get(member.group_id) ?? [];
    list.push({
      user: publicProfileFromRows(
        member.friend_user_id,
        profiles.get(member.friend_user_id),
        users.get(member.friend_user_id)
      ),
      addedAt: member.added_at,
    });
    membersByGroupId.set(member.group_id, list);
  }

  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    archivedAt: group.archived_at,
    createdAt: group.created_at,
    updatedAt: group.updated_at,
    members: (membersByGroupId.get(group.id) ?? []).sort((a, b) =>
      a.user.displayName.localeCompare(b.user.displayName)
    ),
  }));
}

export async function createFriendGroup(params: {
  ownerUserId: string;
  name: string;
}): Promise<FriendGroup> {
  assertUuid(params.ownerUserId, "ownerUserId");
  const user = await getUserById(params.ownerUserId);
  if (!user) throw new SocialApiError(404, "User not found");

  await archiveGroupsOverLimit(params.ownerUserId);
  const activeCount = await countActiveGroups(params.ownerUserId);
  const maxGroups = getPlanEntitlements(user.plan).account.maxOwnedGroups;
  if (activeCount >= maxGroups) {
    throw new SocialApiError(403, `Group limit reached for ${user.plan}`);
  }

  const { data, error } = await db()
    .from("friend_groups")
    .insert({
      owner_user_id: params.ownerUserId,
      name: params.name,
    })
    .select()
    .single();
  if (error) throw new Error(`Failed to create group: ${error.message}`);

  return {
    id: (data as FriendGroupRow).id,
    name: (data as FriendGroupRow).name,
    archivedAt: (data as FriendGroupRow).archived_at,
    createdAt: (data as FriendGroupRow).created_at,
    updatedAt: (data as FriendGroupRow).updated_at,
    members: [],
  };
}

export async function updateFriendGroup(params: {
  ownerUserId: string;
  groupId: string;
  name: string;
}): Promise<FriendGroup> {
  assertUuid(params.ownerUserId, "ownerUserId");
  assertUuid(params.groupId, "groupId");

  const group = await getOwnedGroup(params.ownerUserId, params.groupId);
  if (!group) throw new SocialApiError(404, "Group not found");
  if (group.archived_at) throw new SocialApiError(409, "Archived groups cannot be edited");

  const { error } = await db()
    .from("friend_groups")
    .update({
      name: params.name,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.groupId)
    .eq("owner_user_id", params.ownerUserId);
  if (error) throw new Error(`Failed to update group: ${error.message}`);

  const groups = await listFriendGroups(params.ownerUserId);
  const updated = groups.find((item) => item.id === params.groupId);
  if (!updated) throw new Error("Updated group disappeared");
  return updated;
}

export async function archiveFriendGroup(
  ownerUserId: string,
  groupId: string
): Promise<void> {
  assertUuid(ownerUserId, "ownerUserId");
  assertUuid(groupId, "groupId");
  const { error } = await db()
    .from("friend_groups")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", groupId)
    .eq("owner_user_id", ownerUserId);
  if (error) throw new Error(`Failed to archive group: ${error.message}`);
}

export async function addFriendGroupMember(params: {
  ownerUserId: string;
  groupId: string;
  friendUserId: string;
}): Promise<FriendGroup> {
  assertUuid(params.ownerUserId, "ownerUserId");
  assertUuid(params.groupId, "groupId");
  assertUuid(params.friendUserId, "userId");
  if (params.ownerUserId === params.friendUserId) {
    throw new SocialApiError(400, "Cannot add yourself to a friend group");
  }

  const [group, friendship] = await Promise.all([
    getOwnedGroup(params.ownerUserId, params.groupId),
    getFriendshipBetween(params.ownerUserId, params.friendUserId),
  ]);
  if (!group) throw new SocialApiError(404, "Group not found");
  if (group.archived_at) throw new SocialApiError(409, "Archived groups cannot be edited");
  if (friendship?.status !== "accepted") {
    throw new SocialApiError(403, "Only accepted friends can be added to a group");
  }

  const { error } = await db()
    .from("friend_group_members")
    .upsert(
      {
        group_id: params.groupId,
        friend_user_id: params.friendUserId,
        added_at: new Date().toISOString(),
      },
      { onConflict: "group_id,friend_user_id" }
    );
  if (error) throw new Error(`Failed to add group member: ${error.message}`);

  const groups = await listFriendGroups(params.ownerUserId);
  const updated = groups.find((item) => item.id === params.groupId);
  if (!updated) throw new Error("Updated group disappeared");
  return updated;
}

export async function removeFriendGroupMember(params: {
  ownerUserId: string;
  groupId: string;
  friendUserId: string;
}): Promise<FriendGroup> {
  assertUuid(params.ownerUserId, "ownerUserId");
  assertUuid(params.groupId, "groupId");
  assertUuid(params.friendUserId, "userId");

  const group = await getOwnedGroup(params.ownerUserId, params.groupId);
  if (!group) throw new SocialApiError(404, "Group not found");
  if (group.archived_at) throw new SocialApiError(409, "Archived groups cannot be edited");

  const { error } = await db()
    .from("friend_group_members")
    .delete()
    .eq("group_id", params.groupId)
    .eq("friend_user_id", params.friendUserId);
  if (error) throw new Error(`Failed to remove group member: ${error.message}`);

  const groups = await listFriendGroups(params.ownerUserId);
  const updated = groups.find((item) => item.id === params.groupId);
  if (!updated) throw new Error("Updated group disappeared");
  return updated;
}

export async function createRoomInvite(params: {
  senderUserId: string;
  roomId: string;
  recipientUserIds?: string[];
  groupId?: string;
  message?: string | null;
}): Promise<RoomInvite> {
  assertUuid(params.senderUserId, "senderUserId");
  const room = await getRoomById(params.roomId);
  if (!room) throw new SocialApiError(404, "Room not found");
  if (room.host_user_id !== params.senderUserId) {
    throw new SocialApiError(403, "Only the host can invite people to this room");
  }
  if (room.status === "ended") {
    throw new SocialApiError(409, "Ended rooms cannot receive new invites");
  }

  const hasDirectTargets = Boolean(params.recipientUserIds?.length);
  const hasGroupTarget = Boolean(params.groupId);
  if (hasDirectTargets === hasGroupTarget) {
    throw new SocialApiError(400, "Provide either recipientUserIds or groupId");
  }

  const targetKind: InviteTargetKind = hasGroupTarget ? "group" : "direct";
  const recipientUserIds = hasGroupTarget
    ? await recipientIdsForGroupInvite(params.senderUserId, params.groupId ?? "")
    : await recipientIdsForDirectInvite(params.senderUserId, params.recipientUserIds ?? []);
  if (recipientUserIds.length === 0) {
    throw new SocialApiError(400, "Invite has no eligible recipients");
  }

  const { data: inviteData, error: inviteError } = await db()
    .from("room_invites")
    .insert({
      room_id: room.room_id,
      sender_user_id: params.senderUserId,
      target_kind: targetKind,
      target_group_id: params.groupId ?? null,
      message: params.message ?? null,
      room_title: room.title,
      source_url: room.source_url,
      video_fingerprint: room.video_fingerprint,
    })
    .select()
    .single();
  if (inviteError) throw new Error(`Failed to create invite: ${inviteError.message}`);

  const invite = inviteData as RoomInviteRow;
  const { data: recipientsData, error: recipientsError } = await db()
    .from("room_invite_recipients")
    .insert(
      recipientUserIds.map((recipientUserId) => ({
        invite_id: invite.id,
        recipient_user_id: recipientUserId,
      }))
    )
    .select();
  if (recipientsError) {
    throw new Error(`Failed to create invite recipients: ${recipientsError.message}`);
  }

  return inviteView(invite, (recipientsData as RoomInviteRecipientRow[] | null) ?? []);
}

export async function listRoomInvites(viewerUserId: string): Promise<{
  inbox: RoomInvite[];
  sent: RoomInvite[];
}> {
  assertUuid(viewerUserId, "viewerUserId");

  const { data: inboxRecipientsData, error: inboxError } = await db()
    .from("room_invite_recipients")
    .select("*")
    .eq("recipient_user_id", viewerUserId)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (inboxError) throw new Error(`Failed to list invite inbox: ${inboxError.message}`);

  const inboxRecipients = (inboxRecipientsData as RoomInviteRecipientRow[] | null) ?? [];
  const inboxInviteIds = Array.from(new Set(inboxRecipients.map((row) => row.invite_id)));

  const { data: inboxInvitesData, error: inboxInvitesError } = inboxInviteIds.length
    ? await db().from("room_invites").select("*").in("id", inboxInviteIds)
    : { data: [], error: null };
  if (inboxInvitesError) {
    throw new Error(`Failed to list inbox invite details: ${inboxInvitesError.message}`);
  }

  const { data: sentInvitesData, error: sentError } = await db()
    .from("room_invites")
    .select("*")
    .eq("sender_user_id", viewerUserId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (sentError) throw new Error(`Failed to list sent invites: ${sentError.message}`);

  const sentInvites = (sentInvitesData as RoomInviteRow[] | null) ?? [];
  const sentInviteIds = sentInvites.map((row) => row.id);
  const { data: sentRecipientsData, error: sentRecipientsError } = sentInviteIds.length
    ? await db().from("room_invite_recipients").select("*").in("invite_id", sentInviteIds)
    : { data: [], error: null };
  if (sentRecipientsError) {
    throw new Error(`Failed to list sent invite recipients: ${sentRecipientsError.message}`);
  }

  return {
    inbox: await inviteViews(
      (inboxInvitesData as RoomInviteRow[] | null) ?? [],
      inboxRecipients
    ),
    sent: await inviteViews(sentInvites, (sentRecipientsData as RoomInviteRecipientRow[] | null) ?? []),
  };
}

export async function acceptRoomInvite(
  viewerUserId: string,
  inviteId: string
): Promise<RoomInvite> {
  assertUuid(viewerUserId, "viewerUserId");
  assertUuid(inviteId, "inviteId");

  const { invite, recipient } = await loadInviteForRecipient(viewerUserId, inviteId);
  await assertInviteCanBeAccepted(viewerUserId, invite);
  if (recipient.status === "accepted") {
    return inviteView(invite, [recipient]);
  }
  if (recipient.status !== "pending") {
    throw new SocialApiError(409, "Invite is not pending");
  }

  const { data, error } = await db()
    .from("room_invite_recipients")
    .update({
      status: "accepted",
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("invite_id", inviteId)
    .eq("recipient_user_id", viewerUserId)
    .select()
    .single();
  if (error) throw new Error(`Failed to accept invite: ${error.message}`);
  return inviteView(invite, [data as RoomInviteRecipientRow]);
}

export async function declineRoomInvite(
  viewerUserId: string,
  inviteId: string
): Promise<RoomInvite> {
  assertUuid(viewerUserId, "viewerUserId");
  assertUuid(inviteId, "inviteId");

  const { invite, recipient } = await loadInviteForRecipient(viewerUserId, inviteId);
  if (recipient.status === "declined" || recipient.status === "expired") {
    return inviteView(invite, [recipient]);
  }
  if (recipient.status === "accepted") {
    throw new SocialApiError(409, "Accepted invites cannot be declined");
  }

  const status: InviteRecipientStatus = inviteExpired(invite) ? "expired" : "declined";
  const { data, error } = await db()
    .from("room_invite_recipients")
    .update({
      status,
      responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("invite_id", inviteId)
    .eq("recipient_user_id", viewerUserId)
    .select()
    .single();
  if (error) throw new Error(`Failed to decline invite: ${error.message}`);
  return inviteView(invite, [data as RoomInviteRecipientRow]);
}

async function recipientIdsForDirectInvite(
  senderUserId: string,
  recipientUserIds: string[]
): Promise<string[]> {
  const uniqueRecipientIds = Array.from(
    new Set(recipientUserIds.map((id) => id.trim()).filter(Boolean))
  );
  if (uniqueRecipientIds.length === 0) return [];

  const relationships = await listFriendshipsForViewer(senderUserId);
  const relationshipByUserId = new Map(
    relationships.map((relationship) => [otherUserId(senderUserId, relationship), relationship])
  );

  const acceptedRecipients: string[] = [];
  for (const recipientUserId of uniqueRecipientIds) {
    assertUuid(recipientUserId, "recipientUserId");
    if (recipientUserId === senderUserId) {
      throw new SocialApiError(400, "Cannot invite yourself");
    }
    const relationship = relationshipByUserId.get(recipientUserId);
    if (relationship?.status !== "accepted") {
      throw new SocialApiError(403, "Direct invites can target accepted friends only");
    }
    acceptedRecipients.push(recipientUserId);
  }

  return acceptedRecipients;
}

async function recipientIdsForGroupInvite(
  ownerUserId: string,
  groupId: string
): Promise<string[]> {
  assertUuid(groupId, "groupId");
  const group = await getOwnedGroup(ownerUserId, groupId);
  if (!group) throw new SocialApiError(404, "Group not found");
  if (group.archived_at) throw new SocialApiError(409, "Archived groups cannot be invited");

  const { data, error } = await db()
    .from("friend_group_members")
    .select("*")
    .eq("group_id", groupId);
  if (error) throw new Error(`Failed to load group invite members: ${error.message}`);

  const memberIds = ((data as FriendGroupMemberRow[] | null) ?? []).map(
    (member) => member.friend_user_id
  );
  if (memberIds.length === 0) return [];

  const relationships = await listFriendshipsForViewer(ownerUserId);
  const relationshipByUserId = new Map(
    relationships.map((relationship) => [otherUserId(ownerUserId, relationship), relationship])
  );

  return memberIds.filter((memberId) => relationshipByUserId.get(memberId)?.status === "accepted");
}

function inviteExpired(invite: RoomInviteRow): boolean {
  return new Date(invite.expires_at).getTime() <= Date.now();
}

async function assertInviteCanBeAccepted(
  viewerUserId: string,
  invite: RoomInviteRow
): Promise<void> {
  if (inviteExpired(invite)) {
    await db()
      .from("room_invite_recipients")
      .update({
        status: "expired",
        updated_at: new Date().toISOString(),
      })
      .eq("invite_id", invite.id)
      .eq("recipient_user_id", viewerUserId)
      .eq("status", "pending");
    throw new SocialApiError(410, "Invite has expired");
  }

  const friendship = await getFriendshipBetween(viewerUserId, invite.sender_user_id);
  if (friendship?.status !== "accepted") {
    throw new SocialApiError(403, "This invite is no longer available");
  }
}

async function loadInviteForRecipient(
  viewerUserId: string,
  inviteId: string
): Promise<{ invite: RoomInviteRow; recipient: RoomInviteRecipientRow }> {
  const { data: recipientData, error: recipientError } = await db()
    .from("room_invite_recipients")
    .select("*")
    .eq("invite_id", inviteId)
    .eq("recipient_user_id", viewerUserId)
    .maybeSingle();
  if (recipientError) throw new Error(`Failed to load invite recipient: ${recipientError.message}`);
  if (!recipientData) throw new SocialApiError(404, "Invite not found");

  const { data: inviteData, error: inviteError } = await db()
    .from("room_invites")
    .select("*")
    .eq("id", inviteId)
    .maybeSingle();
  if (inviteError) throw new Error(`Failed to load invite: ${inviteError.message}`);
  if (!inviteData) throw new SocialApiError(404, "Invite not found");

  return {
    invite: inviteData as RoomInviteRow,
    recipient: recipientData as RoomInviteRecipientRow,
  };
}

async function inviteViews(
  invites: RoomInviteRow[],
  recipients: RoomInviteRecipientRow[]
): Promise<RoomInvite[]> {
  const recipientsByInviteId = new Map<string, RoomInviteRecipientRow[]>();
  for (const recipient of recipients) {
    const list = recipientsByInviteId.get(recipient.invite_id) ?? [];
    list.push(recipient);
    recipientsByInviteId.set(recipient.invite_id, list);
  }

  return Promise.all(
    invites.map((invite) => inviteView(invite, recipientsByInviteId.get(invite.id) ?? []))
  );
}

async function inviteView(
  invite: RoomInviteRow,
  recipients: RoomInviteRecipientRow[]
): Promise<RoomInvite> {
  const userIds = [
    invite.sender_user_id,
    ...recipients.map((recipient) => recipient.recipient_user_id),
  ];
  const [profiles, users] = await Promise.all([
    getProfilesByUserIds(userIds),
    getUsersByIds(userIds),
  ]);

  return {
    id: invite.id,
    roomId: invite.room_id,
    sender: publicProfileFromRows(
      invite.sender_user_id,
      profiles.get(invite.sender_user_id),
      users.get(invite.sender_user_id)
    ),
    targetKind: invite.target_kind,
    targetGroupId: invite.target_group_id,
    message: invite.message,
    roomTitle: invite.room_title,
    sourceUrl: invite.source_url,
    videoFingerprint: invite.video_fingerprint,
    createdAt: invite.created_at,
    expiresAt: invite.expires_at,
    recipients: recipients.map((recipient) => ({
      user: publicProfileFromRows(
        recipient.recipient_user_id,
        profiles.get(recipient.recipient_user_id),
        users.get(recipient.recipient_user_id)
      ),
      status: recipient.status,
      updatedAt: recipient.updated_at,
      respondedAt: recipient.responded_at,
    })),
  };
}

async function listHiddenRecentPeople(userId: string): Promise<RecentPeopleHiddenRow[]> {
  const { data, error } = await db()
    .from("recent_people_hidden")
    .select("*")
    .eq("user_id", userId);
  if (error) throw new Error(`Failed to load hidden recent people: ${error.message}`);
  return (data as RecentPeopleHiddenRow[] | null) ?? [];
}

async function getOwnedGroup(
  ownerUserId: string,
  groupId: string
): Promise<FriendGroupRow | null> {
  const { data, error } = await db()
    .from("friend_groups")
    .select("*")
    .eq("id", groupId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load group: ${error.message}`);
  return (data as FriendGroupRow | null) ?? null;
}

async function countActiveGroups(ownerUserId: string): Promise<number> {
  const { count, error } = await db()
    .from("friend_groups")
    .select("id", { count: "exact", head: true })
    .eq("owner_user_id", ownerUserId)
    .is("archived_at", null);
  if (error) throw new Error(`Failed to count active groups: ${error.message}`);
  return count ?? 0;
}

async function archiveGroupsOverLimit(ownerUserId: string): Promise<void> {
  const user = await getUserById(ownerUserId);
  if (!user) return;
  const maxGroups = getPlanEntitlements(user.plan).account.maxOwnedGroups;

  const { data, error } = await db()
    .from("friend_groups")
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Failed to load active groups: ${error.message}`);

  const activeGroups = (data as FriendGroupRow[] | null) ?? [];
  if (activeGroups.length <= maxGroups) return;

  const groupsToArchive = activeGroups.slice(maxGroups);
  const { error: archiveError } = await db()
    .from("friend_groups")
    .update({
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in("id", groupsToArchive.map((group) => group.id));
  if (archiveError) {
    throw new Error(`Failed to archive over-limit groups: ${archiveError.message}`);
  }
}

async function listFriendshipsForViewer(userId: string): Promise<FriendshipRow[]> {
  const { data, error } = await db()
    .from("friendships")
    .select("*")
    .or(`requester_user_id.eq.${userId},addressee_user_id.eq.${userId}`);
  if (error) throw new Error(`Failed to load relationships: ${error.message}`);
  return (data as FriendshipRow[] | null) ?? [];
}

async function getFriendshipById(friendshipId: string): Promise<FriendshipRow | null> {
  const { data, error } = await db()
    .from("friendships")
    .select("*")
    .eq("id", friendshipId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load friendship: ${error.message}`);
  return (data as FriendshipRow | null) ?? null;
}

async function itemForFriendship(
  viewerUserId: string,
  friendship: FriendshipRow
): Promise<FriendListItem> {
  const targetUserId = otherUserId(viewerUserId, friendship);
  const [profiles, users] = await Promise.all([
    getProfilesByUserIds([targetUserId]),
    getUsersByIds([targetUserId]),
  ]);
  return {
    friendshipId: friendship.id,
    user: publicProfileFromRows(
      targetUserId,
      profiles.get(targetUserId),
      users.get(targetUserId)
    ),
    status: friendship.status,
    direction: directionFor(viewerUserId, friendship),
    requestedAt: friendship.requested_at,
    respondedAt: friendship.responded_at,
    updatedAt: friendship.updated_at,
  };
}
