import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PopupWelcome } from "../src/popup-welcome";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let data: Record<string, unknown>;
let root: Root;
let host: HTMLDivElement;
let get: ReturnType<typeof vi.fn>;
const openSettings = vi.fn();
let inView = true;
let visibilityChanged: (visible: boolean) => void;

beforeEach(() => {
  data = {}; openSettings.mockReset(); inView = true;
  vi.stubGlobal("IntersectionObserver", class {
    constructor(private callback: IntersectionObserverCallback) {}
    observe(target: Element) {
      visibilityChanged = (visible) => this.callback([{ target, isIntersecting: visible, intersectionRatio: visible ? 1 : 0 } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
      visibilityChanged(inView);
    }
    disconnect() {}
  });
  get = vi.fn(async (key: string) => ({ [key]: data[key] }));
  vi.stubGlobal("chrome", { storage: { local: { get, set: async (values: Record<string, unknown>) => { Object.assign(data, values); } } } });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function render(active = true) {
  await act(async () => root.render(<StrictMode><PopupWelcome active={active} onOpenSettings={openSettings} /></StrictMode>));
}
async function remount() { await act(async () => root.unmount()); root = createRoot(host); await render(); }
function button(label: string) { return [...host.querySelectorAll("button")].find(b => b.textContent === label)!; }

it("shows the introduction once even when the popup closes without Got it", async () => {
  await render();
  expect(host.querySelector('[aria-label="Welcome to AniDachi"]')).not.toBeNull();
  expect(data).toEqual({ "anidachi.welcomeSeen.v1": true });
  await remount();
  expect(host.querySelector("section")).toBeNull();
});
it("dismisses with Got it without writing any history preference", async () => {
  data["anidachi.historyRecordingChoice:owner-a"] = { enabled: false };
  await render();
  expect(button("Got it")).toBeTruthy();
  await act(async () => button("Got it").click());
  expect(host.querySelector("section")).toBeNull();
  expect(data).toEqual({ "anidachi.welcomeSeen.v1": true, "anidachi.historyRecordingChoice:owner-a": { enabled: false } });
});
it("does not consume the welcome while the Watch tab is hidden", async () => {
  await render(false);
  expect(data).toEqual({});
  expect(host.querySelector("section")).toBeNull();
  await render(true);
  expect(button("Got it")).toBeTruthy();
  expect(data["anidachi.welcomeSeen.v1"]).toBe(true);
});
it("opens Settings directly from the explanation", async () => {
  await render();
  expect(button("Settings")).toBeTruthy();
  await act(async () => button("Settings").click());
  expect(openSettings).toHaveBeenCalledOnce();
});
it("does not consume the welcome if its storage read completes after hiding", async () => {
  let resolve!: (value: Record<string, unknown>) => void;
  get.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
  // Avoid StrictMode here to isolate the one pending read.
  await act(async () => root.render(<PopupWelcome active onOpenSettings={openSettings} />));
  await act(async () => root.render(<PopupWelcome active={false} onOpenSettings={openSettings} />));
  await act(async () => resolve({}));
  expect(data).toEqual({});
  expect(host.querySelector("section")).toBeNull();
});

it("does not mark an offscreen introduction seen until it enters the popup viewport", async () => {
  inView = false;
  await render();
  expect(data).toEqual({});
  await act(async () => visibilityChanged(true));
  expect(data).toEqual({ "anidachi.welcomeSeen.v1": true });
});
