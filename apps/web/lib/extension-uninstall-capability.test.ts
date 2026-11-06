import assert from "node:assert/strict";
import test from "node:test";
import { ExtensionUninstallCapabilitySchema, EXTENSION_UNINSTALL_CAPABILITY_PATH } from "@anidachi/protocol";
import { GET } from "../app/api/extension/uninstall-capability/route";
import { canBypassStagingGate } from "./staging-access";

test("uninstall rollout metadata is anonymous, versioned, uncached and noindex", async () => {
  const response = GET();
  assert.equal(response.status, 200);
  assert.deepEqual(ExtensionUninstallCapabilitySchema.parse(await response.json()), { version: 1, available: true });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.equal(response.headers.get("set-cookie"), null);
});

test("only the public GET capability bypasses the staging password; page and customer APIs stay protected", () => {
  assert.equal(canBypassStagingGate({ pathname: EXTENSION_UNINSTALL_CAPABILITY_PATH, method: "GET" }), true);
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "HEAD"]) {
    assert.equal(canBypassStagingGate({ pathname: EXTENSION_UNINSTALL_CAPABILITY_PATH, method }), false);
  }
  for (const pathname of ["/uninstall", "/api/uninstall/offer", "/api/uninstall/claim", "/api/uninstall/checkout", "/api/uninstall/feedback", "/api/extension/uninstall-capability/private"]) {
    for (const method of ["GET", "POST"]) assert.equal(canBypassStagingGate({ pathname, method }), false, `${method} ${pathname}`);
  }
});
