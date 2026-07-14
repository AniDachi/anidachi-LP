import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { OverlayLayoutGhostPreview } from "../src/overlay-layout-ghost-preview";
import { resolveOverlayLayout } from "../src/overlay-layout-engine";
import { getDefaultOverlayLayoutDefinition } from "../src/overlay-layout-model";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("OverlayLayoutGhostPreview", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("projects four camera placeholders and chat geometry into the live player", async () => {
    const layout = resolveOverlayLayout(getDefaultOverlayLayoutDefinition(), {
      cameraCount: 4,
      reservedRects: [],
      viewport: {
        height: 720,
        safeInsets: { bottom: 56, left: 12, right: 12, top: 12 },
        width: 1280,
      },
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<OverlayLayoutGhostPreview layout={layout} />);
    });

    expect(container.querySelectorAll("[data-live-layout-camera-ghost]")).toHaveLength(4);
    const chat = container.querySelector<HTMLElement>("[data-live-layout-chat-ghost]");
    expect(chat).not.toBeNull();
    expect(Number.parseFloat(chat?.style.left ?? "NaN")).toBeCloseTo(layout.chat.rect.x);
    expect(Number.parseFloat(chat?.style.top ?? "NaN")).toBeCloseTo(layout.chat.rect.y);
    expect(Number.parseFloat(chat?.style.width ?? "NaN")).toBeCloseTo(
      layout.chat.rect.width,
    );
    expect(Number.parseFloat(chat?.style.height ?? "NaN")).toBeCloseTo(
      layout.chat.rect.height,
    );

    await act(async () => {
      root.unmount();
    });
  });
});
