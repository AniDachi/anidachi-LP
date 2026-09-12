import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PopupWatchCapacityNotice } from "../src/popup-watch-capacity-notice";
import type { PopupWatchHistoryClient } from "../src/popup-watch-history";
import type { WatchHistoryMessageResponse } from "../src/watch-history-client";

const owner = "00000000-0000-4000-8000-000000000001";
const capacity = (used = 100) => ({ capacityVersion: 1, ownerUserId: owner, accountGeneration: 1, serverTime: new Date().toISOString(),
  providers: { youtube: { used, limit: 100 }, crunchyroll: { used: 199, limit: 200 } } });
let root: Root;
let container: HTMLDivElement;
beforeEach(() => { (globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div"); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const client = (request: PopupWatchHistoryClient["request"]): PopupWatchHistoryClient => ({ request, loadCached: async () => null, openUrl: vi.fn(async () => {}), confirmDiscard: () => false });
async function render(c: PopupWatchHistoryClient, revision = "1", user = owner, recordingAllowed = true) {
  await act(async () => root.render(<PopupWatchCapacityNotice client={c} ownerUserId={user} accountGeneration={1} revision={revision} recordingAllowed={recordingAllowed} />));
}
describe("history capacity notice", () => {
  it("shows only full resources, opens management and clears after space is freed", async () => {
    let used = 100;
    const c = client(async () => ({ ok: true, data: capacity(used) }));
    await render(c);
    expect(container.textContent).toContain("YouTube 100/100");
    expect(container.textContent).not.toContain("Crunchyroll");
    expect(container.textContent).toContain("Saved titles keep updating");
    await act(async () => container.querySelector("button")!.click());
    expect(new URL(vi.mocked(c.openUrl).mock.calls[0]![0]).pathname).toBe("/account/watch-library");
    used = 99;
    await render(c, "2");
    expect(container.textContent).toBe("");
  });
  it("does not show old-owner metadata or let a late response restore it", async () => {
    let finish!: (value: WatchHistoryMessageResponse) => void;
    const c = client(async () => new Promise(resolve => { finish = resolve; }));
    await render(c);
    const old = finish;
    await render(c, "1", "00000000-0000-4000-8000-000000000002");
    await act(async () => old({ ok: true, data: capacity() }));
    expect(container.textContent).toBe("");
    await act(async () => finish({ ok: true, data: capacity() }));
    expect(container.textContent).toBe("");
  });
  it("keeps Free plan messaging separate and does not turn a capacity failure into an access failure", async () => {
    const request = vi.fn(async () => ({ ok: false as const, status: "retryable" as const }));
    const c = client(request);
    await render(c, "1", owner, false);
    expect(request).not.toHaveBeenCalled();
    await render(c);
    expect(container.textContent).toBe("");
  });
});
