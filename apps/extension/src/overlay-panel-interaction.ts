export interface OverlayPanelDismissContext {
  busy: boolean;
  eventPath: readonly EventTarget[];
  overlayRoot: EventTarget | null;
  panel: EventTarget | null;
  topBubble: EventTarget | null;
}

export function shouldDismissOverlayPanel({
  busy,
  eventPath,
  overlayRoot,
  panel,
  topBubble,
}: OverlayPanelDismissContext): boolean {
  if (busy) {
    return false;
  }

  return !(
    (overlayRoot && eventPath.includes(overlayRoot)) ||
    (panel && eventPath.includes(panel)) ||
    (topBubble && eventPath.includes(topBubble))
  );
}

export function waitForOverlayPaint(
  schedule: (callback: () => void) => number = (callback) => window.setTimeout(callback, 0),
): Promise<void> {
  return new Promise((resolve) => {
    schedule(resolve);
  });
}
