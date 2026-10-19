/**
 * Public path to the current AniDachi mark: a 29 KB WebP with alpha, same artwork as
 * `public/Anidachi_logo.png` (157 KB), which JSON-LD keeps using.
 */
export const ANIDACHI_LOGO_SRC = "/Anidachi_logo.webp?v=3" as const;

/** Default Open Graph / Twitter card image (1200×630). Query busts Telegram/iMessage caches. */
export const ANIDACHI_OG_IMAGE_PATH = "/opengraph-image.png?v=20260814" as const;
export const ANIDACHI_OG_IMAGE_ALT =
  "AniDachi – watch anime together, in perfect sync" as const;
