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
