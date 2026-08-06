import { AccountResponseMetaSchema } from "@anidachi/protocol";
import assert from "node:assert/strict";
import test from "node:test";
import { createAccountResponseMeta } from "./account-response";

test("createAccountResponseMeta creates versioned metadata using the supplied server clock", () => {
  const meta = createAccountResponseMeta(new Date("2026-08-06T12:00:00.000Z"));

  assert.deepEqual(meta, {
    serverTime: "2026-08-06T12:00:00.000Z",
    schemaVersion: 1,
  });
  assert.doesNotThrow(() => AccountResponseMetaSchema.parse(meta));
});
