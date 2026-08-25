export const API_HTTP_BASE = import.meta.env.WXT_API_HTTP_BASE ?? "http://127.0.0.1:8787";
export const API_WS_BASE = import.meta.env.WXT_API_WS_BASE ?? "ws://127.0.0.1:8787";
export const WEB_HTTP_BASE = import.meta.env.WXT_WEB_HTTP_BASE ?? "http://localhost:3003";
export const ANIDACHI_BUILD_ID = import.meta.env.WXT_BUILD_ID ?? "local-dev";
const STAGING_VAPID_PUBLIC_KEY =
  "BMmz4hkjcP6LhcnVsnYhWVsod_g59o0qr06JXtMfb5nUXpJTp-Khted46CXdnmVDBTOS8sOcKC-wXHSzk4nStRw";
export const WXT_VAPID_PUBLIC_KEY =
  import.meta.env.WXT_VAPID_PUBLIC_KEY?.trim() ??
  (import.meta.env.WXT_EXTENSION_CHANNEL === "staging" ? STAGING_VAPID_PUBLIC_KEY : "");

export const VOICE_KEYWORD_EMOJI: Record<string, string> = {
  смешно: "😂",
  жесть: "😱",
  люблю: "❤️",
  огонь: "🔥",
  плачу: "😭",
  смотри: "👀",
};

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
