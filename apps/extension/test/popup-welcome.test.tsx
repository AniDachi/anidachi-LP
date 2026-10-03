import { StrictMode, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PopupWelcome } from "../src/popup-welcome";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let data: Record<string, unknown>;
let root: Root;
let host: HTMLDivElement;
let get: ReturnType<typeof vi.fn>;
let set: ReturnType<typeof vi.fn>;
const dismiss = vi.fn();
const openSettings = vi.fn();
let inView = true;
let visibilityChanged: ((visible: boolean) => void) | undefined;

beforeEach(() => {
  data = {}; openSettings.mockReset(); dismiss.mockReset(); inView = true; visibilityChanged = undefined;
  vi.stubGlobal("IntersectionObserver", class {
    constructor(private callback: IntersectionObserverCallback) {}
    observe(target: Element) {
      visibilityChanged = (visible) => this.callback([{ target, isIntersecting: visible, intersectionRatio: visible ? 1 : 0 } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
      visibilityChanged(inView);
    }
    disconnect() {}
  });
  get = vi.fn(async (key: string) => ({ [key]: data[key] }));
  set = vi.fn(async (values: Record<string, unknown>) => { Object.assign(data, values); });
  vi.stubGlobal("chrome", { storage: { local: { get, set } } });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
async function render(active = true) {
  await act(async () => root.render(<StrictMode><PopupWelcome active={active} onOpenSettings={openSettings} onDismiss={dismiss} /></StrictMode>));
}
async function remount() { await act(async () => root.unmount()); root = createRoot(host); await render(); }
function button(label: string) { return [...host.querySelectorAll("button")].find(b => b.textContent === label)!; }

it("keeps showing across popup openings until Got it is pressed", async () => {
  await render();
  for (let opening = 0; opening < 3; opening += 1) {
    expect(host.querySelector('[aria-label="Welcome to AniDachi"]')).not.toBeNull();
    expect(data).toEqual({});
    await remount();
  }
  expect(button("Got it")).toBeTruthy();
});

it("does not treat the previous automatic seen flag as an acknowledgement", async () => {
  data["anidachi.welcomeSeen.v1"] = true;
  await render();
  expect(button("Got it")).toBeTruthy();
  await remount();
  expect(button("Got it")).toBeTruthy();
});

it("keeps an acknowledged welcome hidden on later popup openings", async () => {
  data["anidachi.welcomeAcknowledged.v1"] = true;
  await render();
  expect(host.querySelector("section")).toBeNull();
  await remount();
  expect(host.querySelector("section")).toBeNull();
});
it("dismisses with Got it without writing any history preference", async () => {
  data["anidachi.historyRecordingChoice:owner-a"] = { enabled: false };
  await render();
  expect(button("Got it")).toBeTruthy();
  await act(async () => button("Got it").click());
  expect(host.querySelector("section")).toBeNull();
  expect(data).toEqual({ "anidachi.welcomeAcknowledged.v1": true, "anidachi.historyRecordingChoice:owner-a": { enabled: false } });
  expect(dismiss).toHaveBeenCalledOnce();
  await render(false);
  await render(true);
  expect(host.querySelector("section")).toBeNull();
  await remount();
  expect(host.querySelector("section")).toBeNull();
});
it("does not consume the welcome while the Watch tab is hidden", async () => {
  await render(false);
  expect(data).toEqual({});
  expect(host.querySelector("section")).toBeNull();
  await render(true);
  expect(button("Got it")).toBeTruthy();
  expect(data).toEqual({});
  await render(false);
  await render(true);
  expect(button("Got it")).toBeTruthy();
});
it("opens Settings directly from the explanation", async () => {
  await render();
  expect(button("Settings")).toBeTruthy();
  await act(async () => button("Settings").click());
  expect(openSettings).toHaveBeenCalledOnce();
  await render(false);
  await render(true);
  expect(button("Got it")).toBeTruthy();
  expect(data).toEqual({});
  await remount();
  expect(button("Got it")).toBeTruthy();
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

it("does not acknowledge the introduction when it enters the popup viewport", async () => {
  inView = false;
  await render();
  expect(data).toEqual({});
  await act(async () => visibilityChanged?.(true));
  expect(data).toEqual({});
});

it("still shows the informational welcome when its preference cannot be read", async () => {
  get.mockRejectedValue(new Error("storage unavailable"));
  await render();
  expect(button("Got it")).toBeTruthy();
  expect(data).toEqual({});
});

it("does not block the popup if acknowledgement cannot be saved", async () => {
  set.mockRejectedValue(new Error("storage unavailable"));
  await render();
  await act(async () => button("Got it").click());
  expect(host.querySelector("section")).toBeNull();
  expect(dismiss).toHaveBeenCalledOnce();
  await remount();
  expect(button("Got it")).toBeTruthy();
});
