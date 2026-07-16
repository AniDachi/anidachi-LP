import type { CSSProperties } from "react";
import type { PixelRect, ResolvedOverlayLayout } from "./overlay-layout-engine";
import { OverlayLayoutChatPreview } from "./overlay-layout-chat-preview";

export interface OverlayLayoutGhostPreviewProps {
  layout: ResolvedOverlayLayout;
  occupiedCameraSlots?: number;
  showChatPlaceholder?: boolean;
}

export function OverlayLayoutGhostPreview({
  layout,
  occupiedCameraSlots = 0,
  showChatPlaceholder = true,
}: OverlayLayoutGhostPreviewProps) {
  const occupiedSlotCount = Math.max(
    0,
    Math.min(layout.video.slots.length, Math.round(occupiedCameraSlots)),
  );

  return (
    <div aria-hidden="true" className="overlay-layout-ghost-preview">
      {layout.video.slots.map((slot, index) =>
        index < occupiedSlotCount ? null : (
          <div
            className={`overlay-layout-camera-ghost${index === 0 ? " is-leader" : ""}`}
            data-layout-slot-index={index}
            data-live-layout-camera-ghost=""
            key={`layout-camera-ghost-${index}`}
            style={getPixelRectStyle(slot)}
          />
        ),
      )}
      {showChatPlaceholder ? (
        <div
          className="overlay-layout-chat-ghost layout-chat-preview-shell"
          data-live-layout-chat-ghost=""
          style={{
            ...getPixelRectStyle(layout.chat.rect),
            "--live-chat-message-opacity": `${1 - layout.chat.messageTransparency / 100}`,
            fontSize: `${layout.chat.fontSizePx}px`,
            lineHeight: `${layout.chat.lineHeightPx}px`,
          } as CSSProperties}
        >
          <OverlayLayoutChatPreview messageCount={layout.chat.effectiveMaxMessages} />
        </div>
      ) : null}
    </div>
  );
}

function getPixelRectStyle(rect: PixelRect): CSSProperties {
  return {
    height: `${rect.height}px`,
    left: `${rect.x}px`,
    position: "absolute",
    top: `${rect.y}px`,
    width: `${rect.width}px`,
  };
}
