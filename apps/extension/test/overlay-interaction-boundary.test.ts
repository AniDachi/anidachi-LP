import { describe, expect, it, vi } from "vitest";
import { overlayInteractionBoundaryProps } from "../src/overlay-interaction-boundary";

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
  it.each(ISOLATED_EVENT_HANDLERS)(
    "isolates %s after extension controls handle it",
    (handlerName) => {
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
    },
  );
});
