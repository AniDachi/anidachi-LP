import type { CSSProperties } from "react";
import type { PixelRect, ResolvedOverlayLayout } from "./overlay-layout-engine";

const CHAT_LINE_WIDTHS = [72, 48, 84, 61, 76, 43, 68, 55];

export interface OverlayLayoutGhostPreviewProps {
  layout: ResolvedOverlayLayout;
}

export function OverlayLayoutGhostPreview({ layout }: OverlayLayoutGhostPreviewProps) {
  return (
    <div aria-hidden="true" className="overlay-layout-ghost-preview">
      {layout.video.slots.map((slot, index) => (
        <div
          className={`overlay-layout-camera-ghost${index === 0 ? " is-leader" : ""}`}
          data-live-layout-camera-ghost=""
          key={`layout-camera-ghost-${index}`}
          style={getPixelRectStyle(slot)}
        />
      ))}
      <div
        className="overlay-layout-chat-ghost"
        data-live-layout-chat-ghost=""
        style={getPixelRectStyle(layout.chat.rect)}
      >
        {Array.from({ length: layout.chat.effectiveMaxMessages }, (_, index) => (
          <span
            key={`layout-chat-line-${index}`}
            style={{ width: `${CHAT_LINE_WIDTHS[index % CHAT_LINE_WIDTHS.length]}%` }}
          />
        ))}
      </div>
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
