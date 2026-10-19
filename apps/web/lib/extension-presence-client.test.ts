import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { requestExtensionPresence } from "./extension-presence-client";
import { WEBSITE_PRESENCE } from "@anidachi/protocol";

const id = "a".repeat(32);
type Runtime = { sendMessage: (id: string, message: unknown, reply: (value: unknown) => void) => void; lastError?: unknown };
function runtime(value: Runtime) { (globalThis as { chrome?: unknown }).chrome = { runtime: value }; }
afterEach(() => { delete (globalThis as { chrome?: unknown }).chrome; });

test("presence accepts only the exact response and never treats a browser error as installed", async () => {
  for (const reply of [null, {}, { installed: true }, { type: WEBSITE_PRESENCE, installed: false },
    { type: WEBSITE_PRESENCE, installed: true, token: "unexpected" }]) {
    runtime({ sendMessage: (_id, _message, done) => done(reply) });
    assert.equal(await requestExtensionPresence(id, new AbortController().signal), false);
  }
  runtime({ lastError: { message: "Extension unavailable" }, sendMessage: (_id, _message, done) => done({ type: WEBSITE_PRESENCE, installed: true }) });
  assert.equal(await requestExtensionPresence(id, new AbortController().signal), false);
});

test("missing or invalid installation destination does not send a message", async () => {
  runtime({ sendMessage: () => { throw Error("Should not be called"); } });
  for (const value of [null, undefined, "invalid", "z".repeat(32)]) {
    assert.equal(await requestExtensionPresence(value, new AbortController().signal), false);
  }
});

test("presence times out once, and reads lastError even on a late Chrome callback", async t => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let callback!: (value: unknown) => void;
  let errorsRead = 0;
  runtime({ sendMessage: (_id, _message, reply) => { callback = reply; }, get lastError() { errorsRead++; return undefined; } });
  const result = requestExtensionPresence(id, new AbortController().signal);
  t.mock.timers.tick(1000);
  assert.equal(await result, false);
  callback({ type: WEBSITE_PRESENCE, installed: true });
  assert.equal(errorsRead, 1);
  assert.equal(await result, false);
});

test("unmount aborts an outstanding probe and a late response cannot revive it", async () => {
  let callback!: (value: unknown) => void;
  runtime({ sendMessage: (_id, _message, reply) => { callback = reply; } });
  const abort = new AbortController();
  const result = requestExtensionPresence(id, abort.signal);
  abort.abort();
  assert.equal(await result, false);
  callback({ type: WEBSITE_PRESENCE, installed: true });
  assert.equal(await result, false);
});
