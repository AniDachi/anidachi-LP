import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MainControlVisibility } from "../src/interface-preferences";
import {
  TOP_BUBBLE_HIDE_DELAY_MS,
  TOP_BUBBLE_REVEAL_DELAY_MS,
  useTopBubbleReveal,
} from "../src/top-bubble-reveal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("top bubble edge reveal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it("shows an early proximity glow without revealing the bubble", async () => {
    const view = await renderHarness(false);

    await movePointer(850, 40);
    expect(readPhase(view.container)).toBe("glow");

    await advance(TOP_BUBBLE_REVEAL_DELAY_MS);
    expect(readPhase(view.container)).toBe("glow");
    await unmount(view.root);
  });

  it("requires deliberate top-right dwell before revealing", async () => {
    const view = await renderHarness(false);

    await movePointer(995, 5);
    expect(readPhase(view.container)).toBe("glow");

    await advance(TOP_BUBBLE_REVEAL_DELAY_MS - 1);
    expect(readPhase(view.container)).toBe("glow");

    await advance(1);
    expect(readPhase(view.container)).toBe("visible");

    await unmount(view.root);
  });

  it("cancels reveal when the cursor only crosses the corner", async () => {
    const view = await renderHarness(false);

    await movePointer(995, 5);
    expect(readPhase(view.container)).toBe("glow");
    await movePointer(400, 300);
    await advance(TOP_BUBBLE_REVEAL_DELAY_MS);

    expect(readPhase(view.container)).toBe("hidden");
    await unmount(view.root);
  });

  it("cancels reveal when the pointer leaves the browser through the top edge", async () => {
    const view = await renderHarness(false);

    await movePointer(995, 5);
    expect(readPhase(view.container)).toBe("glow");

    await leaveWindow();
    await advance(TOP_BUBBLE_REVEAL_DELAY_MS);
    expect(readPhase(view.container)).toBe("hidden");
    await unmount(view.root);
  });

  it("keeps revealing when YouTube emits a null-related pointerout inside the viewport", async () => {
    const view = await renderHarness(false);

    await movePointer(995, 5);
    expect(readPhase(view.container)).toBe("glow");

    await pointerOutInsideViewport(995, 5);
    await advance(TOP_BUBBLE_REVEAL_DELAY_MS);

    expect(readPhase(view.container)).toBe("visible");
    await unmount(view.root);
  });

  it("keeps the revealed bubble while the pointer moves from the edge onto it", async () => {
    const view = await renderHarness(false);

    await movePointer(995, 5);
    await advance(TOP_BUBBLE_REVEAL_DELAY_MS);
    await movePointer(940, 20);
    await advance(TOP_BUBBLE_HIDE_DELAY_MS);
    expect(readPhase(view.container)).toBe("visible");

    await movePointer(400, 300);
    await advance(TOP_BUBBLE_HIDE_DELAY_MS);
    expect(readPhase(view.container)).toBe("hidden");
    await unmount(view.root);
  });

  it("keeps a revealed launcher shifted more than 160 pixels from the physical edge", async () => {
    const view = await renderHarness(false, rect(700, 10, 80, 32));

    await movePointer(995, 5);
    await advance(TOP_BUBBLE_REVEAL_DELAY_MS);
    await movePointer(740, 20);
    await advance(TOP_BUBBLE_HIDE_DELAY_MS);

    expect(readPhase(view.container)).toBe("visible");
    await unmount(view.root);
  });

  it("cancels a pending hide when the pointer returns to the bubble", async () => {
    const view = await renderHarness(false);

    await movePointer(995, 5);
    await advance(TOP_BUBBLE_REVEAL_DELAY_MS);
    await movePointer(400, 300);
    await advance(TOP_BUBBLE_HIDE_DELAY_MS - 1);
    await movePointer(940, 20);
    await advance(1);

    expect(readPhase(view.container)).toBe("visible");
    await unmount(view.root);
  });

  it("hides a revealed bubble after the pointer leaves the browser", async () => {
    const view = await renderHarness(false);

    await movePointer(995, 5);
    await advance(TOP_BUBBLE_REVEAL_DELAY_MS);
    await leaveWindow();
    await advance(TOP_BUBBLE_HIDE_DELAY_MS);

    expect(readPhase(view.container)).toBe("hidden");
    await unmount(view.root);
  });

  it("cancels an edge reveal when the browser window loses focus", async () => {
    const view = await renderHarness(false);

    await movePointer(995, 5);
    expect(readPhase(view.container)).toBe("glow");
    await act(async () => {
      window.dispatchEvent(new Event("blur"));
    });
    await advance(TOP_BUBBLE_REVEAL_DELAY_MS);

    expect(readPhase(view.container)).toBe("hidden");
    await unmount(view.root);
  });

  it("ignores touch movement at the reveal edge", async () => {
    const view = await renderHarness(false);

    await movePointer(995, 5, "touch");
    await advance(TOP_BUBBLE_REVEAL_DELAY_MS);

    expect(readPhase(view.container)).toBe("hidden");
    await unmount(view.root);
  });

  it("keeps the bubble while the panel is open and delays hiding after close", async () => {
    const view = await renderHarness(true);
    expect(readPhase(view.container)).toBe("visible");

    await view.rerender(false);
    await advance(TOP_BUBBLE_HIDE_DELAY_MS - 1);
    expect(readPhase(view.container)).toBe("visible");

    await advance(1);
    expect(readPhase(view.container)).toBe("hidden");
    await unmount(view.root);
  });

  it("reveals for keyboard focus and hides after focus leaves", async () => {
    const view = await renderHarness(false);
    const button = view.container.querySelector("button") as HTMLButtonElement;

    await act(async () => button.focus());
    expect(readPhase(view.container)).toBe("visible");

    await act(async () => button.blur());
    await advance(TOP_BUBBLE_HIDE_DELAY_MS);
    expect(readPhase(view.container)).toBe("hidden");
    await unmount(view.root);
  });

  it("starts and remains visible without edge intent in Always visible mode", async () => {
    const view = await renderHarness(
      false,
      rect(900, 10, 80, 32),
      "always-visible",
    );
    expect(readPhase(view.container)).toBe("visible");

    await movePointer(850, 40);
    expect(readPhase(view.container)).toBe("visible");
    await movePointer(400, 300);
    await advance(TOP_BUBBLE_HIDE_DELAY_MS);
    expect(readPhase(view.container)).toBe("visible");

    await unmount(view.root);
  });

  it("uses the existing delayed hide when switching back to Auto hide", async () => {
    const view = await renderHarness(
      false,
      rect(900, 10, 80, 32),
      "always-visible",
    );
    expect(readPhase(view.container)).toBe("visible");

    await view.rerender(false, "auto-hide");
    await advance(TOP_BUBBLE_HIDE_DELAY_MS - 1);
    expect(readPhase(view.container)).toBe("visible");
    await advance(1);
    expect(readPhase(view.container)).toBe("hidden");

    await unmount(view.root);
  });
});

function Harness({
  bubbleRect,
  mode,
  panelOpen,
}: {
  bubbleRect: DOMRect;
  mode: MainControlVisibility;
  panelOpen: boolean;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLButtonElement>(null);
  const reveal = useTopBubbleReveal({
    bubbleRef,
    mode,
    overlayRef,
    panelOpen,
  });

  return (
    <div
      data-phase={reveal.edgeGlowVisible ? "glow" : reveal.bubbleVisible ? "visible" : "hidden"}
      ref={(element) => {
        overlayRef.current = element;
        if (element) {
          element.getBoundingClientRect = () => rect(0, 0, 1000, 600);
        }
      }}
    >
      <button
        onBlur={reveal.handleBubbleBlur}
        onFocus={reveal.handleBubbleFocus}
        ref={(element) => {
          bubbleRef.current = element;
          if (element) {
            element.getBoundingClientRect = () => bubbleRect;
          }
        }}
        type="button"
      >
        Open
      </button>
    </div>
  );
}

async function renderHarness(
  panelOpen: boolean,
  bubbleRect = rect(900, 10, 80, 32),
  mode: MainControlVisibility = "auto-hide",
): Promise<{
  container: HTMLDivElement;
  rerender(
    panelOpen: boolean,
    mode?: MainControlVisibility,
  ): Promise<void>;
  root: Root;
}> {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <Harness
        bubbleRect={bubbleRect}
        mode={mode}
        panelOpen={panelOpen}
      />,
    ),
  );
  return {
    container,
    root,
    async rerender(nextPanelOpen, nextMode = mode) {
      await act(async () =>
        root.render(
          <Harness
            bubbleRect={bubbleRect}
            mode={nextMode}
            panelOpen={nextPanelOpen}
          />,
        ),
      );
    },
  };
}

async function movePointer(clientX: number, clientY: number, pointerType?: string): Promise<void> {
  await act(async () => {
    window.dispatchEvent(new PointerEvent("pointermove", { clientX, clientY, pointerType }));
  });
}

async function leaveWindow(): Promise<void> {
  await act(async () => {
    window.dispatchEvent(new PointerEvent("pointerout", { relatedTarget: null }));
  });
}

async function pointerOutInsideViewport(clientX: number, clientY: number): Promise<void> {
  await act(async () => {
    window.dispatchEvent(
      new PointerEvent("pointerout", {
        clientX,
        clientY,
        relatedTarget: null,
      }),
    );
  });
}

async function advance(milliseconds: number): Promise<void> {
  await act(async () => vi.advanceTimersByTime(milliseconds));
}

async function unmount(root: Root): Promise<void> {
  await act(async () => root.unmount());
}

function readPhase(container: HTMLElement): string | undefined {
  return container.firstElementChild?.getAttribute("data-phase") ?? undefined;
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    bottom: top + height,
    height,
    left,
    right: left + width,
    top,
    width,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}
