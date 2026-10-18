import assert from "node:assert/strict";
import { test } from "node:test";
import { desktopInstallUrl, isMobileInstallDevice } from "./mobile-install";

test("phone and desktop-mode iPad use handoff; touch laptops stay on desktop", () => {
  for (const userAgent of ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) Mobile", "Mozilla/5.0 Android 15 Mobile", "Mozilla/5.0 iPad"]) {
    assert.equal(isMobileInstallDevice({ userAgent }), true);
  }
  assert.equal(isMobileInstallDevice({ userAgent: "Mozilla/5.0 Macintosh Safari", platform: "MacIntel", maxTouchPoints: 5 }), true);
  assert.equal(isMobileInstallDevice({ userAgent: "Mozilla/5.0 Macintosh Safari", platform: "MacIntel", maxTouchPoints: 0 }), false);
  assert.equal(isMobileInstallDevice({ userAgent: "Mozilla/5.0 Windows Chrome", platform: "Win32", maxTouchPoints: 10 }), false);
});

test("desktop handoff preserves only safe install context on the same environment", () => {
  const origin = "https://staging.anidachi.app";
  assert.equal(desktopInstallUrl("/extension?welcome=1", origin), `${origin}/extension?welcome=1`);
  assert.equal(desktopInstallUrl("/extension#using", origin), `${origin}/extension#using`);
  assert.equal(desktopInstallUrl("/extension?next=%2Froom%2Fhello&welcome=1", origin), `${origin}/extension?next=%2Froom%2Fhello&welcome=1`);
  assert.equal(desktopInstallUrl("/extension?next=%2Froom%2Fhello&session_id=private&access_token=secret#anything", origin), `${origin}/extension?next=%2Froom%2Fhello`);
});

test("foreign, malformed, account, and unsafe return URLs fall back to the install hub", () => {
  const origin = "https://www.anidachi.app";
  for (const href of [
    "https://untrusted.example/extension?welcome=1",
    "//untrusted.example/extension?next=/room/hello",
    "https://[",
    "/account/billing?session_id=private",
    "/extension?next=https://untrusted.example&welcome=0",
    "/extension?next=%2F%2Funtrusted.example",
    "/extension?next=%2Faccount%2Fbilling",
  ]) assert.equal(desktopInstallUrl(href, origin), `${origin}/extension`, href);
});
