import assert from "node:assert/strict";
import test from "node:test";
import * as route from "./subscribe-interest-route";

test("subscribe interest returns 503 when the CRM did not persist the lead", async (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  const error = t.mock.method(console, "error", () => {});
  let notificationReads = 0;
  const handler = (
    route as typeof route & {
      handleSubscribeInterestPost: (
        request: Request,
        dependencies: Record<string, unknown>,
      ) => Promise<Response>;
    }
  ).handleSubscribeInterestPost;

  const response = await handler(
    new Request("https://www.anidachi.app/api/subscribe-interest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Test User",
        email: "test@example.com",
        survey: { segment: "Friend_group_host" },
      }),
    }),
    {
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
      isGmailConfigured: () => true,
      readGmailTokens: async () => {
        notificationReads += 1;
        return null;
      },
      sendPlaintextEmail: async () => undefined,
      getGmailRedirectUri: () => "https://www.anidachi.app/callback",
      getSiteOrigin: () => "https://www.anidachi.app",
      notifyEmails: "owner@example.com",
    },
  );

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "Could not save your place. Please try again.",
  });
  assert.equal(notificationReads, 0);
  assert.equal(warn.mock.callCount(), 1);
  assert.equal(error.mock.callCount(), 0);
  const logged = JSON.stringify(warn.mock.calls);
  assert.doesNotMatch(logged, /test@example\.com|Test User|Friend_group_host/);
});

test("subscribe interest remains successful when optional Gmail token lookup fails", async () => {
  const handler = (
    route as typeof route & {
      handleSubscribeInterestPost: (
        request: Request,
        dependencies: Record<string, unknown>,
      ) => Promise<Response>;
    }
  ).handleSubscribeInterestPost;
  const response = await handler(
    new Request("https://www.anidachi.app/api/subscribe-interest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Test User",
        email: "test@example.com",
        survey: { segment: "Friend_group_host" },
      }),
    }),
    {
      upsertSurveyLead: async () => ({
        saved: true,
        waitlistCount: 683,
        isNewLead: true,
        baseWaitlistPosition: 683,
        waitlistPosition: 683,
        referralCode: "fixture",
        referralLink: "https://www.anidachi.app/join?ref=fixture",
        referralCount: 0,
      }),
      isGmailConfigured: () => true,
      readGmailTokens: async () => {
        throw new Error("notification unavailable");
      },
      sendPlaintextEmail: async () => undefined,
      getGmailRedirectUri: () => "https://www.anidachi.app/callback",
      getSiteOrigin: () => "https://www.anidachi.app",
      notifyEmails: "owner@example.com",
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    waitlistPosition: 683,
    referralLink: "https://www.anidachi.app/join?ref=fixture",
    referralCount: 0,
  });
});
