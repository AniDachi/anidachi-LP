import assert from "node:assert/strict";
import { test } from "node:test";
import { socialOwnerError } from "./anidachi-auth/social-routes";
import { socialEditorError } from "./anidachi-auth/social";
import {
  parseFriendDirectory,
  parseGroupDirectory,
  parseSavedGroup,
  SOCIAL_OWNER_HEADER,
} from "./social-editor-contracts";
const owner = "11111111-1111-4111-8111-111111111111";
test("social requests reject a changed owner, retaining old extension compatibility", () => {
  const request = (id?: string) =>
    new Request("https://staging.anidachi.app/api/groups", {
      headers: id ? { [SOCIAL_OWNER_HEADER]: id } : {},
    });
  assert.equal(socialOwnerError(request("other-owner"), owner)?.status, 409);
  assert.equal(socialOwnerError(request(owner), owner), null);
  assert.equal(socialOwnerError(request(), owner), null);
});
test("malformed social responses fail instead of displaying an empty success", () => {
  assert.throws(() => parseFriendDirectory({ friends: [] }));
  assert.throws(() => parseGroupDirectory({ groups: null }));
  assert.throws(() =>
    parseSavedGroup({ group: { id: owner, name: "Missing members" } }),
  );
});
test("group conflicts and link errors have actionable public messages", () => {
  assert.match(socialEditorError("group_edit_conflict").message, /Reopen/);
  assert.match(
    socialEditorError("group_friend_unavailable").message,
    /no longer your friend/,
  );
  assert.match(socialEditorError("friend_link_used").message, /new link/);
});
