import { expect, test } from "vitest";
import { websitePresenceReply } from "../src/website-presence";

const origins = ["https://staging.anidachi.app"];
const message = { type: "anidachi:website-presence:v1" };
test("presence exposes only readiness to the exact channel website top frame", () => {
  expect(websitePresenceReply(message, { url: origins[0] + "/extension?welcome=1", frameId: 0 }, origins))
    .toEqual({ type: "anidachi:website-presence:v1", installed: true });
  for (const sender of [
    { url: "https://www.anidachi.app/extension" },
    { url: origins[0] + ".evil.test/extension" },
    { url: origins[0], origin: "https://evil.test" },
    { url: origins[0], frameId: 2 },
    { url: origins[0], id: "another-extension" },
  ]) expect(websitePresenceReply(message, sender, origins)).toBeNull();
  expect(websitePresenceReply({ ...message, challenge: "not-a-signing-operation" }, { url: origins[0] }, origins)).toBeNull();
});
