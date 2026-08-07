import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanFriendInviteToken,
  cleanDisplayName,
  cleanGroupName,
  cleanInviteMessage,
  deriveRecentPeopleEvidence,
  friendRequestConflictResolution,
  friendshipPairKey,
  isRecentRelationshipEligible,
  isUuid,
  normalizeHandle,
  publicProfileFromRows,
  resolveFriendGroupCreateOutcome,
  resolveFriendRequestTransitionReread,
  SocialApiError,
  type FriendshipRow,
} from "./social";

const VIEWER_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_ID = "00000000-0000-4000-8000-000000000002";
const LOBBY_ONLY_ID = "00000000-0000-4000-8000-000000000003";
const FRIENDSHIP_ID = "00000000-0000-4000-8000-000000000004";

test("friend invite tokens accept only URL-safe opaque values", () => {
  assert.equal(
    cleanFriendInviteToken(" abcdefghijklmnopqrstuvwxyzABCD_123-xyz "),
    "abcdefghijklmnopqrstuvwxyzABCD_123-xyz"
  );
  assert.equal(cleanFriendInviteToken("short"), null);
  assert.equal(cleanFriendInviteToken("../not-a-token"), null);
});

test("social handles normalize to safe lowercase ids", () => {
  assert.equal(normalizeHandle("  Ani_Fan_7 "), "ani_fan_7");
  assert.equal(normalizeHandle("ab"), null);
  assert.equal(normalizeHandle("has-dash"), null);
  assert.equal(normalizeHandle("way_too_long_handle_for_profile"), null);
});

test("display names trim whitespace and keep a sane maximum", () => {
  assert.equal(cleanDisplayName("  Yuki   Tanaka "), "Yuki Tanaka");
  assert.equal(cleanDisplayName("   "), null);
  assert.equal(cleanDisplayName("x".repeat(100)), "x".repeat(80));
});

test("group names trim whitespace and keep a sane maximum", () => {
  assert.equal(cleanGroupName("  Friday   Anime  "), "Friday Anime");
  assert.equal(cleanGroupName("   "), null);
  assert.equal(cleanGroupName("x".repeat(100)), "x".repeat(80));
});

test("invite messages trim whitespace and keep a sane maximum", () => {
  assert.equal(cleanInviteMessage("  Join   now  "), "Join now");
  assert.equal(cleanInviteMessage("   "), null);
  assert.equal(cleanInviteMessage("x".repeat(220)), "x".repeat(180));
});

test("friendship pair key is stable for unordered pairs", () => {
  assert.deepEqual(friendshipPairKey("user_b", "user_a"), ["user_a", "user_b"]);
  assert.deepEqual(friendshipPairKey("user_a", "user_b"), ["user_a", "user_b"]);
});

test("recent people include only relationships eligible for discovery", () => {
  assert.equal(isRecentRelationshipEligible(undefined), true);
  assert.equal(isRecentRelationshipEligible("declined"), true);
  assert.equal(isRecentRelationshipEligible("removed"), true);
  assert.equal(isRecentRelationshipEligible("pending"), false);
  assert.equal(isRecentRelationshipEligible("accepted"), false);
  assert.equal(isRecentRelationshipEligible("blocked"), false);
});

test("recent people require matching room-backed checkpoints and exclude lobby-only membership", () => {
  const evidence = deriveRecentPeopleEvidence(VIEWER_ID, [
    checkpoint("session-a", VIEWER_ID, "room-a", "2026-08-08T10:00:00.000Z"),
    checkpoint("session-a", OTHER_ID, "room-a", "2026-08-08T10:02:00.000Z"),
    checkpoint("session-b", VIEWER_ID, "room-b", "2026-08-08T11:00:00.000Z"),
    checkpoint("session-b", OTHER_ID, "room-b", "2026-08-08T11:01:00.000Z"),
    checkpoint("session-c", OTHER_ID, "room-c", "2026-08-08T12:00:00.000Z"),
    checkpoint("session-lobby", LOBBY_ONLY_ID, "room-lobby", "2026-08-08T13:00:00.000Z"),
  ]);

  assert.deepEqual(evidence, [
    {
      userId: OTHER_ID,
      lastWatchedAt: "2026-08-08T11:01:00.000Z",
      sharedRoomCount: 2,
    },
  ]);
});

test("recent people count a shared room once across repeated watch sessions", () => {
  const evidence = deriveRecentPeopleEvidence(VIEWER_ID, [
    checkpoint("session-a", VIEWER_ID, "room-a", "2026-08-08T10:00:00.000Z"),
    checkpoint("session-a", OTHER_ID, "room-a", "2026-08-08T10:01:00.000Z"),
    checkpoint("session-b", VIEWER_ID, "room-a", "2026-08-08T12:00:00.000Z"),
    checkpoint("session-b", OTHER_ID, "room-a", "2026-08-08T12:01:00.000Z"),
  ]);

  assert.deepEqual(evidence, [
    {
      userId: OTHER_ID,
      lastWatchedAt: "2026-08-08T12:01:00.000Z",
      sharedRoomCount: 1,
    },
  ]);
});

test("friend request conflict resolution returns canonical duplicate state and accepts reciprocal pending", () => {
  assert.equal(
    friendRequestConflictResolution(VIEWER_ID, friendship({ requester_user_id: VIEWER_ID })),
    "return-current",
  );
  assert.equal(
    friendRequestConflictResolution(
      VIEWER_ID,
      friendship({ requester_user_id: OTHER_ID, addressee_user_id: VIEWER_ID }),
    ),
    "accept-reciprocal",
  );
  assert.equal(
    friendRequestConflictResolution(VIEWER_ID, friendship({ status: "accepted" })),
    "return-current",
  );
  assert.equal(
    friendRequestConflictResolution(VIEWER_ID, friendship({ status: "blocked" })),
    "blocked",
  );
});

test("friend request transition reread is idempotent for canonical completed states", () => {
  const accepted = friendship({ status: "accepted" });
  const declined = friendship({ status: "declined" });
  assert.equal(resolveFriendRequestTransitionReread(OTHER_ID, accepted), accepted);
  assert.equal(resolveFriendRequestTransitionReread(OTHER_ID, declined), declined);
});

test("friend request transition reread preserves authorization and not-found semantics", () => {
  assert.throws(
    () => resolveFriendRequestTransitionReread(VIEWER_ID, friendship()),
    (error) => error instanceof SocialApiError && error.status === 403,
  );
  assert.throws(
    () => resolveFriendRequestTransitionReread(OTHER_ID, null),
    (error) => error instanceof SocialApiError && error.status === 404,
  );
});

test("atomic group creation accepts canonical created and idempotent existing outcomes", () => {
  const created = atomicGroupOutcome("created");
  const existing = atomicGroupOutcome("existing");
  assert.equal(resolveFriendGroupCreateOutcome(created, "free").id, FRIENDSHIP_ID);
  assert.equal(resolveFriendGroupCreateOutcome(existing, "free").name, "Friday anime");
});

test("atomic group creation maps a committed plan-limit outcome to the public error", () => {
  assert.throws(
    () => resolveFriendGroupCreateOutcome(atomicGroupOutcome("limit_reached"), "free"),
    (error) => error instanceof SocialApiError && error.status === 403,
  );
});

test("social APIs validate UUID-shaped ids before hitting Supabase", () => {
  assert.equal(isUuid("3f0f56ec-a97f-4f1f-a648-e0f1034d75d0"), true);
  assert.equal(isUuid("not-a-user-id"), false);
});

test("public profiles never expose email and fall back to user display fields", () => {
  assert.deepEqual(
    publicProfileFromRows(
      "u1",
      null,
      { display_name: "Fallback Name", avatar_url: "https://cdn.example/avatar.png" }
    ),
    {
      userId: "u1",
      handle: null,
      displayName: "Fallback Name",
      avatarUrl: "https://cdn.example/avatar.png",
    }
  );
});

function checkpoint(
  sessionId: string,
  userId: string,
  roomId: string,
  observedAt: string,
) {
  return {
    session_id: sessionId,
    user_id: userId,
    room_id: roomId,
    observed_at: observedAt,
  };
}

function friendship(overrides: Partial<FriendshipRow> = {}): FriendshipRow {
  return {
    id: FRIENDSHIP_ID,
    requester_user_id: VIEWER_ID,
    addressee_user_id: OTHER_ID,
    status: "pending",
    blocked_by_user_id: null,
    requested_at: "2026-08-08T10:00:00.000Z",
    responded_at: null,
    updated_at: "2026-08-08T10:00:00.000Z",
    ...overrides,
  };
}

function atomicGroupOutcome(outcome: "created" | "existing" | "limit_reached") {
  const hasGroup = outcome !== "limit_reached";
  return {
    outcome,
    group_id: hasGroup ? FRIENDSHIP_ID : null,
    group_owner_user_id: hasGroup ? VIEWER_ID : null,
    group_name: hasGroup ? "Friday anime" : null,
    group_archived_at: null,
    group_created_at: hasGroup ? "2026-08-08T10:00:00.000Z" : null,
    group_updated_at: hasGroup ? "2026-08-08T10:00:00.000Z" : null,
  };
}
