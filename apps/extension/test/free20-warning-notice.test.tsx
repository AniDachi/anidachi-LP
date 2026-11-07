import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Free20WarningNotice } from "../src/free20-warning-notice";
import { WEB_HTTP_BASE } from "../src/constants";

let host: HTMLElement, root: Root, trigger: HTMLButtonElement, dismiss: ReturnType<typeof vi.fn<() => void>>;
const render = (props: { kind?: "warning" | "closed"; remainingSeconds?: number | null; open?: boolean } = {}) => act(async () => root.render(
  <Free20WarningNotice kind={props.kind ?? "warning"} remainingSeconds={props.remainingSeconds === undefined ? 300 : props.remainingSeconds}
    open={props.open ?? true} onDismiss={dismiss} restoreFocus={() => trigger.focus()} />,
));
describe("capsule Free20 notice", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement("div"); trigger = document.createElement("button"); document.body.append(trigger, host); root = createRoot(host); dismiss = vi.fn();
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); trigger.remove(); vi.restoreAllMocks(); });
  it("announces a static polite warning without stealing focus and links to pricing", async () => {
    trigger.focus(); await render();
    expect(document.activeElement).toBe(trigger);
    const status = host.querySelector('[role="status"]'); expect(status?.textContent).toBe("Free hosting time is running low");
    expect(status?.getAttribute("aria-live")).toBe("polite");
    const link = host.querySelector("a")!; expect(link.textContent).toBe("View plans");
    expect(link.href).toBe(new URL("/pricing", WEB_HTTP_BASE).href); expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener"); expect(host.querySelector("[data-anidachi-hotkey-boundary]")).not.toBeNull();
  });
  it("shows the supplied live reading without making the static announcement repeat every second", async () => {
    await render();
    const announcement = host.querySelector('[role="status"]')!;
    const initialAnnouncement = announcement.textContent;
    const timer = host.querySelector('[role="timer"]')!;
    expect(timer.textContent).toBe("05:00");
    expect(timer.getAttribute("aria-live")).toBe("off");
    await render({ remainingSeconds: 299 });
    expect(timer.textContent).toBe("04:59");
    expect(timer.getAttribute("aria-label")).toContain("4 minutes 59 seconds");
    expect(announcement.textContent).toBe(initialAnnouncement);
  });
  it("does not turn zero or missing time into an authoritative room-closed notice", async () => {
    await render({ remainingSeconds: 0 });
    expect(host.querySelector('[role="timer"]')?.textContent).toBe("00:00");
    expect(host.textContent).not.toContain("Room closed");
    await render({ remainingSeconds: null });
    expect(host.querySelector('[role="timer"]')?.textContent).toBe("--:--");
    expect(host.querySelector('[role="timer"]')?.getAttribute("aria-label")).toBe("Remaining time unavailable");
    expect(host.textContent).not.toContain("Room closed");
  });
  it("replaces the live clock only for the closed event and preserves the focused pricing action", async () => {
    await render({ remainingSeconds: 1 });
    const link = host.querySelector("a")!;
    link.focus();
    await render({ kind: "closed", remainingSeconds: null });
    expect(host.querySelector('[role="timer"]')).toBeNull();
    expect(host.textContent).toContain("Room closed");
    expect(host.textContent).toContain("Daily limit reached");
    expect(host.querySelector('[role="status"]')?.textContent).toContain("Room closed");
    expect(host.querySelector("a")).toBe(link);
    expect(document.activeElement).toBe(link);
  });
  it("makes the collapsing notice inaccessible while its exit animation finishes", async () => {
    await render({ open: false });
    const aside = host.querySelector("aside")!;
    expect(aside.hasAttribute("inert")).toBe(true);
    expect(aside.getAttribute("aria-hidden")).toBe("true");
    expect(host.querySelector('[role="status"]')?.textContent).toBe("");
    await render();
    expect(aside.hasAttribute("inert")).toBe(false);
    expect(aside.getAttribute("aria-hidden")).toBeNull();
  });
  it("dismisses with focused Escape and restores capsule focus", async () => {
    await render(); const button = host.querySelector("button")!;
    expect(button.getAttribute("aria-label")).toBe("Dismiss hosting time warning");
    trigger.focus(); trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); expect(dismiss).not.toHaveBeenCalled();
    host.querySelector("aside")!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); expect(dismiss).not.toHaveBeenCalled();
    button.focus(); button.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(dismiss).toHaveBeenCalledOnce(); expect(document.activeElement).toBe(trigger);
  });
  it("isolates keyboard/pointer events from provider handlers and preserves default link navigation", async () => {
    const browser = (window as unknown as { happyDOM: { settings: { navigation: { disableChildPageNavigation: boolean } } } }).happyDOM;
    const previous = browser.settings.navigation.disableChildPageNavigation;
    browser.settings.navigation.disableChildPageNavigation = true;
    await render(); const provider = vi.fn(); document.body.addEventListener("keydown", provider); document.body.addEventListener("pointerdown", provider);
    const link = host.querySelector("a")!; link.focus();
    link.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true })); link.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    const click = new MouseEvent("click", { bubbles: true, cancelable: true }); link.dispatchEvent(click);
    expect(provider).not.toHaveBeenCalled(); expect(click.defaultPrevented).toBe(false); expect(dismiss).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(link);
    document.body.removeEventListener("keydown", provider); document.body.removeEventListener("pointerdown", provider);
    browser.settings.navigation.disableChildPageNavigation = previous;
  });
  it("does not steal focus when dismissal did not originate in a focused notice", async () => {
    await render(); trigger.focus(); const other = document.createElement("button"); document.body.append(other); other.focus();
    host.querySelector("button")!.click(); expect(dismiss).toHaveBeenCalledOnce(); expect(document.activeElement).toBe(other); other.remove();
  });
});
