import assert from "node:assert/strict";
import test from "node:test";
import * as route from "../../app/api/waitlist/join/route";

test("authenticated waitlist join returns 503 when durable storage fails", async () => {
  const handler = (
    route as typeof route & {
      handleWaitlistJoinPost: (
        request: Request,
        dependencies: Record<string, unknown>,
      ) => Promise<Response>;
    }
  ).handleWaitlistJoinPost;

  const response = await handler(
    new Request("https://www.anidachi.app/api/waitlist/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "referral_join", referredBy: "friend" }),
    }),
    {
      getSession: async () => ({ userId: "user-id" }),
      getUserById: async () => ({
        id: "user-id",
        email: "guest@example.com",
        display_name: "Guest",
      }),
      upsertSurveyLead: async () => ({
        saved: false,
        reason: "write_failed",
        waitlistCount: 0,
        isNewLead: false,
        baseWaitlistPosition: null,
        waitlistPosition: null,
        referralCode: null,
        referralLink: null,
        referralCount: 0,
      }),
    },
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "Could not save your place. Please try again.",
  });
});
