import assert from "node:assert/strict";
import test from "node:test";
import { hasValidInternalServiceAuthorization } from "./internal-service-auth";

test("internal service authorization requires the exact shared secret after staging bypass", () => {
  assert.equal(
    hasValidInternalServiceAuthorization(
      "Bearer exact-secret",
      "exact-secret",
    ),
    true,
  );
  assert.equal(
    hasValidInternalServiceAuthorization(
      "Bearer arbitrary-bypass-token",
      "exact-secret",
    ),
    false,
  );
  assert.equal(
    hasValidInternalServiceAuthorization(null, "exact-secret"),
    false,
  );
});
