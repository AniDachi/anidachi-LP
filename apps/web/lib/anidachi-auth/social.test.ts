import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  cleanFriendInviteToken,
  cleanDisplayName,
  cleanGroupName,
  cleanInviteMessage,
  friendRequestConflictResolution,
  friendshipPairKey,
  isRecentRelationshipEligible,
  isUuid,
  normalizeHandle,
  publicProfileFromRows,
  roomInviteRecipientLifecycleStatus,
  resolveFriendGroupCreateOutcome,
  resolveFriendRequestTransitionReread,
  resolveRoomInviteCreateOutcome,
  resolveRoomInviteResponseOutcome,
  roomInviteCreateError,
  SocialApiError,
  type FriendshipRow,
  type RoomInviteResponseOutcomeRow,
} from "./social";

const VIEWER_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_ID = "00000000-0000-4000-8000-000000000002";
const FRIENDSHIP_ID = "00000000-0000-4000-8000-000000000004";
const INVITE_ID = "00000000-0000-4000-8000-000000000005";

const WATCH_HISTORY_V2_MIGRATION_URL = new URL(
  "../../supabase/migrations/20260814010000_watch_history_v2_foundation.sql",
  import.meta.url,
);
const SOCIAL_SOURCE_URL = new URL("./social.ts", import.meta.url);
const INVITES_CLIENT_SOURCE_URL = new URL(
  "../../app/account/invites/invites-client.tsx",
  import.meta.url,
);
const ACCOUNT_PAGE_SOURCE_URL = new URL("../../app/account/page.tsx", import.meta.url);

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

test("watch history v2 recent-person evidence is pair-owned and requires two participant writes", () => {
  let sql = "";
  try {
    sql = readFileSync(WATCH_HISTORY_V2_MIGRATION_URL, "utf8")
      .replace(/--.*$/gm, " ")
      .replace(/\s+/g, " ")
      .toLowerCase();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const evidenceTable = sql.match(
    /create table public\.recent_people_evidence \([\s\S]*?\);/,
  )?.[0];
  assert.ok(evidenceTable);
  assert.match(evidenceTable, /primary key \(user_id, other_user_id\)/);
  assert.doesNotMatch(evidenceTable, /shared_room_count|room_generation|source_generation/);

  const applyFunction = sql.match(
    /create or replace function public\.apply_watch_progress_v2\b[\s\S]*?\$\$[\s\S]*?\$\$\s*;/,
  )?.[0];
  assert.ok(applyFunction);
  assert.match(applyFunction, /other_participant\.user_id <> p_user_id/);
  assert.match(
    applyFunction,
    /values \(p_user_id, other_user_id_value\), \(other_user_id_value, p_user_id\)/,
  );
  assert.match(
    applyFunction,
    /order by directional_pair\.user_id, directional_pair\.other_user_id/,
  );
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
  assert.equal(resolveFriendRequestTransitionReread(OTHER_ID, accepted, "accepted"), accepted);
  assert.equal(resolveFriendRequestTransitionReread(OTHER_ID, declined, "declined"), declined);
  assert.throws(
    () => resolveFriendRequestTransitionReread(OTHER_ID, accepted, "declined"),
    (error) => error instanceof SocialApiError && error.status === 409,
  );
  assert.throws(
    () => resolveFriendRequestTransitionReread(OTHER_ID, declined, "accepted"),
    (error) => error instanceof SocialApiError && error.status === 409,
  );
});

test("friend request transition reread preserves authorization and not-found semantics", () => {
  assert.throws(
    () => resolveFriendRequestTransitionReread(VIEWER_ID, friendship(), "accepted"),
    (error) => error instanceof SocialApiError && error.status === 403,
  );
  assert.throws(
    () => resolveFriendRequestTransitionReread(OTHER_ID, null, "accepted"),
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

test("atomic room invite creation distinguishes a new write from an idempotent result", () => {
  assert.deepEqual(resolveRoomInviteCreateOutcome(atomicInviteOutcome("created")), {
    inviteId: INVITE_ID,
    created: true,
  });
  assert.deepEqual(resolveRoomInviteCreateOutcome(atomicInviteOutcome("existing")), {
    inviteId: INVITE_ID,
    created: false,
  });
  assert.throws(
    () => resolveRoomInviteCreateOutcome(null),
    /invalid database response/,
  );
});

test("atomic room invite errors preserve public authorization, conflict, and rate semantics", () => {
  assert.deepEqual(roomInviteErrorShape("room_invite_host_required"), {
    status: 403,
    message: "Only the host can invite people to this room",
  });
  assert.deepEqual(roomInviteErrorShape("room_invite_request_id_conflict"), {
    status: 409,
    message: "Invite request id is already in use",
  });
  assert.deepEqual(roomInviteErrorShape("room_invite_rate_limit"), {
    status: 429,
    message: "Too many invite requests. Try again shortly",
  });
  assert.equal(roomInviteCreateError("unrelated database error"), null);
});

test("atomic room invite responses accept only the requested completed action", () => {
  assert.deepEqual(
    resolveRoomInviteResponseOutcome(
      atomicInviteResponseOutcome({ outcome: "accepted", recipient_status: "accepted" }),
      "accept",
      INVITE_ID,
    ),
    { recipientStatus: "accepted" },
  );
  assert.deepEqual(
    resolveRoomInviteResponseOutcome(
      atomicInviteResponseOutcome({ outcome: "declined", recipient_status: "declined" }),
      "decline",
      INVITE_ID,
    ),
    { recipientStatus: "declined" },
  );
  assert.throws(
    () =>
      resolveRoomInviteResponseOutcome(
        atomicInviteResponseOutcome({ outcome: "accepted", recipient_status: "accepted" }),
        "decline",
        INVITE_ID,
      ),
    /invalid database response/,
  );
});

test("atomic room invite responses preserve stable public lifecycle errors", () => {
  const cases: Array<{
    row: RoomInviteResponseOutcomeRow;
    status: number;
    message: string;
  }> = [
    {
      row: atomicInviteResponseOutcome({
        outcome: "already_resolved",
        recipient_status: "declined",
      }),
      status: 409,
      message: "Invite was already resolved",
    },
    {
      row: atomicInviteResponseOutcome({
        outcome: "room_ended",
        recipient_status: "expired",
        responded_at: null,
        missed_at: "2026-08-22T08:00:00.000Z",
      }),
      status: 410,
      message: "Room has ended",
    },
    {
      row: atomicInviteResponseOutcome({
        outcome: "friendship_required",
        recipient_status: "pending",
        responded_at: null,
      }),
      status: 403,
      message: "This invite is no longer available",
    },
    {
      row: atomicInviteResponseOutcome({
        outcome: "not_found",
        room_id: null,
        recipient_status: null,
        responded_at: null,
      }),
      status: 404,
      message: "Invite not found",
    },
  ];

  for (const { row, status, message } of cases) {
    assert.throws(
      () => resolveRoomInviteResponseOutcome(row, "accept", INVITE_ID),
      (error) =>
        error instanceof SocialApiError &&
        error.status === status &&
        error.message === message,
    );
  }
  assert.throws(
    () =>
      resolveRoomInviteResponseOutcome(
        atomicInviteResponseOutcome({
          outcome: "already_resolved",
          recipient_status: "accepted",
        }),
        "decline",
        INVITE_ID,
      ),
    (error) => error instanceof SocialApiError && error.status === 409,
  );
});

test("atomic room invite responses fail closed on malformed or mismatched database rows", () => {
  const invalidRows: Array<RoomInviteResponseOutcomeRow | null> = [
    null,
    atomicInviteResponseOutcome({ invite_id: OTHER_ID }),
    atomicInviteResponseOutcome({ outcome: "accepted", recipient_status: "pending" }),
    atomicInviteResponseOutcome({ outcome: "friendship_required", recipient_status: "accepted" }),
    atomicInviteResponseOutcome({ outcome: "room_ended", recipient_status: "expired", missed_at: null }),
    atomicInviteResponseOutcome({ outcome: "not_found", room_id: "room-1" }),
    atomicInviteResponseOutcome({ outcome: "already_resolved", recipient_status: "accepted" }),
    atomicInviteResponseOutcome({
      outcome: "already_resolved",
      recipient_status: "declined",
      responded_at: null,
    }),
    {
      ...atomicInviteResponseOutcome(),
      responded_at: 0,
    } as unknown as RoomInviteResponseOutcomeRow,
  ];

  for (const row of invalidRows) {
    assert.throws(
      () => resolveRoomInviteResponseOutcome(row, "accept", INVITE_ID),
      /invalid database response/,
    );
  }
  assert.throws(
    () =>
      resolveRoomInviteResponseOutcome(
        atomicInviteResponseOutcome({
          outcome: "friendship_required",
          recipient_status: "pending",
          responded_at: null,
        }),
        "decline",
        INVITE_ID,
      ),
    /invalid database response/,
  );
  assert.throws(
    () =>
      resolveRoomInviteResponseOutcome(
        atomicInviteResponseOutcome({
          outcome: "room_ended",
          recipient_status: "expired",
          missed_at: "2026-08-22T08:00:00.000Z",
        }),
        "accept",
        INVITE_ID,
      ),
    /invalid database response/,
  );
});

test("sent invite status projection follows room lifecycle without reviving terminal actions", () => {
  assert.equal(
    roomInviteRecipientLifecycleStatus({
      recipientStatus: "expired",
      respondedAt: null,
      roomStatus: "live",
    }),
    "pending",
  );
  assert.equal(
    roomInviteRecipientLifecycleStatus({
      recipientStatus: "expired",
      respondedAt: "2026-08-22T08:00:00.000Z",
      roomStatus: "live",
    }),
    "declined",
  );
  assert.equal(
    roomInviteRecipientLifecycleStatus({
      recipientStatus: "pending",
      respondedAt: null,
      roomStatus: "ended",
    }),
    "expired",
  );
  assert.equal(
    roomInviteRecipientLifecycleStatus({
      recipientStatus: "accepted",
      respondedAt: "2026-08-22T08:00:00.000Z",
      roomStatus: "ended",
    }),
    "accepted",
  );
  assert.equal(
    roomInviteRecipientLifecycleStatus({
      recipientStatus: "declined",
      respondedAt: "2026-08-22T08:00:00.000Z",
      roomStatus: "ended",
    }),
    "declined",
  );
});

test("invite actions use the atomic v2 response authority and do not reapply expiry locally", () => {
  const source = readFileSync(SOCIAL_SOURCE_URL, "utf8");
  assert.match(source, /\.rpc\("respond_room_invite_v2"/);
  assert.doesNotMatch(source, /function inviteExpired\b|function assertInviteCanBeAccepted\b/);
});

test("legacy invite listing cannot become a second received-inbox authority", () => {
  const socialSource = readFileSync(SOCIAL_SOURCE_URL, "utf8");
  const accountPageSource = readFileSync(ACCOUNT_PAGE_SOURCE_URL, "utf8");
  assert.match(socialSource, /inbox:\s*\[\]/);
  assert.match(socialSource, /roomInviteRecipientLifecycleStatus\(/);
  assert.match(socialSource, /room:rooms!inner\(room_id,status,ended_at\)/);
  assert.match(socialSource, /recipients:room_invite_recipients\(\*\)/);
  assert.match(accountPageSource, /listAccountInbox\(/);
  assert.doesNotMatch(accountPageSource, /listRoomInvites\(/);
});

test("invite UI does not present the compatibility expiry field as a deadline", () => {
  const source = readFileSync(INVITES_CLIENT_SOURCE_URL, "utf8");
  assert.doesNotMatch(source, /invite\.expiresAt|\bexpires\b/i);
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

function atomicInviteOutcome(outcome: "created" | "existing") {
  return { outcome, invite_id: INVITE_ID };
}

function atomicInviteResponseOutcome(
  overrides: Partial<RoomInviteResponseOutcomeRow> = {},
): RoomInviteResponseOutcomeRow {
  return {
    outcome: "accepted",
    invite_id: INVITE_ID,
    room_id: "room-1",
    recipient_status: "accepted",
    responded_at: "2026-08-22T08:00:00.000Z",
    missed_at: null,
    ...overrides,
  };
}

function roomInviteErrorShape(code: string) {
  const error = roomInviteCreateError(`database exception: ${code}`);
  assert.ok(error);
  return { status: error.status, message: error.message };
}
