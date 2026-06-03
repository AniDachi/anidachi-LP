const TIKTOK_HASHTAGS = "\n\n#quitsmoking #smokefree #transformation #fyp #quittok";
const MIN_SANE_DESCRIPTION_LENGTH = 20;

function stripDiacritics(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeHashtagToken(token: string): string {
  return `#${stripDiacritics(token)
    .replace(/^#+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")}`;
}

function hasNonAscii(value: string): boolean {
  return /[^\x00-\x7F]/.test(value);
}

function collectHashtags(value: string): string[] {
  const matches = value.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  return matches
    .map((m) => normalizeHashtagToken(m))
    .filter((m) => m.length > 1);
}

/**
 * Adapt an Instagram-style caption for TikTok.
 *
 * Title: first meaningful paragraph stripped of hashtags, max 90 chars.
 * Description: shortened body (hook + turning point + question) with
 * Instagram hashtags replaced by TikTok-native ones.
 */
export function adaptCaptionForTikTok(igCaption: string): {
  title: string;
  description: string;
} {
  const source = igCaption.trim();
  const paragraphs = source
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);

  const hook =
    paragraphs[0]
      ?.replace(/#[\p{L}\p{N}_]+/gu, "")
      .trim()
      .slice(0, 90) || "";

  const contentParagraphs = paragraphs.filter((p) => !p.startsWith("#"));

  const shortened =
    contentParagraphs.length <= 3
      ? contentParagraphs.join("\n\n")
      : [
          contentParagraphs[0],
          contentParagraphs[Math.floor(contentParagraphs.length / 2)],
          contentParagraphs[contentParagraphs.length - 1],
        ].join("\n\n");

  const tiktokCaption = shortened
    .replace(/link in bio/gi, "follow for more")
    .replace(/👇/g, "👆");

  // If transform unexpectedly collapses a long caption, preserve original copy.
  const transformedBody =
    tiktokCaption.trim().length < MIN_SANE_DESCRIPTION_LENGTH &&
    source.length >= 60
      ? source
      : tiktokCaption;

  return {
    title: hook || source.slice(0, 90),
    description: `${transformedBody.trim()}${TIKTOK_HASHTAGS}`,
  };
}

export function summarizeTikTokCaptionTransform(rawCaption: string): {
  captionLengthIn: number;
  captionLengthOut: number;
  first120In: string;
  first120Out: string;
  hasNonAscii: boolean;
  hashtagsIn: string[];
  hashtagsOut: string[];
} {
  const adapted = adaptCaptionForTikTok(rawCaption);
  return {
    captionLengthIn: rawCaption.length,
    captionLengthOut: adapted.description.length,
    first120In: rawCaption.slice(0, 120),
    first120Out: adapted.description.slice(0, 120),
    hasNonAscii: hasNonAscii(rawCaption),
    hashtagsIn: collectHashtags(rawCaption),
    hashtagsOut: collectHashtags(adapted.description),
  };
}
