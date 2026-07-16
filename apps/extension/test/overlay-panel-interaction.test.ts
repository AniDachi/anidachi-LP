import { describe, expect, it, vi } from "vitest";
import {
  shouldDismissOverlayPanel,
  waitForOverlayPaint,
} from "../src/overlay-panel-interaction";

describe("overlay panel interaction", () => {
  const panel = new EventTarget();
  const topBubble = new EventTarget();
  const overlayRoot = new EventTarget();
  const page = new EventTarget();

  it("keeps the panel open for events retargeted to the overlay shadow host", () => {
    expect(
      shouldDismissOverlayPanel({
        busy: false,
        eventPath: [overlayRoot, page],
        overlayRoot,
        panel,
        topBubble,
      }),
    ).toBe(false);
  });

  it("keeps the panel open while a room transition is pending", () => {
    expect(
      shouldDismissOverlayPanel({
        busy: true,
        eventPath: [page],
        overlayRoot,
        panel,
        topBubble,
      }),
    ).toBe(false);
  });

  it("dismisses the idle panel for a real page interaction", () => {
    expect(
      shouldDismissOverlayPanel({
        busy: false,
        eventPath: [page],
        overlayRoot,
        panel,
        topBubble,
      }),
    ).toBe(true);
  });

  it("waits for the scheduled browser turn before continuing", async () => {
    const scheduledCallbacks: Array<() => void> = [];
    const schedule = vi.fn((callback: () => void) => {
      scheduledCallbacks.push(callback);
      return 1;
    });
    let completed = false;

    const pending = waitForOverlayPaint(schedule).then(() => {
      completed = true;
    });

    await Promise.resolve();
    expect(schedule).toHaveBeenCalledTimes(1);
    expect(completed).toBe(false);

    scheduledCallbacks[0]?.();
    await pending;
    expect(completed).toBe(true);
  });
});
