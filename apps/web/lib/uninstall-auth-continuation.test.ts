import assert from "node:assert/strict";
import { test } from "node:test";
import { checkoutLoginErrorPath, uninstallReturnPath } from "./checkout-selection";

test("uninstall OAuth retry preserves only the bounded local selection", () => {
  for (const path of ["/uninstall", "/uninstall?plan=plus", "/uninstall?plan=pro"]) {
    assert.equal(uninstallReturnPath(path), path);
    const url = new URL(checkoutLoginErrorPath("oauth_failed", path), "https://staging.anidachi.app");
    assert.equal(url.searchParams.get("next"), path);
  }
  for (const path of ["//evil.example/uninstall?plan=pro", "https://evil.example/uninstall?plan=pro", "/uninstall?plan=plus&plan=pro", "/uninstall?plan=free", "/uninstall?plan=pro&apply=1", "/uninstall?plan=pro#pay", "/uninstall\\evil?plan=pro"]) {
    assert.equal(uninstallReturnPath(path), null);
    assert.equal(new URL(checkoutLoginErrorPath("oauth_failed", path), "https://staging.anidachi.app").searchParams.get("next"), null);
  }
});
