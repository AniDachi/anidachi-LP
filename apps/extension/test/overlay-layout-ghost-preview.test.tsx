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

  it("projects four camera placeholders and representative chat into an empty live player", async () => {
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
    expect(chat?.classList.contains("layout-chat-preview-shell")).toBe(true);
	expect(chat?.style.getPropertyValue("--live-chat-message-opacity")).toBe("1");
    expect(Number.parseFloat(chat?.style.left ?? "NaN")).toBeCloseTo(layout.chat.rect.x);
    expect(Number.parseFloat(chat?.style.top ?? "NaN")).toBeCloseTo(layout.chat.rect.y);
    expect(Number.parseFloat(chat?.style.width ?? "NaN")).toBeCloseTo(
      layout.chat.rect.width,
    );
    expect(Number.parseFloat(chat?.style.height ?? "NaN")).toBeCloseTo(
      layout.chat.rect.height,
    );
    expect(chat?.textContent).toContain("That scene was perfect");
    expect(chat?.querySelector(".live-chat-message")).not.toBeNull();
    expect(chat?.querySelector(".live-chat-name")).not.toBeNull();
    expect(chat?.querySelector(".live-chat-text")).not.toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it("fills only unoccupied camera slots and leaves a real chat unobscured", async () => {
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
      root.render(
        <OverlayLayoutGhostPreview
          layout={layout}
          occupiedCameraSlots={2}
          showChatPlaceholder={false}
        />,
      );
    });

    const cameraGhosts = container.querySelectorAll<HTMLElement>(
      "[data-live-layout-camera-ghost]",
    );
    expect(cameraGhosts).toHaveLength(2);
    expect(cameraGhosts[0]?.dataset.layoutSlotIndex).toBe("2");
    expect(cameraGhosts[1]?.dataset.layoutSlotIndex).toBe("3");
    expect(container.querySelector(".overlay-layout-camera-ghost.is-leader")).toBeNull();
    expect(container.querySelector("[data-live-layout-chat-ghost]")).toBeNull();

    await act(async () => {
      root.unmount();
    });
  });

  it("renders every resolved placeholder row above the former eight-message limit", async () => {
    const definition = getDefaultOverlayLayoutDefinition();
    definition.chat.maxMessages = 12;
    definition.chat.position = { x: 0, y: 0 };
    const layout = resolveOverlayLayout(definition, {
      cameraCount: 0,
      reservedRects: [],
      viewport: {
        height: 720,
        safeInsets: { bottom: 12, left: 12, right: 12, top: 12 },
        width: 1280,
      },
    });
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<OverlayLayoutGhostPreview layout={layout} />);
    });

    expect(layout.chat.effectiveMaxMessages).toBe(12);
    expect(
      container.querySelectorAll("[data-overlay-layout-chat-preview-message]"),
    ).toHaveLength(12);

    await act(async () => {
      root.unmount();
    });
  });
});
