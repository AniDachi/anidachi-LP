import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  INTERNAL_TOOL_ROBOTS_DISALLOW,
  isInternalToolPath,
} from "./internal-tool-routes";

describe("internal-tool-routes", () => {
  it("matches Blou manager and login routes", () => {
    assert.equal(isInternalToolPath("/blou/login"), true);
    assert.equal(isInternalToolPath("/blou/manager"), true);
    assert.equal(isInternalToolPath("/blou/manager/publish"), true);
  });

  it("matches Kreatli CRM routes", () => {
    assert.equal(isInternalToolPath("/kreatli-email-crm"), true);
    assert.equal(isInternalToolPath("/kreatli-email-crm/login"), true);
  });

  it("matches internal API prefixes", () => {
    assert.equal(isInternalToolPath("/api/blou/upload"), true);
    assert.equal(isInternalToolPath("/api/kreatli-crm/login"), true);
  });

  it("does not match public marketing routes", () => {
    assert.equal(isInternalToolPath("/"), false);
    assert.equal(isInternalToolPath("/guides/foo"), false);
    assert.equal(isInternalToolPath("/api/subscribe-interest"), false);
  });

  it("exports stable robots disallow prefixes", () => {
    assert.deepEqual(INTERNAL_TOOL_ROBOTS_DISALLOW, [
      "/blou",
      "/kreatli-email-crm",
      "/api/blou",
      "/api/kreatli-crm",
    ]);
  });
});
