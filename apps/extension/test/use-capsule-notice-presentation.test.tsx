import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCapsuleNoticePresentation } from "../src/use-capsule-notice-presentation";

let root: Root, host: HTMLElement, key: string | null, visible: boolean;
let onDismiss: ReturnType<typeof vi.fn<() => void>>, dismiss: () => void;
function Harness() {
  const notice = useCapsuleNoticePresentation({ noticeKey: key, bubbleVisible: visible, onDismiss });
  dismiss = notice.dismiss;
  return <output data-pinned={notice.present} data-open={notice.open} />;
}
const render = () => act(async () => root.render(<Harness />));
const tick = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const pinned = () => host.querySelector("output")?.getAttribute("data-pinned");
const open = () => host.querySelector("output")?.getAttribute("data-open");
describe("capsule notification choreography", () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers(); key = "login/room/warning"; visible = false; onDismiss = vi.fn();
    vi.spyOn(window, "matchMedia").mockReturnValue({ matches: false } as MediaQueryList);
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  });
  afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.useRealTimers(); });
  it("reveals a hidden capsule before its strip, even if visibility updates during entry", async () => {
    await render(); expect(pinned()).toBe("true"); expect(open()).toBe("false");
    await tick(260); visible = true; await render(); expect(open()).toBe("false");
    await tick(100); expect(open()).toBe("true");
  });
  it("reveals the strip directly when the capsule was already visible", async () => {
    visible = true; await render(); await tick(32); expect(open()).toBe("true");
  });
  it("keeps the capsule pinned until explicit dismissal finishes", async () => {
    await render(); await tick(360); await act(async () => dismiss());
    expect(open()).toBe("false"); expect(pinned()).toBe("true"); expect(onDismiss).not.toHaveBeenCalled();
    await tick(329); expect(onDismiss).not.toHaveBeenCalled();
    await tick(1); expect(onDismiss).toHaveBeenCalledOnce();
    key = null; await render(); expect(pinned()).toBe("false");
  });
  it("removes invalidated authority immediately and cancels pending entry", async () => {
    await render(); await tick(100); key = null; await render();
    expect(pinned()).toBe("false"); await tick(500); expect(open()).toBe("false");
  });
  it("replaces a warning with terminal copy without replaying entry or inheriting its dismissal", async () => {
    await render(); await tick(360); await act(async () => dismiss()); await tick(100);
    key = "login/room/closed"; await render(); expect(open()).toBe("true");
    await tick(500); expect(onDismiss).not.toHaveBeenCalled();
  });
  it("does not delay presentation or dismissal with reduced motion", async () => {
    vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList);
    await render(); expect(open()).toBe("true"); await act(async () => dismiss());
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
