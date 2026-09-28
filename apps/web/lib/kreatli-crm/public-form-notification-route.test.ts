import assert from "node:assert/strict";
import test from "node:test";
import * as contactRoute from "./contact-route";
import * as featureRoute from "./feature-request-route";

test("contact form remains successful when optional Gmail token lookup fails", async () => {
  let stored = 0;
  const handler = (
    contactRoute as typeof contactRoute & {
      handleContactPost: (
        request: Request,
        dependencies: Record<string, unknown>,
      ) => Promise<Response>;
    }
  ).handleContactPost;
  const response = await handler(
    new Request("https://www.anidachi.app/api/contact", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "192.0.2.31",
      },
      body: JSON.stringify({
        name: "Test User",
        email: "contact@example.com",
        subject: "Question",
        message: "Hello",
        category: "other",
      }),
    }),
    {
      appendContactMessage: async () => {
        stored += 1;
      },
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

  assert.equal(stored, 1);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test("feature request remains successful when optional Gmail token lookup fails", async () => {
  let stored = 0;
  const handler = (
    featureRoute as typeof featureRoute & {
      handleFeatureRequestPost: (
        request: Request,
        dependencies: Record<string, unknown>,
      ) => Promise<Response>;
    }
  ).handleFeatureRequestPost;
  const response = await handler(
    new Request("https://www.anidachi.app/api/feature-requests", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "192.0.2.32",
      },
      body: JSON.stringify({
        name: "Test User",
        email: "feature@example.com",
        title: "Suggestion",
        description: "Please add this",
        category: "other",
      }),
    }),
    {
      appendFeatureRequest: async () => {
        stored += 1;
      },
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

  assert.equal(stored, 1);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});
