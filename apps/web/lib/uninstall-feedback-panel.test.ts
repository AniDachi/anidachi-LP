import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { dom } from "./test-helpers/account-client-dom";
import { UninstallFeedbackPanel } from "../app/kreatli-email-crm/uninstall-feedback-panel";

const item = { id: "11111111-1111-4111-8111-111111111111", createdAt: "2026-11-05T13:00:00.123456Z", displayName: "Alex Johnson", email: "feedback@example.com", discordId: "123456789012345678", reason: "technical_issues", note: "<script>not executable</script>" };
let root: Root | null;
let container: HTMLDivElement;
const originalFetch = globalThis.fetch;
let respond: (url: string) => Promise<Response>;
let calls: string[];
async function mount() {
  calls = [];
  globalThis.fetch = async (url) => { calls.push(String(url)); return respond(String(url)); };
  container = document.createElement("div"); document.body.append(container);
  root = createRoot(container);
  await act(async () => root!.render(React.createElement(UninstallFeedbackPanel)));
}
function button(label: string) { const el = [...container.querySelectorAll("button")].find(b => b.textContent === label); assert.ok(el, label); return el; }
async function click(label: string) { await act(async () => button(label).click()); }
afterEach(async () => { await act(async () => root?.unmount()); root = null; document.body.innerHTML = ""; dom.sessionStorage.clear(); globalThis.fetch = originalFetch; });

test("feedback renders escaped notes and appends pages without duplicate rows; refresh replaces the list", async () => {
  respond = async () => Response.json({ items: [item], nextCursor: "next" });
  await mount();
  assert.match(container.textContent!, /Something didn’t work/);
  assert.match(container.textContent!, /<script>not executable<\/script>/);
  assert.equal(container.querySelector("script"), null);
  assert.match(container.textContent!, /feedback@example.com/);
  assert.match(container.textContent!, /123456789012345678/);
  assert.match(container.textContent!, /Alex Johnson/);
  respond = async () => Response.json({ items: [item, { ...item, id: "22222222-2222-4222-8222-222222222222", email: null, discordId: null, reason: "not_using", note: "" }], nextCursor: null });
  await click("Load more");
  assert.match(calls.at(-1)!, /cursor=next$/);
  assert.equal(container.querySelectorAll("tbody tr").length, 2);
  assert.match(container.querySelectorAll("tbody tr")[1].textContent!, /Not available/);
  respond = async () => Response.json({ items: [], nextCursor: null });
  await click("Refresh");
  assert.equal(calls.at(-1), "/api/kreatli-crm/uninstall-feedback");
  assert.match(container.textContent!, /No responses yet/);
});

test("initial failure stays retryable and never looks like an empty inbox", async () => {
  respond = async () => Response.json({ error: "private" }, { status: 503 });
  await mount();
  assert.match(container.textContent!, /Couldn’t load responses/);
  assert.doesNotMatch(container.textContent!, /No responses yet|private/);
  respond = async () => Response.json({ items: [item], nextCursor: null });
  await click("Retry");
  assert.equal(container.querySelectorAll("tbody tr").length, 1);
});

test("a failed next page preserves loaded answers; expired CRM session clears them", async () => {
  respond = async () => Response.json({ items: [item], nextCursor: "next" });
  await mount();
  respond = async () => Response.json({ error: "temporary" }, { status: 503 });
  await click("Load more");
  assert.equal(container.querySelectorAll("tbody tr").length, 1);
  respond = async () => Response.json({ error: "Unauthorized" }, { status: 401 });
  await click("Retry");
  assert.equal(container.querySelectorAll("tbody tr").length, 0);
  assert.doesNotMatch(container.textContent!, /feedback@example.com|123456789012345678|Alex Johnson/);
  assert.match(container.textContent!, /session expired/);
  assert.equal(container.querySelector("a")?.getAttribute("href"), "/kreatli-email-crm/login");
});

test("malformed success responses do not replace verified feedback", async () => {
  respond = async () => Response.json({ items: [item], nextCursor: null });
  await mount();
  respond = async () => Response.json({ items: [{ ...item, reason: "unrecognized" }], nextCursor: null });
  await click("Refresh");
  assert.equal(container.querySelectorAll("tbody tr").length, 1);
  assert.match(container.textContent!, /Couldn’t load responses/);
});

test("email is plain escaped text and refresh picks up current account email", async () => {
  respond = async () => Response.json({ items: [{ ...item, email: '<img src=x onerror="alert(1)">@example.com' }], nextCursor: null });
  await mount();
  assert.match(container.textContent!, /<img src=x/);
  assert.equal(container.querySelector("img"), null);
  respond = async () => Response.json({ items: [item], nextCursor: null });
  await click("Refresh");
  assert.match(container.textContent!, /feedback@example.com/);
  assert.match(container.textContent!, /123456789012345678/);
  assert.doesNotMatch(container.textContent!, /<img src=x/);
});

test("account name is escaped; missing names do not hide anonymous or older feedback", async () => {
  respond = async () => Response.json({ items: [{ ...item, displayName: '<img src=x onerror="alert(1)">' }], nextCursor: null });
  await mount();
  assert.match(container.textContent!, /<img src=x/);
  assert.equal(container.querySelector("img"), null);
  respond = async () => Response.json({ items: [{ ...item, displayName: null }], nextCursor: null });
  await click("Refresh");
  assert.equal(container.querySelectorAll("tbody tr").length, 1);
  assert.doesNotMatch(container.textContent!, /<img src=x|First name|Last name/);
  respond = async () => Response.json({ items: [item], nextCursor: null });
  await click("Refresh");
  assert.match(container.textContent!, /Alex Johnson/);
});
