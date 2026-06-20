import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanDisplayName,
  cleanGroupName,
  cleanInviteMessage,
  friendshipPairKey,
  isUuid,
  normalizeHandle,
  publicProfileFromRows,
} from "./social";

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
