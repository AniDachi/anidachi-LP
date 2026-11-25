/**
 * Text helpers for the on-page SEO check (ANI-81). Matching follows the On-page SEO rules:
 * Google treats reordered words, small connecting words and simple plurals as the same
 * search, so a "near" match is enough almost everywhere; "exact" is reported separately.
 */

/** Small words that don't change what a search means ("how do you" vs "how to"). */
const STOPWORDS = new Set([
  "a", "an", "the", "to", "do", "does", "you", "your", "i", "can", "is", "are", "of", "for",
  "on", "in", "and", "with", "or", "it", "how",
]);

/** Lowercase, spell out "&" and "+" (Disney+), drop apostrophes, keep letters and digits. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\+/g, " plus ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Words ending in "ie"/"ies" whose singular keeps the "ie" ("movies" → "movie", not "movy"). */
const IE_PLURALS = new Set(["movies", "cookies", "zombies", "selfies", "rookies", "hoodies", "smoothies", "goalies"]);

/** Light stemming so "apps"/"app" and "parties"/"party" match; nothing smarter on purpose. */
export function stem(token: string): string {
  if (token === "series" || token === "species") return token;
  if (IE_PLURALS.has(token)) return token.slice(0, -1);
  if (token.length > 4 && token.endsWith("ies")) return `${token.slice(0, -3)}y`;
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) return token.slice(0, -1);
  return token;
}

export function tokens(text: string): string[] {
  const normalized = normalize(text);
  return normalized ? normalized.split(" ").map(stem) : [];
}

function contentTokens(phrase: string): string[] {
  const all = tokens(phrase);
  const content = all.filter((t) => !STOPWORDS.has(t));
  return content.length > 0 ? content : all;
}

export type MatchKind = "exact" | "near" | null;

/**
 * "exact": the phrase's words appear in order, side by side (small words included).
 * "near": every meaningful word appears within a short window, in any order.
 * Body text uses a loose window (2 × content words + 2); titles, H1s and meta descriptions
 * use a tight one (content words + 3), so "Netflix has no built-in watch party" doesn't
 * count as "Netflix watch party" there.
 */
export function matchPhrase(text: string, phrase: string, tight = false): MatchKind {
  const hay = tokens(text);
  const needle = tokens(phrase);
  if (needle.length === 0 || hay.length === 0) return null;
  for (let i = 0; i + needle.length <= hay.length; i += 1) {
    if (needle.every((t, j) => hay[i + j] === t)) return "exact";
  }
  const want = contentTokens(phrase);
  const window = tight ? want.length + 3 : want.length * 2 + 2;
  for (let start = 0; start < hay.length; start += 1) {
    const slice = new Set(hay.slice(start, start + window));
    if (want.every((t) => slice.has(t))) return "near";
  }
  return null;
}

/** Best match of any phrase in a search group (variants Google treats as one search). */
export function matchGroup(text: string, phrases: readonly string[], tight = false): MatchKind {
  let best: MatchKind = null;
  for (const phrase of phrases) {
    const kind = matchPhrase(text, phrase, tight);
    if (kind === "exact") return "exact";
    if (kind === "near") best = "near";
  }
  return best;
}

/**
 * Does a search query belong to a search group? Stricter than page matching: words may be
 * reordered, but small words still count ("anime to watch with friends" is a list search, not
 * "how to watch anime with friends"), and the query may add at most two words of its own.
 */
export function queryMatches(query: string, phrases: readonly string[]): boolean {
  const drop = new Set(["a", "an", "the"]);
  const q = tokens(query).filter((t) => !drop.has(t));
  return phrases.some((phrase) => {
    const p = tokens(phrase).filter((t) => !drop.has(t));
    const pool = [...q];
    for (const t of p) {
      const i = pool.indexOf(t);
      if (i === -1) return false;
      pool.splice(i, 1);
    }
    return pool.length <= 2;
  });
}

/**
 * Exact occurrences of any phrase in the group, never counting the same words twice: "How to
 * stream Netflix on Discord" is one occurrence even though the variant "stream Netflix on
 * Discord" sits inside it. Longer phrases are matched first. Returns the count and the number of
 * words those occurrences cover (for the repetition share).
 */
export function exactOccurrences(text: string, phrases: readonly string[]): { count: number; words: number } {
  const hay = tokens(text);
  const used = new Array<boolean>(hay.length).fill(false);
  let count = 0;
  let words = 0;
  const needles = phrases.map(tokens).filter((n) => n.length > 0).sort((a, b) => b.length - a.length);
  for (const needle of needles) {
    for (let i = 0; i + needle.length <= hay.length; ) {
      if (needle.every((t, j) => hay[i + j] === t && !used[i + j])) {
        for (let j = 0; j < needle.length; j += 1) used[i + j] = true;
        count += 1;
        words += needle.length;
        i += needle.length;
      } else {
        i += 1;
      }
    }
  }
  return { count, words };
}

/** Exact, non-overlapping occurrences of any phrase in the group. */
export function countExact(text: string, phrases: readonly string[]): number {
  return exactOccurrences(text, phrases).count;
}

export function wordCount(text: string): number {
  return tokens(text).length;
}

/** The first n words of a text, for "answer early" checks. */
export function firstWords(text: string, n: number): string {
  return text.trim().split(/\s+/).slice(0, n).join(" ");
}

function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  const groups = w.replace(/e$/, "").match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

/** Flesch–Kincaid grade level; a rough guide for the "7th grade" rule, not a verdict. */
export function readingGrade(text: string): number {
  const sentences = text.split(/[.!?]+\s/).filter((s) => s.trim().length > 0).length || 1;
  const words = text.split(/\s+/).filter((w) => /[a-z]/i.test(w));
  if (words.length === 0) return 0;
  const syl = words.reduce((sum, w) => sum + syllables(w), 0);
  return 0.39 * (words.length / sentences) + 11.8 * (syl / words.length) - 15.59;
}

/** Jaccard similarity of 5-word shingles, for near-duplicate pages. */
export function similarity(a: string, b: string): number {
  const shingles = (text: string) => {
    const t = tokens(text);
    const out = new Set<string>();
    for (let i = 0; i + 5 <= t.length; i += 1) out.add(t.slice(i, i + 5).join(" "));
    return out;
  };
  const sa = shingles(a);
  const sb = shingles(b);
  if (sa.size === 0 || sb.size === 0) return 0;
  let shared = 0;
  for (const s of sa) if (sb.has(s)) shared += 1;
  return shared / (sa.size + sb.size - shared);
}
