import assert from "node:assert/strict";
import test from "node:test";
import {
  AccountOwnedResponseMetaSchema,
  AccountResponseMetaSchema,
} from "@anidachi/protocol";
import {
  createAccountResponseMeta,
  createOwnedAccountResponseMeta,
} from "./account-response";

test("createAccountResponseMeta creates versioned metadata using the supplied server clock", () => {
  const meta = createAccountResponseMeta(new Date("2026-08-06T12:00:00.000Z"));

  assert.deepEqual(meta, {
    serverTime: "2026-08-06T12:00:00.000Z",
    schemaVersion: 1,
  });
  assert.doesNotThrow(() => AccountResponseMetaSchema.parse(meta));
});

test("createOwnedAccountResponseMeta binds cached account data to one user", () => {
  const ownerUserId = "11111111-1111-4111-8111-111111111111";
  const meta = createOwnedAccountResponseMeta(
    ownerUserId,
    new Date("2026-08-06T12:00:00.000Z"),
  );

  assert.equal(meta.ownerUserId, ownerUserId);
  assert.doesNotThrow(() => AccountOwnedResponseMetaSchema.parse(meta));
});
