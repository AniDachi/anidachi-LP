import { describe, expect, it, vi } from "vitest";
import {
  isWithinOverlayHotkeyBoundary,
  OVERLAY_HOTKEY_BOUNDARY_ATTRIBUTE,
  overlayHotkeyBoundaryProps,
  overlayInteractionBoundaryProps,
} from "../src/overlay-interaction-boundary";

const ISOLATED_EVENT_HANDLERS = [
  "onClick",
  "onContextMenu",
  "onDoubleClick",
  "onKeyDown",
  "onKeyUp",
  "onMouseDown",
  "onMouseMove",
  "onMouseOut",
  "onMouseOver",
  "onMouseUp",
  "onPointerCancel",
  "onPointerDown",
  "onPointerMove",
  "onPointerOut",
  "onPointerOver",
  "onPointerUp",
  "onTouchCancel",
  "onTouchEnd",
  "onTouchMove",
  "onTouchStart",
  "onWheel",
] as const;

describe("overlay interaction boundary", () => {
  it.each(
    ISOLATED_EVENT_HANDLERS,
  )("isolates %s after extension controls handle it", (handlerName) => {
    const stopPropagation = vi.fn();
    const stopImmediatePropagation = vi.fn();
    const preventDefault = vi.fn();
    const handler = overlayInteractionBoundaryProps[handlerName];

    expect(handler).toBeTypeOf("function");

    handler?.({
      nativeEvent: { stopImmediatePropagation },
      preventDefault,
      stopPropagation,
    } as never);

    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(stopImmediatePropagation).toHaveBeenCalledOnce();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("marks and detects dedicated capture-phase hotkey boundaries", () => {
    const control = document.createElement("div");
    control.setAttribute(
      OVERLAY_HOTKEY_BOUNDARY_ATTRIBUTE,
      overlayHotkeyBoundaryProps[OVERLAY_HOTKEY_BOUNDARY_ATTRIBUTE],
    );
    const child = document.createElement("button");
    control.append(child);

    expect(
      isWithinOverlayHotkeyBoundary({
        composedPath: () => [child, control, document.body, document],
      }),
    ).toBe(true);
    expect(
      isWithinOverlayHotkeyBoundary({
        composedPath: () => [document.body, document],
      }),
    ).toBe(false);
  });
});
