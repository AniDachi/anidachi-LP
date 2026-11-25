/**
 * Minimal HTML reader for the on-page SEO check (ANI-81). Pages are server-rendered by
 * Next.js, so a tag-stream parser is enough; no DOM dependency. It extracts what search
 * engines read: title, meta, canonical, headings, visible main text (each block once, without
 * navigation such as breadcrumbs and the table of contents), the short answer, body links,
 * the visible FAQ and the JSON-LD.
 */

export type HtmlNode = {
  tag: string;
  attrs: Record<string, string>;
  children: (HtmlNode | string)[];
  parent: HtmlNode | null;
};

const VOID = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr",
]);
const RAW_TEXT = new Set(["script", "style", "textarea"]);
const BLOCK = new Set([
  "p", "li", "td", "th", "dt", "dd", "summary", "figcaption", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "caption",
]);
/** Never read as page content: navigation, code, hidden or explicitly ignored subtrees. */
function isIgnored(node: HtmlNode): boolean {
  if (["nav", "script", "style", "noscript", "template", "svg", "head"].includes(node.tag)) return true;
  if (node.attrs["aria-hidden"] === "true" || "hidden" in node.attrs || "data-seo-ignore" in node.attrs) return true;
  return false;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–");
}

function parseAttrs(source: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return attrs;
}

export function parseHtml(html: string): HtmlNode {
  const root: HtmlNode = { tag: "#root", attrs: {}, children: [], parent: null };
  let current = root;
  const re = /<!--[\s\S]*?-->|<!doctype[^>]*>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m.index > last) current.children.push(decodeEntities(html.slice(last, m.index)));
    last = re.lastIndex;
    if (m[1]) {
      const tag = m[1].toLowerCase();
      let node: HtmlNode | null = current;
      while (node && node.tag !== tag) node = node.parent;
      if (node && node.parent) current = node.parent;
      continue;
    }
    if (!m[2]) continue;
    const tag = m[2].toLowerCase();
    const rawAttrs = m[3] ?? "";
    const node: HtmlNode = { tag, attrs: parseAttrs(rawAttrs), children: [], parent: current };
    current.children.push(node);
    const selfClosing = rawAttrs.trim().endsWith("/");
    if (VOID.has(tag) || selfClosing) continue;
    if (RAW_TEXT.has(tag)) {
      const close = html.toLowerCase().indexOf(`</${tag}`, last);
      const end = close === -1 ? html.length : close;
      node.children.push(html.slice(last, end));
      const gt = html.indexOf(">", end);
      last = gt === -1 ? html.length : gt + 1;
      re.lastIndex = last;
      continue;
    }
    current = node;
  }
  if (last < html.length) current.children.push(decodeEntities(html.slice(last)));
  return root;
}

export function walk(node: HtmlNode, visit: (n: HtmlNode) => boolean | void): void {
  for (const child of node.children) {
    if (typeof child === "string") continue;
    if (visit(child) === false) continue;
    walk(child, visit);
  }
}

export function find(node: HtmlNode, pred: (n: HtmlNode) => boolean): HtmlNode | null {
  let found: HtmlNode | null = null;
  walk(node, (n) => {
    if (found) return false;
    if (pred(n)) {
      found = n;
      return false;
    }
    return undefined;
  });
  return found;
}

export function findAll(node: HtmlNode, pred: (n: HtmlNode) => boolean, skipIgnored = false): HtmlNode[] {
  const out: HtmlNode[] = [];
  walk(node, (n) => {
    if (skipIgnored && isIgnored(n)) return false;
    if (pred(n)) out.push(n);
    return undefined;
  });
  return out;
}

/** Visible text of a node (ignored subtrees left out), whitespace collapsed. */
export function textOf(node: HtmlNode, skipIgnored = true): string {
  const parts: string[] = [];
  const visit = (n: HtmlNode) => {
    for (const child of n.children) {
      if (typeof child === "string") parts.push(child);
      else if (!(skipIgnored && isIgnored(child))) {
        if (child.tag === "br") parts.push(" ");
        visit(child);
        if (BLOCK.has(child.tag) || child.tag === "div") parts.push(" ");
      }
    }
  };
  visit(node);
  return parts.join("").replace(/\s+/g, " ").trim();
}

function insideIgnored(node: HtmlNode, stopAt: HtmlNode): boolean {
  for (let p: HtmlNode | null = node.parent; p && p !== stopAt; p = p.parent) if (isIgnored(p)) return true;
  return false;
}

export type Heading = { level: number; text: string; id?: string };
export type PageLink = { href: string; text: string };

export type ExtractedPage = {
  title: string;
  metaDescription: string;
  robots: string;
  canonical: string;
  lang: string;
  ogTitle: string;
  ogDescription: string;
  /** All H1s in the body (navigation excluded). */
  h1s: string[];
  /** H1–H6 inside main, in order, navigation excluded. */
  headings: Heading[];
  /** Visible main text, each block once. */
  mainText: string;
  /** The short answer, or the first real paragraph after the H1. */
  answer: string;
  links: PageLink[];
  faqVisible: string[];
  jsonLd: unknown[];
};

/** The staging password page (or any page asking for a password) instead of real content. */
export function isPasswordGate(html: string): boolean {
  return /<input\b[^>]*\btype=["']?password\b/i.test(html);
}

export function extractPage(html: string): ExtractedPage {
  const root = parseHtml(html);
  const htmlEl = find(root, (n) => n.tag === "html");
  const head = find(root, (n) => n.tag === "head") ?? root;
  const body = find(root, (n) => n.tag === "body") ?? root;
  // Next.js streams metadata into the body for ordinary browsers (dev server, dynamic pages);
  // the browser and Google's renderer move it into the head. Read the head first, then the body
  // outside SVG icons and scripts.
  const headTags = (pred: (n: HtmlNode) => boolean): HtmlNode[] => {
    const out = findAll(head, pred);
    if (body === root) return out;
    walk(body, (n) => {
      if (["svg", "script", "style", "template", "noscript"].includes(n.tag)) return false;
      if (pred(n)) out.push(n);
      return undefined;
    });
    return out;
  };
  const titleEl = headTags((n) => n.tag === "title")[0];
  const metas = headTags((n) => n.tag === "meta");
  const meta = (key: string) =>
    metas.find((m) => m.attrs.name === key || m.attrs.property === key)?.attrs.content?.trim() ?? "";
  const canonical = headTags((n) => n.tag === "link" && (n.attrs.rel ?? "").split(/\s+/).includes("canonical"))[0];

  const main = find(body, (n) => n.tag === "main") ?? body;

  const h1s = findAll(body, (n) => n.tag === "h1", true).map((n) => textOf(n)).filter(Boolean);
  const headings = findAll(main, (n) => /^h[1-6]$/.test(n.tag), true)
    .map((n) => ({ level: Number(n.tag[1]), text: textOf(n), id: n.attrs.id }))
    .filter((h) => h.text);

  // Leaf blocks, each distinct text once (responsive layouts render some blocks twice).
  const seen = new Set<string>();
  const blocks: string[] = [];
  walk(main, (n) => {
    if (isIgnored(n)) return false;
    if (BLOCK.has(n.tag) && !find(n, (d) => BLOCK.has(d.tag))) {
      const t = textOf(n);
      if (t && !seen.has(t)) {
        seen.add(t);
        blocks.push(t);
      }
      return false;
    }
    return undefined;
  });
  const mainText = blocks.join("\n");

  let answer = "";
  const answerEl = find(main, (n) => n.attrs.id === "answer");
  if (answerEl) {
    if (/^h[1-6]$/.test(answerEl.tag)) {
      const siblings = answerEl.parent?.children.filter((c): c is HtmlNode => typeof c !== "string") ?? [];
      const next = siblings[siblings.indexOf(answerEl) + 1];
      answer = next ? textOf(next) : "";
    } else {
      const heading = find(answerEl, (n) => /^h[1-6]$/.test(n.tag));
      const full = textOf(answerEl);
      answer = heading ? full.replace(textOf(heading), "").trim() : full;
    }
  }
  if (!answer) {
    const afterH1 = blocks.slice(Math.max(0, blocks.findIndex((b) => h1s.includes(b))) + 1);
    answer = afterH1.find((b) => b.split(/\s+/).length >= 8) ?? "";
  }

  const links = findAll(main, (n) => n.tag === "a" && Boolean(n.attrs.href), false)
    .filter((a) => !insideIgnored(a, main) && !isIgnored(a))
    .map((a) => ({ href: a.attrs.href, text: textOf(a) }));

  const faqVisible = findAll(main, (n) => n.tag === "summary", true)
    .map((n) => textOf(n))
    .filter((t) => t.includes("?"));

  const jsonLd = findAll(root, (n) => n.tag === "script" && n.attrs.type === "application/ld+json")
    .map((n) => {
      try {
        return JSON.parse(String(n.children[0] ?? ""));
      } catch {
        return null;
      }
    })
    .filter((x) => x !== null);

  return {
    title: titleEl ? textOf(titleEl, false) : "",
    metaDescription: meta("description"),
    robots: meta("robots"),
    canonical: canonical?.attrs.href ?? "",
    lang: htmlEl?.attrs.lang ?? "",
    ogTitle: meta("og:title"),
    ogDescription: meta("og:description"),
    h1s,
    headings,
    mainText,
    answer,
    links,
    faqVisible,
    jsonLd,
  };
}

/** Flatten JSON-LD (top-level arrays and @graph) into typed nodes. */
export function jsonLdNodes(jsonLd: unknown[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const add = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(add);
    else if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (Array.isArray(o["@graph"])) add(o["@graph"]);
      else out.push(o);
    }
  };
  jsonLd.forEach(add);
  return out;
}
