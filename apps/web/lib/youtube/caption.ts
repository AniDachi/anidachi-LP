const MAX_TITLE_LENGTH = 100;
const SHORTS_TAG = "#Shorts";

function hasShortsTag(text: string): boolean {
  return /#shorts\b/i.test(text);
}

function ensureShortsTag(title: string, description: string): {
  title: string;
  description: string;
} {
  if (hasShortsTag(title) || hasShortsTag(description)) {
    return { title, description };
  }
  if (description.trim()) {
    return { title, description: `${description.trim()}\n\n${SHORTS_TAG}` };
  }
  return { title: `${title} ${SHORTS_TAG}`.trim(), description: SHORTS_TAG };
}

/** Split IG-style caption into YouTube title + description for Shorts. */
export function adaptCaptionForYouTube(caption: string): {
  title: string;
  description: string;
} {
  const trimmed = caption.trim();
  if (!trimmed) {
    return ensureShortsTag("Short", "");
  }

  const lines = trimmed.split(/\r?\n/);
  const firstLine = (lines[0] ?? "").trim();
  const rest = lines.slice(1).join("\n").trim();

  let title = firstLine || trimmed.slice(0, MAX_TITLE_LENGTH);
  if (title.length > MAX_TITLE_LENGTH) {
    title = title.slice(0, MAX_TITLE_LENGTH).trimEnd();
  }

  let description = rest;
  if (!description && trimmed.length > title.length) {
    description = trimmed.slice(title.length).trim();
  }

  return ensureShortsTag(title, description);
}
