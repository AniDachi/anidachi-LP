import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Free20WarningNotice } from "../src/free20-warning-notice";
import { WEB_HTTP_BASE } from "../src/constants";

let host: HTMLElement, root: Root, trigger: HTMLButtonElement, dismiss: ReturnType<typeof vi.fn<() => void>>;
const render = () => act(async () => root.render(<Free20WarningNotice onDismiss={dismiss} restoreFocus={() => trigger.focus()} />));
describe("capsule Free20 notice", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement("div"); trigger = document.createElement("button"); document.body.append(trigger, host); root = createRoot(host); dismiss = vi.fn();
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); trigger.remove(); vi.restoreAllMocks(); });
  it("announces a static polite warning without stealing focus and links to existing billing", async () => {
    trigger.focus(); await render();
    expect(document.activeElement).toBe(trigger);
    const status = host.querySelector('[role="status"]'); expect(status?.textContent).toBe("Free hosting time is running low");
    expect(status?.getAttribute("aria-live")).toBe("polite");
    const link = host.querySelector("a")!; expect(link.textContent).toBe("View plans");
    expect(link.href).toBe(new URL("/account/billing", WEB_HTTP_BASE).href); expect(link.target).toBe("_blank");
    expect(link.rel).toContain("noopener"); expect(host.querySelector("[data-anidachi-hotkey-boundary]")).not.toBeNull();
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
