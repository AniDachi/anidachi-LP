import type { HTMLAttributes, SyntheticEvent } from "react";

export const OVERLAY_HOTKEY_BOUNDARY_ATTRIBUTE = "data-anidachi-hotkey-boundary";

export const overlayHotkeyBoundaryProps = {
  [OVERLAY_HOTKEY_BOUNDARY_ATTRIBUTE]: "true",
} as const;

type OverlayInteractionBoundaryProps = Pick<
  HTMLAttributes<HTMLElement>,
  | "onClick"
  | "onContextMenu"
  | "onDoubleClick"
  | "onKeyDown"
  | "onKeyUp"
  | "onMouseDown"
  | "onMouseMove"
  | "onMouseOut"
  | "onMouseOver"
  | "onMouseUp"
  | "onPointerCancel"
  | "onPointerDown"
  | "onPointerMove"
  | "onPointerOut"
  | "onPointerOver"
  | "onPointerUp"
  | "onTouchCancel"
  | "onTouchEnd"
  | "onTouchMove"
  | "onTouchStart"
  | "onWheel"
>;

function stopOverlayInteraction(event: SyntheticEvent<HTMLElement>): void {
  event.stopPropagation();
  event.nativeEvent.stopImmediatePropagation();
}

export const overlayInteractionBoundaryProps = {
  onClick: stopOverlayInteraction,
  onContextMenu: stopOverlayInteraction,
  onDoubleClick: stopOverlayInteraction,
  onKeyDown: stopOverlayInteraction,
  onKeyUp: stopOverlayInteraction,
  onMouseDown: stopOverlayInteraction,
  onMouseMove: stopOverlayInteraction,
  onMouseOut: stopOverlayInteraction,
  onMouseOver: stopOverlayInteraction,
  onMouseUp: stopOverlayInteraction,
  onPointerCancel: stopOverlayInteraction,
  onPointerDown: stopOverlayInteraction,
  onPointerMove: stopOverlayInteraction,
  onPointerOut: stopOverlayInteraction,
  onPointerOver: stopOverlayInteraction,
  onPointerUp: stopOverlayInteraction,
  onTouchCancel: stopOverlayInteraction,
  onTouchEnd: stopOverlayInteraction,
  onTouchMove: stopOverlayInteraction,
  onTouchStart: stopOverlayInteraction,
  onWheel: stopOverlayInteraction,
} satisfies OverlayInteractionBoundaryProps;

export function isWithinOverlayHotkeyBoundary(event: {
  composedPath?: () => EventTarget[];
}): boolean {
  return (event.composedPath?.() ?? []).some(
    (target) =>
      target instanceof HTMLElement && target.hasAttribute(OVERLAY_HOTKEY_BOUNDARY_ATTRIBUTE),
  );
}
