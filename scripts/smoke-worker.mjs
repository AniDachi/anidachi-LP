#!/usr/bin/env node

const baseUrl = normalizeBaseUrl(
  process.env.WORKER_HTTP_BASE ?? "https://anidachi-api-staging.vladislav-gul7.workers.dev",
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

assertWorkerHostMatchesEnv();

const health = await fetchJson("/");
if (health.ok !== true || health.service !== "anidachi-api") {
  throw new Error(`Unexpected Worker health response: ${JSON.stringify(health)}`);
}

// The primary room-scoped ICE endpoint is authenticated. A smoke run carries
// no token, so a 401 proves both route deployment and the active auth gate.
const iceResponse = await fetch(url("/rooms/smoke-room/ice-servers"));
if (iceResponse.status !== 401) {
  throw new Error(
    `/rooms/smoke-room/ice-servers: expected 401 (auth-gated) without a token, got ${iceResponse.status}`,
  );
}

console.log(`Worker smoke passed for ${baseUrl}`);
