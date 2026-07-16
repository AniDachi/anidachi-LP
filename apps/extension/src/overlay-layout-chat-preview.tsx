import type { CSSProperties } from "react";

const CHAT_PREVIEW_MESSAGES = [
  { color: "#c4a7ff", name: "Mika", text: "That scene was perfect." },
  { color: "#8bd5ca", name: "Ren", text: "Wait for the next part..." },
  { color: "#f5bde6", name: "You", text: "No way." },
  { color: "#91d7e3", name: "Ari", text: "The timing was perfect." },
  { color: "#f0c6c6", name: "Niko", text: "I knew it." },
  { color: "#c4a7ff", name: "Mika", text: "One more episode?" },
  { color: "#8bd5ca", name: "Ren", text: "Watch this scene." },
  { color: "#f5bde6", name: "You", text: "That was close." },
] as const;

export function OverlayLayoutChatPreview({ messageCount }: { messageCount: number }) {
  const count = Math.max(0, Math.round(messageCount));

  return Array.from({ length: count }, (_, index) => {
    const message = CHAT_PREVIEW_MESSAGES[index % CHAT_PREVIEW_MESSAGES.length]!;
    return (
      <div
        className="live-chat-message overlay-layout-chat-preview-message"
        data-overlay-layout-chat-preview-message=""
        key={`overlay-layout-chat-preview-${index}`}
        style={{ "--chat-name-color": message.color } as CSSProperties}
      >
        <span className="live-chat-name">{message.name}</span>
        <span className="live-chat-text">{message.text}</span>
      </div>
    );
  });
}
