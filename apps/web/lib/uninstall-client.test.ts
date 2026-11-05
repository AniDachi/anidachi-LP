import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { dom } from "./test-helpers/account-client-dom";
import { UninstallClient } from "../app/uninstall/uninstall-client";
import { calculateUninstallPrice, type UninstallOffer } from "./anidachi-auth/uninstall-offer";
import { uninstallRevisions } from "./anidachi-auth/uninstall-revision";

const first: UninstallOffer = { kind: "first_month", ownerUserId: "a", validForMs: 60000, revision: "r1", prices: [calculateUninstallPrice("plus", 799), calculateUninstallPrice("pro", 1499)] };
const renewal: UninstallOffer = { kind: "renewal", ownerUserId: "a", validForMs: 60000, revision: "r2", price: calculateUninstallPrice("pro", 1499), renewsAt: "2030-12-04T00:00:00Z", manageUrl: "/account/billing?manage=1" };
const claimed: UninstallOffer = { ...renewal, kind: "claimed", state: "accepted", reason: "", };
const signedOut: UninstallOffer = { kind: "sign_in", ownerUserId: null, validForMs: 60000, loginUrl: "/login?next=%2Funinstall" };
const originalFetch = globalThis.fetch;
let root: Root | null = null;
let container: HTMLDivElement;
let current: UninstallOffer = first;
let posts: Array<{ path: string; body: Record<string, unknown> }> = [];
let handlePost: (path: string, body: Record<string, unknown>) => Promise<Response>;
let get: () => Promise<Response>;
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r; }); return { promise, resolve }; }
async function mount(initialPlan: "plus" | "pro" = "plus", initialOffer: UninstallOffer = first) {
  dom.happyDOM.setURL("https://staging.anidachi.app/uninstall");
  current = initialOffer;
  posts = [];
  get = async () => Response.json(current);
  handlePost = async () => Response.json({ saved: true });
  globalThis.fetch = async (path, init) => {
    if (!init?.method) return get();
    const body = JSON.parse(String(init.body)); posts.push({ path: String(path), body });
    return handlePost(String(path), body);
  };
  container = document.createElement("div"); document.body.append(container);
  root = createRoot(container);
  await act(async () => root?.render(React.createElement(UninstallClient, { initialPlan, stagingInstallation: true })));
}
async function flush() { await act(async () => {}); }
function button(text: string) { const found = [...container.querySelectorAll("button")].find((b) => b.textContent?.trim().startsWith(text)); assert.ok(found, `Missing ${text}`); return found; }
async function click(text: string) { await act(async () => button(text).click()); }
async function focus() { await act(async () => window.dispatchEvent(new Event("focus"))); }
afterEach(async () => {
  await act(async () => root?.unmount()); root = null;
  document.body.innerHTML = ""; dom.sessionStorage.clear(); globalThis.fetch = originalFetch;
});

test("real first offer reviews both server prices and submits exactly one owner-bound checkout", async () => {
  await mount("pro");
  await click("Get 40% off");
  assert.match(container.textContent!, /\$4\.79/); assert.match(container.textContent!, /\$8\.99/);
  assert.equal(container.querySelector<HTMLInputElement>('input[name="plan"][value="pro"]')?.checked, true);
  await click("Continue");
  assert.match(container.querySelector("dialog")!.textContent!, /Pro, billed monthly[\s\S]*\$8\.99[\s\S]*\$14\.99/);
  const pending = deferred<Response>(); handlePost = async () => pending.promise;
  await click("Continue to checkout");
  assert.equal(button("Checking").disabled, true);
  await act(async () => button("Checking").click());
  assert.equal(posts.length, 1);
  assert.deepEqual(posts[0].body.expectedPrice, calculateUninstallPrice("pro", 1499));
  assert.equal(posts[0].body.expectedOwnerUserId, "a"); assert.equal(posts[0].body.revision, "r1");
  assert.match(String(posts[0].body.requestId), /^[\da-f-]{36}$/);
  pending.resolve(Response.json({ ownerUserId: "a", kind: "checkout", url: "https://checkout.stripe.com/c/pay/test" }));
  await flush();
  assert.equal(window.location.hostname, "checkout.stripe.com");
});

test("failed checkout retains reviewed terms and reuses request ID on retry", async () => {
  await mount(); await click("Get 40% off"); await click("Continue");
  handlePost = async () => Response.json({ ownerUserId: "a", error: "Please retry checkout." }, { status: 503 });
  await click("Continue to checkout"); assert.match(container.querySelector("dialog")!.textContent!, /Please retry checkout/);
  await click("Continue to checkout"); assert.equal(posts.length, 2);
  assert.equal(posts[0].body.requestId, posts[1].body.requestId);
  assert.equal(window.location.pathname, "/uninstall");
});

test("owner change before action updates page and never posts old offer", async () => {
  await mount(); await click("Get 40% off"); await click("Continue");
  current = { ...renewal, ownerUserId: "b" };
  await click("Continue to checkout");
  assert.equal(posts.length, 0); assert.match(container.textContent!, /account or offer changed/);
  assert.match(container.textContent!, /Your next month of Pro/); assert.equal(container.querySelector("dialog")?.hasAttribute("open"), false);
});

test("changed first-month prices require a new explicit review and cannot charge", async () => {
  await mount(); await click("Get 40% off"); await click("Continue");
  current = { ...first, revision: "r3", prices: [calculateUninstallPrice("plus", 899), calculateUninstallPrice("pro", 1499)] };
  await click("Continue to checkout"); assert.equal(posts.length, 0); assert.match(container.textContent!, /Review the current offer/);
});

test("old checkout success cannot navigate after owner changes at the final check", async () => {
  await mount(); await click("Get 40% off"); await click("Continue");
  handlePost = async () => { current = { ...renewal, ownerUserId: "b" }; return Response.json({ ownerUserId: "a", kind: "checkout", url: "https://checkout.stripe.com/c/pay/test" }); };
  await click("Continue to checkout");
  assert.equal(window.location.pathname, "/uninstall"); assert.match(container.textContent!, /account or offer changed/);
});

test("background action results cannot show success or navigate; focusing reloads authoritative owner", async () => {
  await mount(); current = renewal; await focus(); await click("Get 40% off");
  const pending = deferred<Response>(); handlePost = async () => pending.promise;
  await click("Apply to next renewal");
  await act(async () => window.dispatchEvent(new Event("blur")));
  assert.doesNotMatch(container.textContent!, /Your next month of Pro|Discount saved/);
  pending.resolve(Response.json(claimed)); await flush();
  assert.doesNotMatch(container.textContent!, /Discount saved/);
  current = { ...first, ownerUserId: "b" }; await focus();
  assert.match(container.textContent!, /One month of Plus or Pro/); assert.doesNotMatch(container.textContent!, /Discount saved/);
});

test("out of order offer responses cannot replace current owner", async () => {
  await mount(); const pending = deferred<Response>(); get = async () => pending.promise;
  await focus();
  current = renewal; get = async () => Response.json(current); await focus();
  pending.resolve(Response.json(first)); await flush();
  assert.match(container.textContent!, /Your next month of Pro/); assert.doesNotMatch(container.textContent!, /One month of Plus or Pro/);
});

test("renewal is explicit, shows actual UTC date, then restores verified accepted claim", async () => {
  await mount(); current = renewal; await focus();
  await click("Get 40% off"); assert.match(container.querySelector("dialog")!.textContent!, /December 4, 2030 \(UTC\)/);
  assert.equal(posts.length, 0);
  handlePost = async () => { current = claimed; return Response.json(claimed); };
  await click("Apply to next renewal");
  assert.equal(posts.length, 1); assert.deepEqual(posts[0].body, { expectedOwnerUserId: "a", revision: "r2" });
  assert.match(container.textContent!, /Discount saved for your next renewal/);
  assert.ok(button("Manage")); assert.doesNotMatch(container.textContent!, /Get 40% off/);
  await focus(); assert.match(container.textContent!, /Discount saved for your next renewal/);
});

test("failed renewal stays retryable, and an unverified result never announces success", async () => {
  await mount(); current = renewal; await focus(); await click("Get 40% off");
  handlePost = async () => Response.json({ ownerUserId: "a", error: "Please retry." }, { status: 503 });
  await click("Apply to next renewal"); assert.match(container.textContent!, /Please retry/); assert.doesNotMatch(container.textContent!, /Discount saved/);
  handlePost = async () => Response.json(claimed);
  await click("Apply to next renewal"); assert.match(container.textContent!, /couldn’t confirm your discount/); assert.doesNotMatch(container.textContent!, /Discount saved/);
});

for (const state of ["applied", "ineligible", "reconciliation"] as const) test(`${state} never promises another future discount`, async () => {
  await mount(); current = { ...claimed, state }; await focus();
  assert.doesNotMatch(container.textContent!, /40% off your next month|Discount saved|Get 40% off|Discount applied/);
  assert.ok(button("Manage"));
  if (state === "applied") assert.match(container.textContent!, /discount was applied/);
});

test("unavailable retry shows neither purchase nor wrong-account pricing", async () => {
  await mount(); current = { kind: "unavailable", ownerUserId: "b", validForMs: 60000, reason: "unavailable" }; await focus();
  assert.doesNotMatch(container.textContent!, /Get 40% off|\$4.79/); assert.ok(container.querySelector('a[href="/account/billing"]'));
  current = first; await click("Retry"); assert.match(container.textContent!, /Get 40% off/);
});

test("signed-out selection survives native login with no invented price and subscriber return is re-evaluated", async () => {
  await mount("pro"); current = signedOut; await focus(); await click("Sign in to check");
  const dialog = container.querySelector("dialog")!;
  assert.doesNotMatch(dialog.textContent!, /\$|40%/);
  assert.equal(dialog.querySelector('a')?.getAttribute("href"), "/login?next=%2Funinstall%3Fplan%3Dpro");
  assert.equal(posts.length, 0);
  current = renewal; await focus(); assert.match(container.textContent!, /Your next month of Pro/); assert.equal(posts.length, 0);
});

test("optional feedback sends only on submit, retries idempotently, and clears local draft on verified success", async () => {
  await mount(); assert.equal(button("Send feedback").disabled, true); assert.equal(posts.length, 0);
  await act(async () => (container.querySelector('input[value="not_using"]') as HTMLInputElement).click());
  assert.match(dom.sessionStorage.getItem("anidachi.uninstall.feedback.v1")!, /not_using/); assert.equal(posts.length, 0);
  handlePost = async () => Response.json({ error: "unavailable" }, { status: 503 });
  await click("Send feedback"); assert.match(container.textContent!, /couldn’t send/);
  const pending = deferred<Response>(); handlePost = async () => pending.promise;
  await click("Send feedback"); await act(async () => button("Sending").click()); assert.equal(posts.length, 2);
  assert.equal(posts[0].body.submissionId, posts[1].body.submissionId);
  pending.resolve(Response.json({ saved: true })); await flush();
  assert.match(container.textContent!, /Thanks for your feedback/); assert.equal(dom.sessionStorage.getItem("anidachi.uninstall.feedback.v1"), null);
  assert.equal(document.activeElement?.getAttribute("role"), "status");
});

test("survey draft restores after same-tab login; invalid oversized draft is ignored", async () => {
  await mount(); await act(async () => (container.querySelector('input[value="other"]') as HTMLInputElement).click());
  await act(async () => root?.unmount()); root = null;
  root = createRoot(container); await act(async () => root?.render(React.createElement(UninstallClient, { stagingInstallation: true })));
  assert.equal(container.querySelector<HTMLInputElement>('input[value="other"]')?.checked, true); assert.ok(container.querySelector("textarea")); assert.equal(posts.length, 0);
  await act(async () => root?.unmount()); root = null;
  dom.sessionStorage.setItem("anidachi.uninstall.feedback.v1", JSON.stringify({ version: 1, reason: "other", note: "x".repeat(501), expanded: true }));
  root = createRoot(container); await act(async () => root?.render(React.createElement(UninstallClient, { stagingInstallation: true })));
  assert.equal(button("Send feedback").disabled, true); assert.equal(container.querySelector("textarea"), null);
});

test("staging reinstall explains actual unpacked installation and dialog closes on native cancel", async () => {
  await mount(); await click("Reinstall staging");
  const dialog = container.querySelector("dialog")!;
  assert.equal(dialog.hasAttribute("open"), true); assert.match(dialog.textContent!, /Developer mode[\s\S]*Load unpacked[\s\S]*existing reviewed staging/);
  assert.doesNotMatch(dialog.textContent!, /Chrome Web Store|success|\/Users\//);
  assert.equal(document.activeElement?.id, "uninstall-dialog-title");
  await act(async () => dialog.dispatchEvent(new Event("cancel", { bubbles: false })));
  assert.equal(dialog.hasAttribute("open"), false);
});

test("legacy former response remains readable during rolling deployment", async () => {
  await mount(); current = { kind: "former", ownerUserId: "a", validForMs: 60000, reason: "Previously paid" }; await focus();
  assert.equal(container.querySelector(".uninstall-offer"), null); assert.match(container.textContent!, /Why did you uninstall/);
  assert.equal(container.querySelector('a[href="/pricing?billing=monthly"]')?.textContent, "View plans ↗");
});

test("new-subscription screens also describe returning subscribers and disclose one lifetime discount", async () => {
  await mount();
  assert.match(container.textContent!, /One month of Plus or Pro/);
  assert.doesNotMatch(container.textContent!, /First purchase only|Welcome back|first paid month/);
  await click("Get 40% off");
  assert.match(container.querySelector("dialog")!.textContent!, /first month of your new subscription/);
  assert.match(container.querySelector("dialog")!.textContent!, /Once per account/);
  await click("Continue");
  assert.match(container.querySelector("dialog")!.textContent!, /first month of your new subscription/);
});

test("used discount explains why no new offer is available", async () => {
  await mount(); current = { kind: "disabled", ownerUserId: "a", validForMs: 60000, reason: "Your one-time 40% discount has already been used." }; await focus();
  assert.match(container.textContent!, /already been used/);
  assert.doesNotMatch(container.textContent!, /Get 40% off/);
  assert.ok(container.querySelector('a[href="/pricing?billing=monthly"]'));
});

test("management checks the current owner and uses the server management path", async () => {
  await mount(); current = renewal; await focus(); await click("Manage");
  assert.equal(window.location.pathname + window.location.search, "/account/billing?manage=1");
});

test("management cannot use an old account or foreign destination", async () => {
  await mount(); current = renewal; await focus();
  current = { ...renewal, ownerUserId: "b" }; await click("Manage");
  assert.equal(window.location.pathname, "/uninstall");
  current = { ...renewal, ownerUserId: "b", manageUrl: "https://evil.example/account/billing" }; await focus(); await click("Manage");
  assert.equal(window.location.pathname, "/uninstall");
});

test("checkout rejects foreign destinations even after a successful owner check", async () => {
  await mount(); await click("Get 40% off"); await click("Continue");
  handlePost = async () => Response.json({ ownerUserId: "a", kind: "checkout", url: "https://evil.example/pay" });
  await click("Continue to checkout");
  assert.equal(window.location.pathname, "/uninstall"); assert.match(container.textContent!, /couldn’t verify checkout/);
});

test("malformed offer never renders guessed prices or an enabled purchase", async () => {
  await mount(); get = async () => Response.json({ ...first, prices: [] }); await focus();
  assert.match(container.textContent!, /couldn’t verify your offer/); assert.doesNotMatch(container.textContent!, /Get 40% off|\$/);
});

test("an aged review must be reviewed again before a financial action", async (t) => {
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  await mount(); await click("Get 40% off"); await click("Continue");
  now += 60001;
  await click("Continue to checkout"); assert.equal(posts.length, 0); assert.match(container.textContent!, /Review the current offer/);
});


test("freshly issued time-advanced token permits checkout with the originally reviewed token", async (t) => {
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  const revisions = uninstallRevisions(new Uint8Array(32).fill(7), () => now);
  const snapshot = JSON.stringify({ kind: "first_month", owner: "a", prices: first.kind === "first_month" ? first.prices : [] });
  const original = revisions.sign(snapshot);
  await mount("pro", { ...first, revision: original });
  await click("Get 40% off"); await click("Continue");
  now += 1000;
  const reissued = revisions.sign(snapshot);
  assert.notEqual(original, reissued);
  current = { ...first, revision: reissued };
  handlePost = async (path, body) => {
    assert.equal(path, "/api/uninstall/checkout");
    revisions.verify(String(body.revision), snapshot);
    return Response.json({ ownerUserId: "a", kind: "checkout", url: "https://checkout.stripe.com/c/pay/test" });
  };
  await click("Continue to checkout");
  assert.equal(posts.length, 1, "unchanged terms with a reissued token must reach checkout");
  assert.equal(posts[0].body.revision, original, "server must verify the token the user actually reviewed");
  assert.equal(window.location.hostname, "checkout.stripe.com");
});

test("freshly issued time-advanced token permits renewal claim with the originally reviewed token", async (t) => {
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  const revisions = uninstallRevisions(new Uint8Array(32).fill(7), () => now);
  const snapshot = JSON.stringify({ kind: "renewal", owner: "a", price: renewal.kind === "renewal" ? renewal.price : null, renewsAt: "2030-12-04T00:00:00Z" });
  const original = revisions.sign(snapshot);
  await mount("pro", { ...renewal, revision: original });
  await click("Get 40% off");
  now += 1000;
  const reissued = revisions.sign(snapshot);
  assert.notEqual(original, reissued);
  current = { ...renewal, revision: reissued };
  handlePost = async (path, body) => {
    assert.equal(path, "/api/uninstall/claim");
    revisions.verify(String(body.revision), snapshot);
    current = claimed;
    return Response.json(claimed);
  };
  await click("Apply to next renewal");
  assert.equal(posts.length, 1, "unchanged terms with a reissued token must reach claim");
  assert.equal(posts[0].body.revision, original);
  assert.match(container.textContent!, /Discount saved for your next renewal/);
});


for (const kind of ["checkout", "claim"] as const) test(`expired real ${kind} token cannot be replaced implicitly by the fresh GET`, async (t) => {
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  const revisions = uninstallRevisions(new Uint8Array(32).fill(7), () => now);
  const snapshot = JSON.stringify({ kind, owner: "a", terms: "unchanged" });
  const original = revisions.sign(snapshot);
  const displayed = kind === "checkout" ? first : renewal;
  await mount("pro", { ...displayed, revision: original });
  await click("Get 40% off");
  if (kind === "checkout") await click("Continue");
  now += 60000;
  assert.throws(() => revisions.verify(original, snapshot), /changed or expired/);
  current = { ...displayed, revision: revisions.sign(snapshot) };
  await click(kind === "checkout" ? "Continue to checkout" : "Apply to next renewal");
  assert.equal(posts.length, 0);
  assert.match(container.textContent!, /Review the current offer/);
  assert.doesNotMatch(container.textContent!, /Discount saved/);
});

for (const term of ["price", "date"] as const) test(`changed renewal ${term} requires a new explicit review`, async () => {
  await mount("pro", renewal); await click("Get 40% off");
  current = term === "price" ? { ...renewal, price: calculateUninstallPrice("pro", 1599) } : { ...renewal, renewsAt: "2030-12-05T00:00:00Z" };
  await click("Apply to next renewal");
  assert.equal(posts.length, 0); assert.match(container.textContent!, /Review the current offer/);
});

test("server still rejects an original token when non-displayed snapshot terms change", async (t) => {
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  const revisions = uninstallRevisions(new Uint8Array(32).fill(7), () => now);
  const original = revisions.sign("original server snapshot");
  await mount("pro", { ...renewal, revision: original }); await click("Get 40% off");
  now += 1000;
  current = { ...renewal, revision: revisions.sign("changed server snapshot") };
  handlePost = async (_path, body) => {
    assert.equal(body.revision, original);
    try { revisions.verify(String(body.revision), "changed server snapshot"); }
    catch (error) { return Response.json({ ownerUserId: "a", error: (error as Error).message }, { status: 409 }); }
    throw new Error("original proof must not authorize a changed snapshot");
  };
  await click("Apply to next renewal");
  assert.equal(posts.length, 1); assert.match(container.textContent!, /changed or expired/);
  assert.doesNotMatch(container.textContent!, /Discount saved/); assert.equal(window.location.pathname, "/uninstall");
});
