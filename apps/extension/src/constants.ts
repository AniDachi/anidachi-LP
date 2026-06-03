export const API_HTTP_BASE = import.meta.env.WXT_API_HTTP_BASE ?? "http://127.0.0.1:8787";
export const API_WS_BASE = import.meta.env.WXT_API_WS_BASE ?? "ws://127.0.0.1:8787";
export const WEB_HTTP_BASE = import.meta.env.WXT_WEB_HTTP_BASE ?? "http://localhost:3003";
export const ANIDACHI_BUILD_ID = import.meta.env.WXT_BUILD_ID ?? "local-dev";

export const VOICE_KEYWORD_EMOJI: Record<string, string> = {
  смешно: "😂",
  жесть: "😱",
  люблю: "❤️",
  огонь: "🔥",
  плачу: "😭",
  смотри: "👀",
};

export const EMOJI_PALETTE = ["😂", "😱", "❤️", "🔥", "😭", "👀"];

export const COMPOSER_EMOJI_PACK = [
  "😂",
  "😭",
  "😱",
  "🤯",
  "😳",
  "👀",
  "💀",
  "😮‍💨",
  "❤️",
  "🫶",
  "🔥",
  "✨",
  "👏",
  "🙏",
  "🤝",
  "🍿",
  "😤",
  "😎",
  "😈",
  "🥹",
  "😍",
  "😬",
  "🤌",
  "💯",
];
