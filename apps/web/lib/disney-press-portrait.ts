import { DomUtils, parseDocument } from "htmlparser2";

export type DisneyPressTitle = { slug: string; synopsis: string; year?: string };

export function titleSlug(title: string) {
  return title.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function studioPortrait(url: URL) {
  if (url.origin !== "https://lumiere-a.akamaihd.net" || url.username || url.password || !url.pathname.startsWith("/v1/images/")) return false;
  const size = /^\d+,\d+,(\d+),(\d+)$/.exec(url.searchParams.get("region") ?? "");
  return size !== null && Number(size[1]) >= 200 && Number(size[1]) < Number(size[2]);
}

// Both Disney and 20th Century publish the film's poster in Open Graph and the theatrical release date next to its label.
export function studioMoviePortrait(html: string, title: DisneyPressTitle) {
  if (!title.year) return null;
  const root = parseDocument(html);
  const meta = (property: string) => DomUtils.findOne(el => el.name === "meta" && el.attribs.property === property, root.children)?.attribs.content;
  if (titleSlug(meta("og:title") ?? "") !== title.slug) return null;
  const label = DomUtils.findOne(el => el.name === "label" && DomUtils.textContent(el).trim() === "Release Date:", root.children);
  const release = label && DomUtils.nextElementSibling(label);
  if (!release || DomUtils.textContent(release).match(/\b\d{4}\b/)?.[0] !== title.year) return null;
  const image = URL.parse(meta("og:image") ?? "");
  return image && studioPortrait(image) ? image.href : null;
}

// Press pages use names instead of entity IDs. Corroborate the heading with the
// synopsis from Disney's exact entity so that a remake cannot borrow another poster.
export function pressPortrait(html: string, title: DisneyPressTitle, outlet: "hulu" | "disney") {
  const root = parseDocument(html);
  const heading = DomUtils.findOne(el => el.name === "h1", root.children);
  if (!heading) return null;
  const headingSlug = titleSlug(DomUtils.textContent(heading));
  if (headingSlug !== (outlet === "disney" ? title.slug + "-logos-and-key-art" : title.slug)) return null;
  const words = titleSlug(title.synopsis).split("-").slice(0, 180);
  const paragraphs = DomUtils.findAll(el => el.name === "p", root.children)
    .map(p => "-" + titleSlug(DomUtils.textContent(p)) + "-").join("\n");
  if (!words.some((_, i) => i + 6 <= words.length &&
    paragraphs.includes("-" + words.slice(i, i + 6).join("-") + "-"))) return null;

  for (const image of DomUtils.findAll(el => el.name === "img", root.children)) {
    const url = URL.parse(image.attribs.src ?? "");
    if (!url || url.username || url.password || url.port) continue;
    if (outlet === "hulu" && url.origin === "https://press.hulu.com" && url.pathname.startsWith("/storage/uploads/")
      && image.attribs.alt?.toLowerCase() === "show logo") {
      const size = /-(\d+)x(\d+)\.(?:png|jpe?g|webp)$/i.exec(url.pathname);
      if (size && Number(size[1]) >= 200 && Number(size[1]) < Number(size[2])) return url.href;
    }
    if (outlet === "disney" && studioPortrait(url)) {
      const label = titleSlug(image.attribs.alt ?? "");
      if (label.startsWith(title.slug + "-") && label.endsWith("-key-art")) return url.href;
    }
  }
  return null;
}
