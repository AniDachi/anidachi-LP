/**
 * Approximate rendered width, for "will Google cut this off?" checks (ANI-81).
 * Google truncates titles by pixels (about 600px at 20px Arial). Meta descriptions are
 * checked by characters instead (about 155–160 shown); pixel limits quoted for them vary.
 * Widths below are Arial's advance widths per 1,000 units, accurate to a few pixels.
 */

const ARIAL: Record<string, number> = {
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833,
  n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556, M: 833,
  N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  " ": 278, ".": 278, ",": 278, ":": 278, ";": 278, "'": 191, "’": 222, '"': 355, "-": 333, "–": 556, "—": 1000,
  "(": 333, ")": 333, "!": 278, "?": 556, "&": 667, "+": 584, "/": 278, "|": 260, "%": 889, "@": 1015,
};

export function emWidth(text: string): number {
  let units = 0;
  // Digits and anything unlisted use Arial's standard 556-unit width.
  for (const ch of text) units += ARIAL[ch] ?? 556;
  return units / 1000;
}

export const TITLE_MAX_PX = 600;
export const META_MAX_CHARS = 160;
export const META_SOFT_CHARS = 155;

export function titlePx(text: string): number {
  return Math.round(emWidth(text) * 20);
}

/**
 * Estimated lines for a heading on a 375px phone (343px of text width). Calibrated on 25 Nov
 * 2026 against five live headings measured at 375px (factor 1.0 fits all of them).
 */
export function phoneLines(text: string, fontPx: number, widthPx = 343): number {
  return Math.max(1, Math.ceil((emWidth(text) * fontPx) / widthPx));
}
