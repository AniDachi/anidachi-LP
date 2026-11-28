import assert from "node:assert/strict";
import { after, test } from "node:test";
import { NextRequest } from "next/server";
import { createInstallLinkHandler } from "./install-link-request";
import { CHROME_WEB_STORE_URL } from "./install-cta";
import { POST } from "../app/api/extension/install-link/route";

const previousSecret = process.env.ANIDACHI_EMAIL_OTP_SECRET;
process.env.ANIDACHI_EMAIL_OTP_SECRET = "install-link-test-secret".repeat(2);
after(() => {
  if (previousSecret === undefined) delete process.env.ANIDACHI_EMAIL_OTP_SECRET;
  else process.env.ANIDACHI_EMAIL_OTP_SECRET = previousSecret;
});

const origin = "https://staging.anidachi.app";
function request(payload: object, headers: Record<string, string> = {}) {
  return new NextRequest(origin + "/api/extension/install-link", {
    method: "POST", body: JSON.stringify(payload),
    headers: { origin, "content-type": "application/json", ...headers },
  });
}

test("guest requests send one fixed installation email to the normalized address", async () => {
  const keys: string[] = [];
  let deliveries = 0;
  const post = createInstallLinkHandler(async (key) => { keys.push(key); return 0; }, async (email, message, id) => {
    deliveries++;
    assert.equal(email, "guest@example.com");
    assert.equal(message.subject, "Your AniDachi install link");
    assert.deepEqual([...message.html.matchAll(/href="([^"]+)"/g)].map(match => match[1]), [CHROME_WEB_STORE_URL]);
    assert.ok(message.text.includes(CHROME_WEB_STORE_URL));
    assert.doesNotMatch(message.html, /attacker|guest@example|src="\//);
    assert.match(id, /^install-link\//);
  });
  const result = await post(request({ email: " Guest@Example.com ", url: "https://attacker.example/" }));
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { ok: true });
  assert.equal(deliveries, 1);
  assert.deepEqual(keys.map(key => key.replace(/:[0-9a-f]{64}$/, "")), ["install:ip", "install:cooldown", "install:address", "install:daily"]);
});

test("invalid addresses, large payloads and foreign origins cannot consume quota or trigger mail", async () => {
  let calls = 0;
  const post = createInstallLinkHandler(async () => { calls++; return 0; }, async () => { calls++; });
  assert.equal((await post(request({ email: ["a@example.com", "b@example.com"] }))).status, 400);
  assert.equal((await post(request({ email: "hi@example.com", extra: "a".repeat(7000) }))).status, 400);
  assert.equal((await post(request({ email: "hi@example.com" }, { origin: "https://other.example" }))).status, 403);
  const loopback = new NextRequest("http://localhost:3197/api/extension/install-link", {
    method: "POST", headers: { host: "127.0.0.1:3197", origin: "http://127.0.0.1:3197", "content-type": "application/json" },
    body: JSON.stringify({ email: "invalid" }),
  });
  assert.equal((await post(loopback)).status, 400);
  assert.equal(calls, 0);
});

test("installed route uses the shared database limit and delivers the ticket via Resend only once", async t => {
  const env = { NEXT_PUBLIC_SUPABASE_URL: "https://database.example", SUPABASE_SERVICE_ROLE_KEY: "test-only", RESEND_API_KEY: "test-only" };
  const previous = Object.entries(env).map(([key]) => [key, process.env[key]] as const);
  Object.assign(process.env, env);
  t.after(() => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  let cooldownReserved = false;
  const deliveries: Record<string, unknown>[] = [];
  t.mock.method(globalThis, "fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "https://database.example/rest/v1/rpc/consume_email_login_limit_v1") {
      const { p_key } = JSON.parse(String(init?.body));
      if (p_key.startsWith("install:cooldown:")) {
        if (cooldownReserved) return Response.json(55);
        cooldownReserved = true;
      }
      return Response.json(0);
    }
    assert.equal(url, "https://api.resend.com/emails");
    deliveries.push(JSON.parse(String(init?.body)));
    return Response.json({ id: "test-email" });
  });
  const payload = { email: "guest@example.com" };
  const statuses = await Promise.all([POST(request(payload)), POST(request(payload))]);
  assert.deepEqual(statuses.map(response => response.status).sort(), [200, 429]);
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0].from, "AniDachi <notifications@anidachi.app>");
  assert.deepEqual(deliveries[0].to, ["guest@example.com"]);
  assert.equal(deliveries[0].subject, "Your AniDachi install link");
});

test("rate limits and unavailable dependencies never acknowledge an unsent message", async () => {
  let deliveries = 0;
  const send = async () => { deliveries++; };
  const limited = createInstallLinkHandler(async key => key.startsWith("install:cooldown:") ? 32 : 0, send);
  const response = await limited(request({ email: "guest@example.com" }));
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "32");
  const unavailable = createInstallLinkHandler(async () => { throw Error("db"); }, send);
  assert.equal((await unavailable(request({ email: "guest@example.com" }))).status, 503);
  assert.equal(deliveries, 0);
  const rejected = createInstallLinkHandler(async () => 0, async () => { throw Error("private provider details"); });
  const failed = await rejected(request({ email: "guest@example.com" }));
  assert.equal(failed.status, 503);
  assert.deepEqual(await failed.json(), { error: "unavailable" });
});
