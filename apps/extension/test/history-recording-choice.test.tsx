import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isHistoryRecordingEnabled, historyRecordingChoiceKey, historyRecordingContextRevision, parseHistoryRecordingChoice,
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
async function render(owner: string | null = auth.owner) {
  await act(async () => root.render(<PopupHistoryRecordingChoice ownerUserId={owner} />));
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

  it("enables a missing preference without opening the popup and fails closed on invalid or unreadable data", async () => {
    expect(await isHistoryRecordingEnabled(auth.owner)).toBe(true);
    const valid = { version: 1, ownerUserId: auth.owner, enabled: true, updatedAt: Date.now() };
    for (const invalid of [null, {}, { ...valid, version: 0 }, { ...valid, enabled: "true" }, { ...valid, updatedAt: NaN }, { ...valid, ownerUserId: "owner-b" }]) {
      expect(parseHistoryRecordingChoice(invalid, auth.owner)).toBeNull();
      data[historyRecordingChoiceKey(auth.owner)] = invalid;
      expect(await isHistoryRecordingEnabled(auth.owner)).toBe(false);
    }
    get.mockRejectedValueOnce(new Error("storage unavailable"));
    expect(await isHistoryRecordingEnabled(auth.owner)).toBe(false);
  });

  it("preserves explicit choices independently of the default for another account", async () => {
    await setHistoryRecordingChoice("owner-a", true);
    auth.owner = "owner-b";
    expect(await isHistoryRecordingEnabled("owner-b")).toBe(true);
    await expect(setHistoryRecordingChoice("owner-a", false)).rejects.toThrow("account changed");
    await setHistoryRecordingChoice("owner-b", false);
    auth.owner = "owner-a";
    expect(await isHistoryRecordingEnabled(auth.owner)).toBe(true);
    expect(await isHistoryRecordingEnabled("owner-b")).toBe(false);
  });

  it("shows the default-on setting and stops recording without deleting saved data", async () => {
    data["history-cache"] = { titles: ["saved-title"] };
    await render();
    expect(set).not.toHaveBeenCalled();
    const toggle = () => host.querySelector<HTMLButtonElement>('[role="switch"]')!;
    expect(toggle()?.getAttribute("aria-checked")).toBe("true");
    await act(async () => toggle().click());
    expect(await isHistoryRecordingEnabled(auth.owner)).toBe(false);
    expect(data["history-cache"]).toEqual({ titles: ["saved-title"] });
    expect(toggle().getAttribute("aria-checked")).toBe("false");
    await act(async () => toggle().click());
    expect(await isHistoryRecordingEnabled(auth.owner)).toBe(true);
  });

  it("updates an open setting for its owner without inheriting another account's choice", async () => {
    await setHistoryRecordingChoice("owner-a", false);
    await render();
    expect(host.querySelector('[role="switch"]')?.getAttribute("aria-checked")).toBe("false");
    auth.owner = "owner-b"; await render();
    expect(host.querySelector('[role="switch"]')?.getAttribute("aria-checked")).toBe("true");
    await act(async () => set({ [historyRecordingChoiceKey("owner-a")]: { version: 1, ownerUserId: "owner-a", enabled: true, updatedAt: Date.now() } }));
    expect(await readHistoryRecordingChoice("owner-b")).toBeNull();
    await act(async () => setHistoryRecordingChoice("owner-b", false));
    expect(host.querySelector('[role="switch"]')?.getAttribute("aria-checked")).toBe("false");
  });

  it("does not claim a switch was saved when storage rejects it", async () => {
    await render(); set.mockRejectedValueOnce(new Error("Could not save"));
    await act(async () => host.querySelector<HTMLButtonElement>('[role="switch"]')!.click());
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("Could not save");
    expect(await isHistoryRecordingEnabled(auth.owner)).toBe(true);
    expect(host.querySelector('[role="switch"]')?.getAttribute("aria-checked")).toBe("true");
  });

  it("keeps an unreadable setting off and cannot change settings while signed out", async () => {
    get.mockRejectedValueOnce(new Error("unavailable"));
    await render();
    expect(host.querySelector('[role="switch"]')?.getAttribute("aria-checked")).toBe("false");
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    await render(null);
    expect(host.querySelector('[role="switch"]')).toBeNull();
  });
});
