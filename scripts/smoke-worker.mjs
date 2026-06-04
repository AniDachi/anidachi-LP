#!/usr/bin/env node

const baseUrl = normalizeBaseUrl(
  process.env.WORKER_HTTP_BASE ??
    "https://anidachi-api-staging.vladislav-gul7.workers.dev",
);
const expectedEnv = process.env.WORKER_EXPECTED_ENV ?? "staging";

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function url(pathname) {
  return new URL(pathname, baseUrl).toString();
}

async function fetchJson(pathname) {
  const response = await fetch(url(pathname));
  if (!response.ok) {
    throw new Error(`${pathname}: expected 2xx, got ${response.status}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error(`${pathname}: expected JSON, got ${contentType}`);
  }
  return response.json();
}

function assertWorkerHostMatchesEnv() {
  const host = new URL(baseUrl).host;
  if (expectedEnv === "staging" && !host.includes("anidachi-api-staging")) {
    throw new Error(`Expected staging Worker host, got ${host}`);
  }
  if (expectedEnv === "production" && !host.includes("anidachi-api-production")) {
    throw new Error(`Expected production Worker host, got ${host}`);
  }
}

function assertNoSecretFieldNames(value, label) {
  const text = JSON.stringify(value).toLowerCase();
  const forbidden = [
    "api_token",
    "apitoken",
    "cloudflare_turn_key_api_token",
    "livekit_api_secret",
    "anidachi_jwt_secret",
  ];
  for (const key of forbidden) {
    if (text.includes(key)) {
      throw new Error(`${label}: response includes forbidden secret field ${key}`);
    }
  }
}

assertWorkerHostMatchesEnv();

const health = await fetchJson("/");
if (health.ok !== true || health.service !== "anidachi-api") {
  throw new Error(`Unexpected Worker health response: ${JSON.stringify(health)}`);
}

const ice = await fetchJson("/ice-servers");
if (!Array.isArray(ice.iceServers) || ice.iceServers.length === 0) {
  throw new Error("/ice-servers: expected at least one ICE server");
}
if (!Number.isInteger(ice.ttlSeconds) || ice.ttlSeconds < 600 || ice.ttlSeconds > 86400) {
  throw new Error(`/ice-servers: unexpected ttlSeconds ${ice.ttlSeconds}`);
}
if (!["cloudflare", "fallback"].includes(ice.provider)) {
  throw new Error(`/ice-servers: unexpected provider ${ice.provider}`);
}
assertNoSecretFieldNames(ice, "/ice-servers");

console.log(`Worker smoke passed for ${baseUrl}`);
