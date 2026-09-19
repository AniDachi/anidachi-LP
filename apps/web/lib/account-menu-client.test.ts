import { dom } from "./test-helpers/account-client-dom";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { RouterContext } from "next/dist/shared/lib/router-context.shared-runtime";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { WatchHistoryEditorResponse, WatchHistoryItem } from "@anidachi/protocol";
// This is the export used by both the site navbar and app/account/layout.tsx.
import { UserMenu } from "../components/nav-bar-client";
import { ProfileClient } from "../app/account/profile/profile-client";
import { HistoryBrowser } from "../app/account/watch-library/history-browser";

const user = { displayName: "Alex Morgan", email: "alex@example.com", plan: "plus", avatarUrl: null };
const owner = "11111111-1111-4111-8111-111111111111";
const startUrl = "http://localhost/account/watch-library";
const navigations: string[] = [];
const router = { push: (href: string) => navigations.push(href), replace() {}, back() {}, forward() {}, refresh() {}, prefetch: async () => undefined };
let root: Root | null = null;
let container: HTMLDivElement;
const originalFetch = globalThis.fetch;
const originalConfirm = window.confirm;

function render(pathname: string, editor?: React.ReactNode) {
  return React.createElement(RouterContext.Provider, { value: router as unknown as React.ContextType<typeof RouterContext> },
    React.createElement(AppRouterContext.Provider, { value: router },
      React.createElement(PathnameContext.Provider, { value: pathname },
        React.createElement(UserMenu, { user }), editor)));
}
async function mount(editor?: React.ReactNode) {
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  await act(async () => root!.render(render("/account/watch-library", editor)));
}
function trigger() { return container.querySelector<HTMLButtonElement>('button[aria-label="Account menu"]')!; }
function button(label: string, scope: ParentNode = container) {
  const result = [...scope.querySelectorAll<HTMLButtonElement>("button")].find(node => node.textContent?.trim() === label);
  assert.ok(result, `Missing button: ${label}`);
  return result;
}
async function click(label: string, scope?: ParentNode) { await act(async () => button(label, scope).click()); }
async function open() { await act(async () => trigger().click()); }
function confirmDialog() { return container.querySelector<HTMLDialogElement>('dialog[aria-label="Save before leaving?"]'); }

afterEach(async () => {
  await act(async () => root?.unmount()); root = null; document.body.innerHTML = "";
  globalThis.fetch = originalFetch; window.confirm = originalConfirm;
  dom.happyDOM.setURL(startUrl); navigations.length = 0;
});

test("the account layout export offers every account shortcut", async () => {
  await mount(); await open();
  const links = [...container.querySelectorAll("nav a")];
  assert.deepEqual(links.map(a => [a.textContent, a.getAttribute("href")]), [
    ["Watch Library", "/account/watch-library"], ["Friends & Groups", "/account/friends"],
    ["Subscription", "/account/billing"], ["Profile", "/account/profile"], ["Help", "/account/help"],
  ]);
  assert.equal(links[0].getAttribute("aria-current"), "page");
  assert.equal(trigger().getAttribute("aria-controls"), container.querySelector("nav")?.id);
});

test("Escape closes the disclosure and returns focus to the avatar", async () => {
  await mount(); await open();
  await act(async () => container.querySelector<HTMLAnchorElement>('a[href="/account/friends"]')!.focus());
  await act(async () => dom.document.dispatchEvent(new dom.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
  assert.equal(trigger().getAttribute("aria-expanded"), "false");
  assert.equal(document.activeElement, trigger());
});

test("moving focus or tapping outside closes the disclosure", async () => {
  await mount(); await open();
  await act(async () => dom.document.dispatchEvent(new dom.PointerEvent("pointerdown", { bubbles: true })));
  assert.equal(trigger().getAttribute("aria-expanded"), "false");
  await open();
  const outside = document.createElement("button");
  document.body.append(outside);
  await act(async () => outside.focus());
  assert.equal(trigger().getAttribute("aria-expanded"), "false");
});

test("a completed account route change closes the disclosure", async () => {
  await mount(); await open();
  await act(async () => root!.render(render("/account/profile")));
  assert.equal(trigger().getAttribute("aria-expanded"), "false");
});

test("an accepted logout posts once and leaves only after the response succeeds", async () => {
  let release!: (response: Response) => void;
  const requests: Array<[string, string | undefined]> = [];
  globalThis.fetch = async (input, init) => {
    requests.push([String(input), init?.method]);
    return new Promise<Response>(resolve => { release = resolve; });
  };
  await mount(); await open(); await click("Sign out");
  assert.deepEqual(requests, [["/api/auth/logout", "POST"]]);
  assert.equal(window.location.href, startUrl);
  await act(async () => release(new Response(null, { status: 204 })));
  assert.equal(window.location.pathname, "/");
});

for (const failure of ["http", "network"] as const) {
  test(`${failure} logout failure retains the screen and allows an explicit retry`, async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      if (calls > 1) return new Response(null, { status: 204 });
      if (failure === "network") throw new TypeError("Network unavailable");
      return new Response(null, { status: 500 });
    };
    await mount(); await open(); await click("Sign out");
    assert.equal(window.location.href, startUrl);
    assert.match(container.querySelector('[role="alert"]')?.textContent ?? "", /Could not sign out/);
    assert.equal(button("Sign out").disabled, false);
    await click("Sign out");
    assert.equal(calls, 2);
    assert.equal(window.location.pathname, "/");
  });
}

test("rapid sign-out clicks cannot send overlapping logout requests", async () => {
  let calls = 0;
  let release!: (response: Response) => void;
  globalThis.fetch = async () => { calls++; return new Promise<Response>(resolve => { release = resolve; }); };
  await mount(); await open();
  const signOut = button("Sign out");
  await act(async () => { signOut.click(); signOut.click(); });
  assert.equal(calls, 1);
  await act(async () => release(new Response(null, { status: 500 })));
});

test("an accepted editor callback can run only once, including after a failed request", async () => {
  let calls = 0;
  let proceed: (() => Promise<void>) | undefined;
  const protect = (event: Event) => { event.preventDefault(); proceed = (event as CustomEvent<() => Promise<void>>).detail; };
  globalThis.fetch = async () => { calls++; return new Response(null, { status: 500 }); };
  window.addEventListener("anidachi:before-sign-out", protect);
  try {
    await mount(); await open(); await click("Sign out");
    assert.equal(calls, 0);
    assert.equal(typeof proceed, "function");
    await act(async () => { await Promise.all([proceed!(), proceed!()]); await proceed!(); });
    assert.equal(calls, 1);
    assert.match(container.querySelector('[role="alert"]')?.textContent ?? "", /Could not sign out/);
  } finally { window.removeEventListener("anidachi:before-sign-out", protect); }
});

async function dirtyProfile() {
  await mount(React.createElement(ProfileClient, { ownerUserId: owner, email: user.email,
    initialProfile: { displayName: user.displayName, handle: "alex", avatarUrl: null } }));
  const field = [...container.querySelectorAll<HTMLInputElement>("input")].find(node => node.labels?.[0]?.textContent?.includes("Display name"))!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, "Unsaved Alex");
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  return field;
}

test("the real profile guard cancels the menu logout and keeps its draft", async () => {
  let calls = 0;
  let confirmations = 0;
  globalThis.fetch = async () => { calls++; return new Response(null, { status: 204 }); };
  window.confirm = () => { confirmations++; return false; };
  const field = await dirtyProfile(); await open(); await click("Sign out");
  assert.equal(confirmations, 1); assert.equal(calls, 0);
  assert.equal(field.value, "Unsaved Alex");
  assert.equal(window.location.href, startUrl);
});

test("accepting the real profile discard confirmation allows exactly one logout", async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(null, { status: 204 }); };
  window.confirm = () => true;
  await dirtyProfile(); await open(); await click("Sign out");
  assert.equal(calls, 1); assert.equal(window.location.pathname, "/");
});

test("canceled profile navigation leaves the editor and account disclosure mounted", async () => {
  window.confirm = () => false;
  const field = await dirtyProfile(); await open();
  await act(async () => container.querySelector<HTMLAnchorElement>('a[href="/account/friends"]')!.click());
  assert.deepEqual(navigations, []);
  assert.equal(trigger().getAttribute("aria-expanded"), "true");
  assert.equal(field.isConnected, true); assert.equal(field.value, "Unsaved Alex");
});

const meta = { schemaVersion: 3 as const, ownerUserId: owner, accountGeneration: 1, serverTime: "2026-09-10T00:00:00Z" };
const title: WatchHistoryItem = {
  provider: "crunchyroll", titleKey: "crunchyroll:movie:E1", title: "Test film", itemKind: "movie",
  sourceUrl: "https://www.crunchyroll.com/watch/E1", artworkUrl: null, catalogState: "complete",
  observedEpisodeCount: 1, completedEpisodeCount: 0, episodePage: { complete: true, nextCursor: null },
  aggregate: { completedEpisodes: 0, availableEpisodes: 1, progress: 0 }, seasons: [], sessions: [],
  latestActivity: { episodeKey: "E1", currentTime: 20, duration: 100, progress: .2, completedAt: null, lastWatchedAt: meta.serverTime },
  lastWatchedAt: meta.serverTime,
};
const editorData: WatchHistoryEditorResponse = {
  meta, provider: "crunchyroll", titleKey: title.titleKey, revision: "a".repeat(32), catalogComplete: true,
  episodes: [{ episodeKey: "E1", episodeTitle: title.title, episodeNumber: null, seasonKey: null,
    seasonTitle: null, seasonNumber: null, seasonOrder: 0, order: 0, sourceUrl: title.sourceUrl,
    available: true, watched: false, currentTime: 20, duration: 100, progress: .2 }],
};

async function dirtyHistory(save?: (init: RequestInit) => Promise<Response>) {
  let logouts = 0;
  let saves = 0;
  globalThis.fetch = async (input, init) => {
    if (String(input) === "/api/auth/logout") { logouts++; return new Response(null, { status: 204 }); }
    assert.ok(String(input).startsWith("/api/watch-history/v3/editor"));
    if (init?.method === "POST") { saves++; assert.ok(save, "Unexpected history save"); return save(init); }
    return Response.json(editorData);
  };
  await mount(React.createElement(HistoryBrowser, {
    items: [title], owner, generation: 1, canEdit: true, busy: false, nextCursor: null, loadingMore: false,
    capacity: null, onLoadMore() {}, onEdited: async () => undefined, onDraftChange() {},
    captureAccessFailure: () => () => false, onResume() {}, onDelete() {},
  }));
  await act(async () => container.querySelector<HTMLButtonElement>('button[aria-label="Manage Test film"]')!.click());
  await click("Edit"); await click("Mark watched");
  assert.match(container.textContent ?? "", /1 unsaved change/);
  return { logouts: () => logouts, saves: () => saves };
}

test("Stay in the real history guard sends no logout and retains the progress draft", async () => {
  const requests = await dirtyHistory(); await open(); await click("Sign out");
  assert.equal(requests.logouts(), 0); assert.ok(confirmDialog()?.open);
  await click("Stay", confirmDialog()!);
  assert.equal(confirmDialog(), null); assert.equal(requests.logouts(), 0);
  assert.match(container.textContent ?? "", /1 unsaved change/);
  assert.equal(window.location.href, startUrl);
});

test("Discard in the real history guard sends one logout without saving", async () => {
  const requests = await dirtyHistory(); await open(); await click("Sign out");
  assert.equal(requests.logouts(), 0); assert.ok(confirmDialog()?.open);
  await click("Discard", confirmDialog()!);
  assert.equal(requests.logouts(), 1); assert.equal(requests.saves(), 0);
  assert.equal(window.location.pathname, "/");
});

test("Save & leave waits for the real history save acknowledgement before logout", async () => {
  let release!: (response: Response) => void;
  let mutation: string | undefined;
  const requests = await dirtyHistory(async init => {
    const body = JSON.parse(String(init.body)); mutation = body.clientMutationId;
    assert.deepEqual(body.changes, [{ episodeKey: "E1", watched: true }]);
    return new Promise<Response>(resolve => { release = resolve; });
  });
  await open(); await click("Sign out"); assert.ok(confirmDialog()?.open);
  await click("Save & leave", confirmDialog()!);
  assert.equal(requests.saves(), 1); assert.equal(requests.logouts(), 0);
  assert.equal(window.location.href, startUrl);
  await act(async () => release(Response.json({ meta, clientMutationId: mutation, revision: "b".repeat(32) })));
  assert.equal(requests.logouts(), 1); assert.equal(window.location.pathname, "/");
});

test("a failed real history save keeps the draft and never calls logout", async () => {
  const requests = await dirtyHistory(async () => Response.json({ error: "Save is unavailable" }, { status: 503 }));
  await open(); await click("Sign out"); assert.ok(confirmDialog()?.open);
  await click("Save & leave", confirmDialog()!);
  assert.equal(requests.saves(), 1); assert.equal(requests.logouts(), 0);
  assert.ok(confirmDialog()?.open); assert.match(container.textContent ?? "", /1 unsaved change/);
  assert.match(container.querySelector('[role="alert"]')?.textContent ?? "", /Save is unavailable/);
  assert.equal(window.location.href, startUrl);
});
