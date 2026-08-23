import assert from "node:assert/strict";
import test from "node:test";
import { databaseResultOrThrow } from "./db";

test("database result preserves an authoritative missing row", () => {
  assert.equal(
    databaseResultOrThrow("validate refresh token", { data: null, error: null }),
    null,
  );
});

test("database result does not turn a Supabase failure into a missing row", () => {
  assert.throws(
    () =>
      databaseResultOrThrow("validate refresh token", {
        data: null,
        error: { message: "connection unavailable" },
      }),
    /Failed to validate refresh token: connection unavailable/,
  );
});

test("database result keeps structured RPC payloads opaque for a domain parser", () => {
  const rows = [{ outcome: "conflict", active_room: { roomId: "room-one" } }];
  assert.equal(
    databaseResultOrThrow("claim active room", { data: rows, error: null }),
    rows,
  );
});
