import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  hasHistoryRecordingConsent, historyRecordingChoiceKey, historyRecordingContextRevision, parseHistoryRecordingChoice,
  readHistoryRecordingChoice, setHistoryRecordingChoice,
} from "../src/history-recording-choice";
import { PopupHistoryRecordingChoice } from "../src/popup-history-recording-choice";

const auth = vi.hoisted(() => ({ owner: "owner-a" }));
vi.mock("../src/auth-tokens", () => ({ AUTH_TOKENS_STORAGE_KEY: "authTokens", getStoredAuthTokens: async () => ({ user: { id: auth.owner } }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
type Listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => void;
let data: Record<string, unknown>;
let listeners: Set<Listener>;
let root: Root;
let host: HTMLDivElement;
let get: ReturnType<typeof vi.fn<(key: string) => Promise<Record<string, unknown>>>>;
let set: ReturnType<typeof vi.fn<(values: Record<string, unknown>) => Promise<void>>>;
beforeEach(() => {
  data = {}; listeners = new Set(); auth.owner = "owner-a";
  get = vi.fn(async (key: string) => ({ [key]: data[key] }));
  set = vi.fn(async (values: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(values)) {
      const oldValue = data[key]; data[key] = value;
      for (const listener of listeners) listener({ [key]: { oldValue, newValue: value } }, "local");
    }
  });
  vi.stubGlobal("chrome", { storage: { local: { get, set }, onChanged: {
    addListener: (listener: Listener) => listeners.add(listener),
    removeListener: (listener: Listener) => listeners.delete(listener),
  } } });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals();
});
async function render(owner = auth.owner, mode: "notice" | "settings" = "notice", paid = true) {
  await act(async () => root.render(<PopupHistoryRecordingChoice ownerUserId={owner} mode={mode} paid={paid} />));
}
async function click(text: string) {
  const button = [...host.querySelectorAll("button")].find((entry) => entry.textContent?.includes(text));
  expect(button, `button ${text}`).toBeTruthy();
  await act(async () => button!.click());
}

describe("per-account history recording choice", () => {
  it("invalidates pending recording work on account or choice changes, including revoke then allow", async () => {
    const initial = historyRecordingContextRevision();
    for (const listener of listeners) listener({ unrelated: { newValue: 1 } }, "local");
    expect(historyRecordingContextRevision()).toBe(initial);
    await setHistoryRecordingChoice(auth.owner, false);
    await setHistoryRecordingChoice(auth.owner, true);
    expect(historyRecordingContextRevision()).toBe(initial + 2);
    for (const listener of listeners) listener({ authTokens: { newValue: null } }, "local");
    expect(historyRecordingContextRevision()).toBe(initial + 3);
  });

  it("requires a current, valid choice and fails closed when storage is unavailable", async () => {
    expect(await hasHistoryRecordingConsent(auth.owner)).toBe(false);
    const valid = { version: 1, ownerUserId: auth.owner, enabled: true, updatedAt: Date.now() };
    for (const invalid of [null, {}, { ...valid, version: 0 }, { ...valid, enabled: "true" }, { ...valid, updatedAt: NaN }, { ...valid, ownerUserId: "owner-b" }]) {
      expect(parseHistoryRecordingChoice(invalid, auth.owner)).toBeNull();
    }
    get.mockRejectedValueOnce(new Error("storage unavailable"));
    expect(await hasHistoryRecordingConsent(auth.owner)).toBe(false);
  });

  it("preserves each owner's choice without granting consent after account switching", async () => {
    await setHistoryRecordingChoice("owner-a", true);
    auth.owner = "owner-b";
    expect(await hasHistoryRecordingConsent("owner-b")).toBe(false);
    await expect(setHistoryRecordingChoice("owner-a", false)).rejects.toThrow("account changed");
    await setHistoryRecordingChoice("owner-b", false);
    auth.owner = "owner-a";
    expect(await hasHistoryRecordingConsent(auth.owner)).toBe(true);
    expect(await hasHistoryRecordingConsent("owner-b")).toBe(false);
  });

  it("does not write on mount, allows declining, and can enable then revoke from Settings", async () => {
    await render();
    expect(set).not.toHaveBeenCalled();
    expect(host.textContent).toContain("video URLs, titles, episodes and playback position");
    expect(host.querySelector("a")?.getAttribute("href")).toMatch(/\/privacy$/);
    await click("Not now");
    expect(await hasHistoryRecordingConsent(auth.owner)).toBe(false);
    expect(host.textContent).toContain("recording is off");
    await click("Review"); await click("Allow recording");
    expect(await hasHistoryRecordingConsent(auth.owner)).toBe(true);
    expect(host.querySelector("section")).toBeNull();
    await render(auth.owner, "settings"); await click("Stop recording");
    expect(await readHistoryRecordingChoice(auth.owner)).toMatchObject({ enabled: false });
    expect(host.textContent).toContain("Allow recording");
  });

  it("updates an open surface for its owner and never shows the previous owner's consent", async () => {
    await setHistoryRecordingChoice("owner-a", true);
    await render(); expect(host.querySelector("section")).toBeNull();
    auth.owner = "owner-b"; await render();
    expect(host.textContent).toContain("Save your watch progress?");
    await act(async () => set({ [historyRecordingChoiceKey("owner-a")]: { version: 1, ownerUserId: "owner-a", enabled: false, updatedAt: Date.now() } }));
    expect(host.textContent).toContain("Save your watch progress?");
    await act(async () => setHistoryRecordingChoice("owner-b", true));
    expect(host.querySelector("section")).toBeNull();
  });

  it("does not claim success when saving fails and avoids a paid-history prompt on Free", async () => {
    await render(auth.owner, "notice", false);
    expect(host.querySelector("section")).toBeNull();
    await render(); set.mockRejectedValueOnce(new Error("Could not save"));
    await click("Allow recording");
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("Could not save");
    expect(await hasHistoryRecordingConsent(auth.owner)).toBe(false);
  });
});
