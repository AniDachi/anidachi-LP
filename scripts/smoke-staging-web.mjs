#!/usr/bin/env node

const STAGING_ACCESS_PATH = "/__anidachi/staging-access";

const baseUrl = normalizeBaseUrl(
  process.env.STAGING_WEB_HTTP_BASE ?? "https://staging.anidachi.app",
);
const accessCode = process.env.STAGING_ACCESS_CODE;

if (!accessCode) {
  throw new Error("STAGING_ACCESS_CODE is required");
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function url(pathname) {
  return new URL(pathname, baseUrl).toString();
}

function assertStatus(response, expected, label) {
  if (response.status !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${response.status}`);
  }
}

async function assertTextIncludes(response, expected, label) {
  const text = await response.text();
  if (!text.includes(expected)) {
    throw new Error(`${label}: expected response text to include ${expected}`);
  }
  return text;
}

function assertHeaderIncludes(response, name, expected, label) {
  const actual = response.headers.get(name) ?? "";
  if (!actual.toLowerCase().includes(expected.toLowerCase())) {
    throw new Error(`${label}: expected ${name} to include ${expected}, got ${actual}`);
  }
}

function getSetCookies(response) {
  if (typeof response.headers.getSetCookie === "function") {
    return response.headers.getSetCookie();
  }
  const header = response.headers.get("set-cookie");
  return header ? [header] : [];
}

function extractCookie(response, cookieName) {
  for (const header of getSetCookies(response)) {
    const [cookiePair] = header.split(";");
    if (cookiePair?.startsWith(`${cookieName}=`)) {
      return cookiePair;
    }
  }
  return null;
}

function formBody(values) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    body.set(key, value);
  }
  return body;
}

async function fetchManual(pathname, init = {}) {
  return fetch(url(pathname), { redirect: "manual", ...init });
}

async function main() {
  const extensionNext =
    "/extension/connect?redirect_uri=https%3A%2F%2Fsmoke.chromiumapp.org%2Fauth&state=smoke-state";

  const gate = await fetchManual("/");
  assertStatus(gate, 200, "GET / without cookie");
  assertHeaderIncludes(gate, "x-robots-tag", "noindex", "GET / without cookie");
  await assertTextIncludes(gate, 'name="password"', "GET / without cookie");

  const rejected = await fetchManual(STAGING_ACCESS_PATH, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: formBody({ password: "wrong-password", next: "/" }),
  });
  assertStatus(rejected, 200, "POST staging access with wrong password");
  await assertTextIncludes(
    rejected,
    "Wrong password. Try again.",
    "POST staging access with wrong password",
  );
  if (extractCookie(rejected, "anidachi_staging_access")) {
    throw new Error("POST staging access with wrong password: unexpected access cookie");
  }

  const accepted = await fetchManual(STAGING_ACCESS_PATH, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: formBody({ password: accessCode, next: extensionNext }),
  });
  assertStatus(accepted, 303, "POST staging access with correct password");
  const stagingCookie = extractCookie(accepted, "anidachi_staging_access");
  if (!stagingCookie) {
    throw new Error("POST staging access with correct password: missing access cookie");
  }
  const acceptedLocation = accepted.headers.get("location") ?? "";
  if (!acceptedLocation.includes("/extension/connect")) {
    throw new Error(
      `POST staging access with correct password: expected redirect to /extension/connect, got ${acceptedLocation}`,
    );
  }

  const connect = await fetchManual(extensionNext, {
    headers: { cookie: stagingCookie },
  });
  if (connect.status < 300 || connect.status > 399) {
    throw new Error(
      `GET /extension/connect with cookie: expected redirect, got ${connect.status}`,
    );
  }
  const connectLocation = connect.headers.get("location") ?? "";
  if (!connectLocation.includes("/login?next=")) {
    throw new Error(
      `GET /extension/connect with cookie: expected redirect to /login?next=..., got ${connectLocation}`,
    );
  }

  const login = await fetchManual(connectLocation, {
    headers: { cookie: stagingCookie },
  });
  assertStatus(login, 200, "GET /login with cookie");
  const loginText = await login.text();
  for (const expected of [
    "Continue with Discord",
    "Continue with Google",
    "/api/auth/discord?returnTo=",
    "/api/auth/google?returnTo=",
    "%2Fextension%2Fconnect",
  ]) {
    if (!loginText.includes(expected)) {
      throw new Error(`GET /login with cookie: expected response text to include ${expected}`);
    }
  }

  const apiRooms = await fetchManual("/api/rooms", { method: "POST" });
  assertStatus(apiRooms, 401, "POST /api/rooms without access");
  assertHeaderIncludes(apiRooms, "content-type", "application/json", "POST /api/rooms");
  const apiRoomsBody = await apiRooms.json();
  if (apiRoomsBody.error !== "Staging access required") {
    throw new Error(
      `POST /api/rooms without access: expected staging error, got ${JSON.stringify(
        apiRoomsBody,
      )}`,
    );
  }

  const robots = await fetchManual("/robots.txt");
  assertStatus(robots, 200, "GET /robots.txt");
  await assertTextIncludes(robots, "Disallow: /", "GET /robots.txt");

  const sitemap = await fetchManual("/sitemap.xml");
  assertStatus(sitemap, 200, "GET /sitemap.xml");
  const sitemapText = await sitemap.text();
  if (sitemapText.includes("<url>")) {
    throw new Error("GET /sitemap.xml: expected empty sitemap");
  }

  console.log(`Staging smoke passed for ${baseUrl}`);
}

await main();
