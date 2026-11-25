import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { auditPage, auditLinks, staleExceptions, syncWithKeywordMap } from "./checks";
import { extractPage, isPasswordGate } from "./html";
import { PAGE_TARGETS, type PageTargets } from "./targets";
import { countExact, exactOccurrences, matchGroup, matchPhrase, normalize, queryMatches, similarity } from "./text";
import { phoneLines, titlePx } from "./width";

describe("on-page matcher (ANI-81)", () => {
  it("finds exact phrases regardless of case and punctuation", () => {
    assert.equal(matchPhrase("Netflix Watch Party: Watch Netflix Together", "netflix watch party"), "exact");
    assert.equal(normalize("Disney+ & Hulu"), "disney plus and hulu");
  });

  it("treats reordered words and small words as a near match", () => {
    assert.equal(matchPhrase("Teleparty on Crunchyroll", "crunchyroll teleparty"), "near");
    assert.equal(matchPhrase("How do you watch anime with friends online?", "how to watch anime with friends"), "near");
  });

  it("matches simple plurals", () => {
    assert.equal(matchPhrase("Best watch party apps", "watch party app"), "exact");
    assert.equal(matchPhrase("Host watch parties", "watch party"), "exact");
  });

  it("keeps the \"ie\" in plurals like movies, and leaves series alone", () => {
    assert.equal(matchPhrase("watch a movie together online", "watch movies together online"), "near");
    assert.equal(matchPhrase("anime series", "anime series"), "exact");
  });

  it("does not match words scattered far apart", () => {
    const text = "Watch our guide. Many things happen here, and later on, much further along, movies appear together online.";
    assert.equal(matchPhrase(text, "watch movies together online"), null);
  });

  it("does not count a different phrase as exact", () => {
    assert.notEqual(matchGroup("Netflix watch party", ["netflix party"]), "exact");
  });

  it("counts exact occurrences without overlap", () => {
    assert.equal(countExact("watch party app. A watch party app! watch party", ["watch party app"]), 2);
  });

  it("scores near-duplicate text", () => {
    const a = "one two three four five six seven eight nine ten";
    assert.equal(similarity(a, a), 1);
    assert.equal(similarity(a, "eleven twelve thirteen fourteen fifteen sixteen"), 0);
  });
});

describe("on-page HTML extraction (ANI-81)", () => {
  const html = `<!doctype html><html lang="en"><head><title>Netflix Watch Party | AniDachi</title>
    <meta name="description" content="Host a Netflix watch party and watch Netflix together.">
    <meta property="og:title" content="x"><meta property="og:description" content="y">
    <link rel="canonical" href="https://www.anidachi.app/netflix-watch-party"></head>
    <body><main><nav aria-label="On this page"><a href="#a">How to watch Netflix together</a></nav>
    <h1>Netflix Watch Party</h1>
    <div id="answer"><h2>Short answer</h2><p>Netflix has no watch party button. AniDachi adds one for a Netflix watch party.</p></div>
    <h2 id="a">How to Watch Netflix Together</h2><p>Step one.</p><p>Step one.</p>
    <svg><title>icon</title></svg>
    <section id="faq"><details><summary>Does Netflix have a watch party?</summary><p>No.</p></details></section>
    <p>Read <a href="/guides/is-teleparty-free">is Teleparty free</a>.</p></main>
    <script type="application/ld+json">{"@type":"FAQPage","mainEntity":[{"name":"Does Netflix have a watch party?"}]}</script></body></html>`;
  const page = extractPage(html);

  it("reads title, meta, canonical and lang from the head", () => {
    assert.equal(page.title, "Netflix Watch Party | AniDachi");
    assert.match(page.metaDescription, /watch Netflix together/);
    assert.equal(page.canonical, "https://www.anidachi.app/netflix-watch-party");
    assert.equal(page.lang, "en");
  });

  it("leaves navigation out and counts repeated blocks once", () => {
    assert.ok(!page.mainText.includes("How to watch Netflix together\n"), "TOC text leaked into the main text");
    assert.equal(page.mainText.split("Step one.").length - 1, 1);
  });

  it("reads the short answer only, not the next section", () => {
    assert.match(page.answer, /^Netflix has no watch party button/);
    assert.ok(!page.answer.includes("How to Watch"));
  });

  it("collects headings, the visible FAQ, body links and JSON-LD", () => {
    assert.deepEqual(page.h1s, ["Netflix Watch Party"]);
    assert.ok(page.headings.some((h) => h.level === 2 && h.text === "How to Watch Netflix Together"));
    assert.deepEqual(page.faqVisible, ["Does Netflix have a watch party?"]);
    assert.deepEqual(page.links.map((l) => l.href), ["/guides/is-teleparty-free"]);
    assert.equal(page.jsonLd.length, 1);
  });
});

describe("on-page metadata streamed into the body (ANI-81)", () => {
  it("reads title, meta and canonical that Next.js placed in the body, not SVG titles", () => {
    const page = extractPage(`<html lang="en"><head></head><body><svg><title>icon</title></svg><main><h1>Hi</h1></main>
      <title>Netflix Watch Party</title><meta name="description" content="Watch Netflix together.">
      <link rel="canonical" href="https://www.anidachi.app/netflix-watch-party"></body></html>`);
    assert.equal(page.title, "Netflix Watch Party");
    assert.equal(page.metaDescription, "Watch Netflix together.");
    assert.equal(page.canonical, "https://www.anidachi.app/netflix-watch-party");
  });
});

describe("on-page widths (ANI-81)", () => {
  it("estimates title pixels and heading lines", () => {
    assert.ok(titlePx("Netflix Watch Party: Watch Netflix Together in Sync") < 600);
    assert.ok(titlePx("A very long title that keeps going well past the point where Google would cut it off") > 600);
    assert.equal(phoneLines("Short", 36), 1);
  });
});

describe("on-page checks (ANI-81)", () => {
  const target: PageTargets = {
    path: "/netflix-watch-party",
    kind: "hub",
    ticket: "TEST",
    primary: { phrases: ["netflix watch party"], volume: 18100 },
    secondary: [{ phrases: ["watch netflix together"], volume: 5400 }],
    questions: [{ id: "howto", label: "How to watch Netflix together", headingPhrases: ["how to watch netflix together"] }],
    ownedElsewhere: [{ phrases: ["netflix party"], owner: "elsewhere" }],
    parentLinks: ["/"],
  };
  const html = (title: string, h1s: string) => `<html lang="en"><head><title>${title}</title>
    <meta name="description" content="Host a Netflix watch party and watch Netflix together in sync.">
    <meta property="og:title" content="x"><meta property="og:description" content="y">
    <link rel="canonical" href="https://www.anidachi.app/netflix-watch-party"></head><body><main>${h1s}
    <div id="answer"><h2>Short answer</h2><p>A Netflix watch party keeps everyone in sync. Checked 2026.</p></div>
    <h2>How to Watch Netflix Together</h2><p>Open Netflix.</p></main></body></html>`;
  const run = (title: string, h1s: string) =>
    auditPage(extractPage(html(title, h1s)), target, { status: 200, finalPath: target.path, allowNoindex: false }, "https://www.anidachi.app");

  it("passes a page that follows the rules", () => {
    const must = run("Netflix Watch Party: Watch Together", "<h1>Netflix Watch Party</h1>").filter((f) => f.severity === "must");
    assert.deepEqual(must, []);
  });

  it("fails a title without the primary search and a page with two H1s", () => {
    const rules = run("Watch Together", "<h1>Netflix Watch Party</h1><h1>Again</h1>").map((f) => f.rule);
    assert.ok(rules.includes("title-primary"));
    assert.ok(rules.includes("h1-count"));
  });

  it("flags a search owned by another page in the title", () => {
    const rules = run("Netflix Party: Netflix Watch Party", "<h1>Netflix Watch Party</h1>").map((f) => f.rule);
    assert.ok(rules.includes("owned-elsewhere"));
  });

  it("checks inbound links and the parent link", () => {
    const rules = auditLinks(target, [{ from: "/a", text: "read more" }], new Set()).map((f) => f.rule);
    assert.ok(rules.includes("inbound-count"));
    assert.ok(rules.includes("anchor-match"));
    assert.ok(rules.includes("parent-link"));
  });

  it("keeps every target page's primary search distinct", () => {
    const primaries = PAGE_TARGETS.map((t) => normalize(t.primary.phrases[0]));
    assert.equal(new Set(primaries).size, primaries.length);
  });
});

describe("on-page matcher precision (ANI-81)", () => {
  it("uses a tight window for titles and meta descriptions", () => {
    assert.equal(matchPhrase("Netflix has no built-in watch party", "netflix watch party", true), null);
    assert.equal(matchPhrase("Watch party for Netflix", "netflix watch party", true), "near");
  });

  it("treats \"how to\" as a small word in loose matching", () => {
    assert.equal(matchPhrase("Watch Anime Together Long Distance", "how to watch anime together long distance"), "near");
  });
});

describe("search query matching (ANI-81)", () => {
  it("allows reordering and up to two extra words", () => {
    assert.equal(queryMatches("anime watch together", ["watch anime together"]), true);
    assert.equal(queryMatches("crunchyroll watch party extension", ["crunchyroll watch party"]), true);
  });

  it("keeps small words that change the intent", () => {
    assert.equal(queryMatches("anime to watch with friends", ["how to watch anime with friends"]), false);
  });
});

describe("exceptions and gates (ANI-81)", () => {
  const t: PageTargets = {
    path: "/x",
    kind: "hub",
    ticket: "TEST",
    primary: { phrases: ["netflix watch party"], volume: 1 },
    secondary: [],
    questions: [],
    ownedElsewhere: [],
    parentLinks: [],
    exceptions: [{ rule: "intro-primary", reason: "Fixed at launch.", ref: "ANI-0", deferredTo: "adapter launch" }],
  };
  const page = (intro: string) =>
    extractPage(`<html lang="en"><head><title>Netflix Watch Party</title><meta name="description" content="Netflix watch party.">
      <link rel="canonical" href="https://www.anidachi.app/x"></head><body><main><h1>Netflix Watch Party</h1>
      <div id="answer"><h2>Short answer</h2><p>${intro}</p></div></main></body></html>`);
  const run = (intro: string) =>
    auditPage(page(intro), t, { status: 200, finalPath: "/x", allowNoindex: false }, "https://www.anidachi.app");

  it("marks a deferred must-fix as excepted, not failing", () => {
    const f = run("Something else entirely, with no target words at all here.").find((x) => x.rule === "intro-primary");
    assert.ok(f?.excepted?.startsWith("Deferred to adapter launch"));
  });

  it("reports an exception whose finding is gone", () => {
    const findings = run("A Netflix watch party keeps everyone in sync.");
    assert.equal(staleExceptions([t], findings).length, 1);
    assert.equal(staleExceptions([t], run("Nothing relevant in this short answer, sorry.")).length, 0);
  });

  it("recognises a password page", () => {
    assert.equal(isPasswordGate('<form><input name="password" type="password" /></form>'), true);
    assert.equal(isPasswordGate("<main><h1>Netflix Watch Party</h1></main>"), false);
  });
});

describe("keyword map sync across pages (ANI-81)", () => {
  const page = (path: string, phrase: string): PageTargets => ({
    path, kind: "guide", ticket: "T", keywordMapKey: "teleparty",
    primary: { phrases: [phrase], volume: 1 }, secondary: [], questions: [], ownedElsewhere: [], parentLinks: [],
  });
  const map = { sections: [{ key: "teleparty", queries: [["is teleparty free", ["is teleparty free"], 1], ["rave alternative", ["rave alternative"], 1]] as [string, string[], number][] }] };

  it("checks a section against every page that shares it", () => {
    assert.deepEqual(syncWithKeywordMap([page("/a", "is teleparty free"), page("/b", "rave alternative")], map), []);
    assert.equal(syncWithKeywordMap([page("/a", "is teleparty free")], map).length, 1);
  });
});

describe("repetition counting and bare-text blocks (ANI-81)", () => {
  it("counts a phrase once when a shorter variant sits inside it", () => {
    const r = exactOccurrences("How to stream Netflix on Discord. Stream Netflix on Discord.", ["how to stream netflix on discord", "stream netflix on discord"]);
    assert.deepEqual(r, { count: 2, words: 10 });
  });

  it("reads text sitting directly in a div", () => {
    const page = extractPage(`<html><body><main><h1>T</h1><div><strong>Bare answer text</strong> and more.</div></main></body></html>`);
    assert.match(page.mainText, /Bare answer text and more/);
  });
});
