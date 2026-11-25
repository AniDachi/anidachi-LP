/**
 * On-page SEO checks (ANI-81). Each finding has a stable key so a baseline can separate new
 * problems from known ones. Severities: "must" fails the gate, "warn" needs a PR note, "info" is advice.
 * Rules: Linear document "On-page SEO rules" (owner-approved 25 Nov 2026).
 */
import { jsonLdNodes, type ExtractedPage } from "./html";
import type { PageTargets, SearchGroup } from "./targets";
import { countExact, firstWords, matchGroup, normalize, queryMatches, readingGrade, similarity, wordCount } from "./text";
import { META_MAX_CHARS, META_SOFT_CHARS, TITLE_MAX_PX, phoneLines, titlePx } from "./width";

export type Severity = "must" | "warn" | "info";
export type Group = "technical" | "targeting" | "structure" | "content" | "links" | "schema" | "phones" | "data";

export type Finding = {
  path: string;
  group: Group;
  rule: string;
  severity: Severity;
  message: string;
  fix: string;
  key: string;
  excepted?: string;
};

export type FetchInfo = { status: number; finalPath: string; allowNoindex: boolean };

/** Headings that don't describe a topic, so they never count as covering one. */
const GENERIC_HEADINGS = new Set(
  [
    "short answer", "faq", "frequently asked questions", "related", "related guides", "sources", "start here",
    "what our users say", "questions answers", "more guides", "see it in action", "on this page",
  ].map(normalize),
);

function isGeneric(text: string): boolean {
  return GENERIC_HEADINGS.has(normalize(text));
}

function label(group: SearchGroup): string {
  return `"${group.phrases[0]}"${group.volume ? ` (${group.volume.toLocaleString("en-US")}/mo)` : ""}`;
}

function pathOf(href: string, base: string): string | null {
  try {
    const u = new URL(href, base);
    if (!/(^|\.)anidachi\.app$|^localhost$|^127\.0\.0\.1$/.test(u.hostname) && u.origin !== new URL(base).origin) return null;
    return u.pathname.replace(/\/$/, "") || "/";
  } catch {
    return null;
  }
}

export function auditPage(page: ExtractedPage, t: PageTargets, fetched: FetchInfo, base: string): Finding[] {
  const out: Finding[] = [];
  const add = (group: Group, rule: string, severity: Severity, message: string, fix: string, detail = "") => {
    const key = `${t.path}|${rule}${detail ? `|${detail}` : ""}`;
    const exception = t.exceptions?.find((e) => e.rule === rule);
    out.push({ path: t.path, group, rule, severity, message, fix, key, excepted: exception ? `${exception.reason} (${exception.ref})` : undefined });
  };
  const primary = t.primary;
  const allGroups = [primary, ...t.secondary];

  // Technical
  if (fetched.status !== 200) add("technical", "status", "must", `Returned HTTP ${fetched.status}.`, "Serve the page with status 200.");
  if (fetched.finalPath !== t.path) add("technical", "redirect", "must", `Redirects to ${fetched.finalPath}.`, "Audit the final URL or fix the redirect.");
  const canonicalPath = page.canonical ? pathOf(page.canonical, base) : null;
  if (!page.canonical) add("technical", "canonical-missing", "warn", "No canonical link.", "Add a self-referencing canonical.");
  else if (canonicalPath !== t.path) add("technical", "canonical-other", "must", `Canonical points to ${page.canonical}.`, "Point the canonical at the page itself.");
  if (/noindex/i.test(page.robots) && !fetched.allowNoindex) add("technical", "noindex", "must", `Robots meta says "${page.robots}".`, "Remove noindex from a page meant to rank.");
  if (!page.lang) add("technical", "lang", "warn", "No lang attribute on <html>.", "Set lang (en or de).");
  if (!page.ogTitle || !page.ogDescription) add("technical", "open-graph", "warn", "Open Graph title or description is missing.", "Add og:title and og:description.");

  // Targeting
  if (!matchGroup(page.title, primary.phrases, true)) add("targeting", "title-primary", "must", `Title "${page.title}" lacks the primary search ${label(primary)}.`, "Put the primary search near the start of the title.");
  const tpx = titlePx(page.title);
  if (tpx > TITLE_MAX_PX) add("targeting", "title-width", "warn", `Title is about ${tpx}px wide; Google cuts at about ${TITLE_MAX_PX}px.`, "Shorten the title or move the key words to the front.");
  if ((normalize(page.title).match(/\banidachi\b/g) ?? []).length > 1) add("targeting", "title-brand", "warn", "Brand appears more than once in the title.", "Keep the brand once, at most.");
  if (page.h1s.length !== 1) add("structure", "h1-count", "must", `Found ${page.h1s.length} H1s.`, "Use exactly one H1.");
  if (page.h1s.length > 0 && !matchGroup(page.h1s.join(" "), primary.phrases, true)) add("targeting", "h1-primary", "must", `H1 "${page.h1s[0]}" lacks ${label(primary)}.`, "Include the primary search in the H1.");
  const intro = firstWords(page.answer || page.mainText, 100);
  if (!matchGroup(intro, primary.phrases)) add("targeting", "intro-primary", "must", `The first 100 words don't mention ${label(primary)}.`, "Answer the primary search in the first paragraph, using its words.");
  if (!page.metaDescription) add("targeting", "meta-missing", "must", "No meta description.", "Write a meta description with the primary and one secondary search.");
  else {
    if (!matchGroup(page.metaDescription, primary.phrases, true)) add("targeting", "meta-primary", "warn", `Meta description lacks ${label(primary)}.`, "Add the primary search to the meta description.");
    else if (!matchGroup(page.metaDescription.slice(0, 120), primary.phrases, true)) add("targeting", "meta-front", "info", "The primary search comes after the first 120 characters of the meta.", "Move it forward; phones cut meta descriptions near 120 characters.");
    if (t.secondary.length > 0 && !t.secondary.some((s) => matchGroup(page.metaDescription, s.phrases, true))) add("targeting", "meta-secondary", "warn", "Meta description has no secondary search.", `Add one, for example ${label([...t.secondary].sort((a, b) => b.volume - a.volume)[0])}.`);
    const chars = page.metaDescription.length;
    if (chars > META_MAX_CHARS) add("targeting", "meta-length", "warn", `Meta description is ${chars} characters; Google shows about ${META_SOFT_CHARS}–${META_MAX_CHARS}.`, "Shorten it to about 155 characters.");
    else if (chars > META_SOFT_CHARS) add("targeting", "meta-length", "info", `Meta description is ${chars} characters, at the edge of what Google shows.`, "Keep the important words in the first 120 characters.");
  }
  for (const owned of t.ownedElsewhere) {
    const inTitleOrH1 = [page.title, ...page.h1s].some((text) => matchGroup(text, owned.phrases) === "exact");
    if (inTitleOrH1) add("targeting", "owned-elsewhere", "warn", `"${owned.phrases[0]}" is in the title or H1 but belongs to ${owned.owner}.`, "Remove it from the title and H1 to avoid competing with that page.", owned.phrases[0]);
  }

  // Structure
  const topical = page.headings.filter((h) => !isGeneric(h.text));
  let prev = 0;
  for (const h of page.headings) {
    if (prev && h.level > prev + 1) add("structure", "heading-skip", "warn", `"${h.text}" is an H${h.level} after an H${prev}.`, "Don't skip heading levels.", `${h.level}:${normalize(h.text)}`);
    prev = h.level;
  }
  const seen = new Map<string, number>();
  for (const h of page.headings.filter((x) => x.level <= 2)) {
    const n = normalize(h.text);
    seen.set(n, (seen.get(n) ?? 0) + 1);
  }
  for (const [text, n] of seen) if (n > 1) add("structure", "heading-duplicate", "warn", `Heading "${text}" appears ${n} times.`, "Give each section a distinct heading.", text);
  for (const q of t.questions) {
    const covered = topical.some((h) => h.level >= 2 && q.headingPhrases.some((p) => matchGroup(h.text, [p])));
    if (!covered) add("structure", "question-uncovered", "warn", `No heading covers: ${q.label}.`, "Add a section whose heading names this question.", q.id);
  }
  const headingCoverage = t.secondary.filter((s) => topical.some((h) => h.level >= 2 && matchGroup(h.text, s.phrases))).length;
  if (t.kind !== "directory" && t.secondary.length > 0 && headingCoverage === 0) add("structure", "headings-no-secondary", "warn", "No H2 or H3 contains any secondary search.", "Name at least one section after a secondary search, where it reads naturally.");

  // Content
  const fullText = [page.answer, page.mainText].join("\n");
  const words = wordCount(fullText);
  for (const s of t.secondary) {
    if (!matchGroup(fullText, s.phrases) && !matchGroup(page.faqVisible.join(" "), s.phrases)) add("content", "secondary-missing", "warn", `The page never mentions ${label(s)}.`, "Use it once in natural wording, in a heading, paragraph or FAQ answer.", s.phrases[0]);
  }
  for (const grp of allGroups) {
    const n = countExact(fullText, grp.phrases);
    const share = words ? (n * grp.phrases[0].split(" ").length) / words : 0;
    if (share > 0.025) add("content", "repetition", "warn", `${label(grp)} makes up ${(share * 100).toFixed(1)}% of the words (${n} times).`, "Use it less often; vary the wording.", grp.phrases[0]);
  }
  const grade = readingGrade(page.mainText);
  if (grade > 9) add("content", "readability", "info", `Reading level is about grade ${grade.toFixed(0)}.`, "Shorter sentences and plainer words; the target is about grade 7.");
  if (t.kind !== "home" && !/\bchecked\b|\b20\d\d\b/i.test(page.mainText)) add("content", "sources-dates", "info", "No visible check date or year for facts.", "Show when platform or competitor facts were checked.");

  // Structured data
  const nodes = jsonLdNodes(page.jsonLd);
  const faqNode = nodes.find((n) => n["@type"] === "FAQPage");
  if (faqNode) {
    const schemaQs = ((faqNode.mainEntity as { name?: string }[]) ?? []).map((q) => normalize(q.name ?? ""));
    const visible = new Set(page.faqVisible.map(normalize));
    const missing = schemaQs.filter((q) => !visible.has(q));
    if (visible.size > 0 && missing.length > 0) add("schema", "faq-mismatch", "warn", `${missing.length} FAQ question(s) in the structured data aren't visible on the page.`, "Keep the FAQ JSON-LD and the visible FAQ identical.");
  }
  const howTo = nodes.find((n) => n["@type"] === "HowTo");
  if (howTo) {
    const steps = ((howTo.step as { name?: string }[]) ?? []).map((s) => s.name ?? "");
    const hidden = steps.filter((s) => s && !matchGroup(fullText, [s]));
    if (hidden.length > 0) add("schema", "howto-mismatch", "warn", `HowTo steps not visible: ${hidden.join("; ")}.`, "Show the same steps on the page.");
  } else if (t.kind === "hub") add("schema", "howto-missing", "info", "No HowTo structured data.", "Hubs should mark up their steps as HowTo (ANI-43).");
  if (t.kind !== "home" && !nodes.some((n) => n["@type"] === "BreadcrumbList")) add("schema", "breadcrumb-missing", "info", "No BreadcrumbList structured data.", "Add breadcrumbs.");

  // Phones
  if (page.h1s[0] && phoneLines(page.h1s[0], 36) > 3) add("phones", "h1-lines", "warn", `H1 runs about ${phoneLines(page.h1s[0], 36)} lines on a phone.`, "Shorten the H1.");
  for (const h of page.headings.filter((x) => x.level === 2 && !isGeneric(x.text))) {
    const lines = phoneLines(h.text, 32);
    if (lines > 3) add("phones", "h2-lines", "warn", `"${h.text}" runs about ${lines} lines on a phone.`, "Shorten the heading.", normalize(h.text));
  }
  return out;
}

export type InboundLink = { from: string; text: string };

/** Links group: needs the inbound links found by crawling the site. */
export function auditLinks(t: PageTargets, inbound: InboundLink[], outboundPaths: Set<string>): Finding[] {
  const out: Finding[] = [];
  const add = (rule: string, severity: Severity, message: string, fix: string, detail = "") =>
    out.push({ path: t.path, group: "links", rule, severity, message, fix, key: `${t.path}|${rule}${detail ? `|${detail}` : ""}` });
  const sources = new Set(inbound.filter((l) => l.from !== t.path).map((l) => l.from));
  if (sources.size === 0) add("orphan", "warn", "No body links from other pages.", "Link it from related pages' body text.");
  else if (sources.size < 2) add("inbound-count", "warn", `Only ${sources.size} page links to it in body text.`, "Add contextual links from at least two related pages.");
  const groups = [t.primary, ...t.secondary];
  const anchors = inbound.filter((l) => l.from !== t.path).map((l) => normalize(l.text)).filter(Boolean);
  if (anchors.length > 0 && !anchors.some((a) => groups.some((g) => matchGroup(a, g.phrases)))) add("anchor-match", "warn", "No incoming anchor uses one of the page's searches.", `Use "${t.primary.phrases[0]}" (or a secondary search) as anchor text on at least one page.`);
  if (anchors.length >= 5) {
    const counts = new Map<string, number>();
    for (const a of anchors) counts.set(a, (counts.get(a) ?? 0) + 1);
    const [top, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    // Exact-match internal anchors are fine for Google; this is advice only (external anchors are the risk).
    if (n / anchors.length > 0.8) add("anchor-diversity", "info", `${Math.round((100 * n) / anchors.length)}% of incoming anchors are "${top}".`, "Vary the anchor text naturally.");
  }
  for (const parent of t.parentLinks) if (!outboundPaths.has(parent)) add("parent-link", "info", `No body link up to ${parent}.`, `Link ${parent} once with a category anchor (ANI-43 v2).`, parent);
  return out;
}

/** Near-duplicate hubs: shingle similarity above 60%. */
export function auditDuplicates(pages: { path: string; text: string }[]): Finding[] {
  const out: Finding[] = [];
  for (let i = 0; i < pages.length; i += 1) {
    for (let j = i + 1; j < pages.length; j += 1) {
      const s = similarity(pages[i].text, pages[j].text);
      if (s > 0.6) out.push({ path: pages[i].path, group: "content", rule: "near-duplicate", severity: "warn", message: `${Math.round(s * 100)}% similar to ${pages[j].path}.`, fix: "Make each hub's content specific to its platform.", key: `${pages[i].path}|near-duplicate|${pages[j].path}` });
    }
  }
  return out;
}

export type GscRow = { query: string; page: string; impressions: number; clicks: number; position: number };

/** Data group: cannibalization and enrichment ideas from a Search Console export. */
export function auditGsc(t: PageTargets, page: ExtractedPage, rows: GscRow[], base: string): Finding[] {
  const out: Finding[] = [];
  const add = (rule: string, severity: Severity, message: string, fix: string, detail: string) =>
    out.push({ path: t.path, group: "data", rule, severity, message, fix, key: `${t.path}|${rule}|${detail}` });
  const byPath = rows.map((r) => ({ ...r, path: pathOf(r.page, base) ?? r.page })).filter((r) => !/anidachi|ani dachi/i.test(r.query));
  for (const grp of [t.primary, ...t.secondary]) {
    const impressions = new Map<string, number>();
    for (const r of byPath) if (queryMatches(r.query, grp.phrases)) impressions.set(r.path, (impressions.get(r.path) ?? 0) + r.impressions);
    const mine = impressions.get(t.path) ?? 0;
    const [topPath, topImpr] = [...impressions.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
    if (topPath && topPath !== t.path && topImpr > mine * 1.5 && topImpr >= 20) add("cannibalization", "warn", `Google shows ${topPath} more for ${label(grp)} (${topImpr} vs ${mine} impressions).`, "Check which page should own this search; align titles, H1s and internal anchors.", grp.phrases[0]);
  }
  const topical = page.headings.filter((h) => !isGeneric(h.text));
  const targetPhrases = [t.primary, ...t.secondary].flatMap((g) => g.phrases);
  const perQuery = new Map<string, { impr: number; pos: number }>();
  for (const r of byPath.filter((x) => x.path === t.path)) {
    const q = perQuery.get(r.query) ?? { impr: 0, pos: 0 };
    q.pos = (q.pos * q.impr + r.position * r.impressions) / (q.impr + r.impressions || 1);
    q.impr += r.impressions;
    perQuery.set(r.query, q);
  }
  const ideas = [...perQuery.entries()]
    .filter(([q, v]) => v.impr >= 10 && v.pos >= 4 && v.pos <= 20 && !queryMatches(q, targetPhrases) && !topical.some((h) => matchGroup(h.text, [q])))
    .sort((a, b) => b[1].impr - a[1].impr)
    .slice(0, 5);
  for (const [q, v] of ideas) add("gsc-opportunity", "info", `"${q}" brings ${v.impr} impressions at position ${v.pos.toFixed(1)}, with no heading for it.`, "Consider a section or FAQ answer for it, if it fits the page's intent.", q);
  return out;
}

/** Sync check against the locked ANI-68 keyword map (read-only). */
export function syncWithKeywordMap(targets: readonly PageTargets[], map: { sections: { key: string; queries: [string, string[], number][] }[] }): string[] {
  const notes: string[] = [];
  for (const t of targets) {
    if (!t.keywordMapKey) continue;
    const section = map.sections.find((s) => s.key === t.keywordMapKey);
    if (!section) {
      notes.push(`${t.path}: section "${t.keywordMapKey}" not found in the ANI-68 map.`);
      continue;
    }
    const ours = new Set([t.primary, ...t.secondary, ...t.ownedElsewhere].flatMap((g) => g.phrases).map(normalize));
    for (const [labelText, variants] of section.queries) {
      if (!variants.some((v) => ours.has(normalize(v)))) notes.push(`${t.path}: ANI-68 tracks "${labelText}", which targets.ts doesn't list.`);
    }
  }
  return notes;
}
