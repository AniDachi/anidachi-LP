/**
 * Search targets per SEO URL for the on-page check (ANI-81, rules in the Linear document
 * "On-page SEO rules"). Built from the locked ANI-68 keyword map; volumes are Keyword Planner
 * exact, worldwide, pulled 24–25 Nov 2026. A group lists one search plus the variants Google
 * treats as the same search; write it once, in its most natural form.
 *
 * Change a page's targets here first, then write. Changes go in the decisions log.
 */

export type SearchGroup = {
  /** Phrases Google treats as one search; the first is the natural form to use. */
  phrases: readonly string[];
  /** Keyword Planner exact, worldwide, monthly. */
  volume: number;
};

export type TargetQuestion = {
  id: string;
  /** What the section answers, in plain words (shown in the report). */
  label: string;
  /** A heading matching any of these (near match) counts as covering the question. */
  headingPhrases: readonly string[];
};

export type RuleException = {
  rule: string;
  reason: string;
  /** Decisions-log entry or ticket that approved it. */
  ref: string;
  /**
   * Set for a known must-fix finding we chose to fix later: what lifts it (a release or date).
   * The check stops failing on it, and says when the exception is no longer needed.
   */
  deferredTo?: string;
};

export type PageTargets = {
  path: string;
  kind: "home" | "hub" | "guide" | "directory";
  ticket: string;
  /** Section key in the locked ANI-68 keyword_map.json, for the sync check. */
  keywordMapKey?: string;
  primary: SearchGroup;
  secondary: readonly SearchGroup[];
  questions: readonly TargetQuestion[];
  /** Searches another page owns: must not appear in this page's title or H1. */
  ownedElsewhere: readonly { phrases: readonly string[]; owner: string }[];
  /** Pages this one should link up to (pillar or homepage). */
  parentLinks: readonly string[];
  exceptions?: readonly RuleException[];
};

const g = (volume: number, ...phrases: string[]): SearchGroup => ({ phrases, volume });

export const PAGE_TARGETS: readonly PageTargets[] = [
  {
    path: "/",
    kind: "home",
    ticket: "ANI-36",
    keywordMapKey: "home",
    primary: g(3600, "watch party app", "watch party apps"),
    secondary: [
      g(6600, "watch movies together online", "watch a film together online"),
      g(3600, "watch together online"),
      g(2400, "watch movies with friends online"),
      g(2400, "watch together app"),
      g(1900, "app to watch movies together"),
      g(1600, "watch party website"),
      // Owner rule 25 Nov 2026: the homepage keeps anime and Crunchyroll relevance until the hubs take over.
      g(1000, "crunchyroll watch party", "watch party crunchyroll"),
      g(880, "watch anime together", "anime watch together"),
      g(260, "anime watch party"),
    ],
    questions: [
      { id: "what", label: "What a watch party app is / how it works", headingPhrases: ["how it works", "how anidachi works", "watch party app"] },
      { id: "services", label: "Which streaming services it works on", headingPhrases: ["works on", "streaming services"] },
      { id: "movies", label: "Watch movies and shows together online", headingPhrases: ["watch movies together online", "watch movies and shows together"] },
      { id: "anime", label: "Watch anime together on Crunchyroll", headingPhrases: ["watch anime together", "crunchyroll"] },
      { id: "compare", label: "How it compares with other watch party apps", headingPhrases: ["compares", "compare"] },
      { id: "price", label: "What it costs", headingPhrases: ["free", "price", "pricing"] },
    ],
    ownedElsewhere: [
      { phrases: ["how to watch movies together online"], owner: "/guides/watch-movies-together-online" },
      { phrases: ["netflix watch party"], owner: "/netflix-watch-party" },
      { phrases: ["youtube watch party", "watch youtube together"], owner: "/watch-youtube-together" },
      { phrases: ["prime video watch party"], owner: "/prime-video-watch-party" },
    ],
    parentLinks: [],
    exceptions: [
      { rule: "h1-primary", reason: "The H1 is fixed by owner rule (19 Nov 2026); the title carries \"watch party app\".", ref: "ANI-36" },
      {
        rule: "intro-primary",
        reason: "Homepage copy ships with the four-adapter launch; the revised draft puts \"watch party app\" in the opening.",
        ref: "ANI-36",
        deferredTo: "adapter launch",
      },
    ],
  },
  {
    path: "/netflix-watch-party",
    kind: "hub",
    ticket: "ANI-67",
    keywordMapKey: "netflix",
    primary: g(18100, "netflix watch party", "watch party netflix"),
    secondary: [
      g(5400, "watch netflix together"),
      g(3600, "how to watch netflix together"),
      g(1000, "how to watch netflix with friends"),
      g(8100, "teleparty netflix", "netflix teleparty"),
    ],
    questions: [
      { id: "howto", label: "How to watch Netflix together", headingPhrases: ["how to watch netflix together"] },
      { id: "friends", label: "How to watch Netflix with friends online", headingPhrases: ["watch netflix with friends online"] },
      { id: "party", label: "What happened to Netflix Party", headingPhrases: ["netflix party"] },
      { id: "teleparty", label: "AniDachi vs Teleparty", headingPhrases: ["teleparty"] },
      { id: "discord", label: "Netflix on Discord", headingPhrases: ["discord"] },
      { id: "fix", label: "Watch party not working", headingPhrases: ["not working"] },
    ],
    ownedElsewhere: [
      { phrases: ["netflix party"], owner: "(not targeted: searches for Teleparty itself, ANI-37)" },
      { phrases: ["does netflix have a watch party"], owner: "/guides/does-netflix-have-a-watch-party" },
      { phrases: ["how to stream netflix on discord"], owner: "/guides/how-to-screen-share-netflix-on-discord" },
    ],
    parentLinks: ["/"],
  },
  {
    path: "/watch-crunchyroll-together",
    kind: "hub",
    ticket: "ANI-38",
    keywordMapKey: "crunchyroll",
    primary: g(1000, "crunchyroll watch party", "watch party crunchyroll"),
    secondary: [
      g(720, "watch crunchyroll together", "crunchyroll watch together", "watch together crunchyroll"),
      g(480, "crunchyroll party"),
      g(390, "teleparty crunchyroll", "crunchyroll teleparty"),
      g(320, "how to watch crunchyroll with friends"),
    ],
    questions: [
      { id: "has", label: "Does Crunchyroll have a watch party", headingPhrases: ["does crunchyroll have a watch party"] },
      { id: "howto", label: "How to watch Crunchyroll together", headingPhrases: ["how to watch crunchyroll together"] },
      { id: "friends", label: "How to watch Crunchyroll with friends online", headingPhrases: ["watch crunchyroll with friends online"] },
      { id: "teleparty", label: "Teleparty on Crunchyroll", headingPhrases: ["teleparty"] },
      { id: "party", label: "What happened to Crunchyroll Party", headingPhrases: ["crunchyroll party"] },
      { id: "group", label: "Group watch tips", headingPhrases: ["group watch"] },
    ],
    ownedElsewhere: [
      { phrases: ["how to stream crunchyroll on discord"], owner: "/guides/can-you-screen-share-crunchyroll-on-discord" },
    ],
    parentLinks: ["/"],
  },
  {
    path: "/watch-anime-together",
    kind: "hub",
    ticket: "ANI-8",
    keywordMapKey: "anime",
    primary: g(880, "watch anime together", "anime watch together", "watch together anime"),
    secondary: [
      g(590, "anime together"),
      g(260, "anime watch party"),
      g(110, "how to watch anime together long distance"),
      g(90, "how to watch anime with friends"),
      g(70, "websites to watch anime together", "watch anime together website"),
    ],
    questions: [
      { id: "howto", label: "How to watch anime together", headingPhrases: ["how to watch anime together"] },
      { id: "host", label: "Host an anime watch party", headingPhrases: ["anime watch party"] },
      { id: "websites", label: "Websites to watch anime together", headingPhrases: ["websites to watch anime together"] },
      { id: "distance", label: "Long distance", headingPhrases: ["long distance"] },
    ],
    ownedElsewhere: [{ phrases: ["crunchyroll watch party"], owner: "/watch-crunchyroll-together" }],
    parentLinks: ["/"],
  },
  {
    path: "/watch-youtube-together",
    kind: "hub",
    ticket: "ANI-39",
    keywordMapKey: "youtube",
    primary: g(3600, "watch youtube together", "watch together youtube"),
    secondary: [
      g(2400, "youtube watch party", "watch party youtube"),
      g(590, "how to watch youtube with friends"),
      g(320, "watch youtube video together"),
      g(40, "youtube watch party extension"),
    ],
    questions: [
      { id: "howto", label: "How to watch YouTube together", headingPhrases: ["how to watch youtube together"] },
      { id: "friends", label: "How to watch YouTube with friends online", headingPhrases: ["watch youtube with friends online"] },
      { id: "has", label: "Does YouTube have a watch party", headingPhrases: ["does youtube have a watch party"] },
      { id: "w2g", label: "Watch2Gether or AniDachi", headingPhrases: ["watch2gether"] },
      { id: "extension", label: "YouTube watch party extension", headingPhrases: ["watch party extension"] },
    ],
    ownedElsewhere: [],
    parentLinks: ["/"],
  },
  {
    path: "/prime-video-watch-party",
    kind: "hub",
    ticket: "ANI-52",
    keywordMapKey: "prime",
    primary: g(2400, "prime video watch party", "watch party prime video"),
    secondary: [
      g(3600, "amazon prime video watch party"),
      g(2400, "amazon watch party"),
      g(1900, "amazon prime watch party", "watch party amazon prime"),
      g(480, "teleparty amazon prime", "teleparty prime video"),
    ],
    questions: [
      { id: "howto", label: "How to watch Prime Video together", headingPhrases: ["how to watch prime video together"] },
      { id: "feature", label: "What happened to Amazon Watch Party", headingPhrases: ["amazon watch party"] },
      { id: "options", label: "Options today", headingPhrases: ["options"] },
      { id: "account", label: "Does everyone need Prime Video", headingPhrases: ["everyone need prime video"] },
      { id: "discord", label: "Prime Video on Discord", headingPhrases: ["discord"] },
    ],
    ownedElsewhere: [{ phrases: ["how to stream prime video on discord"], owner: "/guides/how-to-stream-prime-video-on-discord" }],
    parentLinks: ["/"],
  },
  {
    path: "/discord-watch-party",
    kind: "hub",
    ticket: "ANI-46",
    keywordMapKey: "discord_hub",
    primary: g(1000, "discord watch party", "watch party discord"),
    secondary: [
      g(1900, "how to stream movies on discord"),
      g(1600, "discord watch together", "watch together discord"),
      g(720, "how to watch movies on discord"),
      g(590, "how to watch movies together on discord"),
    ],
    questions: [
      { id: "howto", label: "How to run a Discord watch party", headingPhrases: ["discord watch party"] },
      { id: "activity", label: "Discord Watch Together activity", headingPhrases: ["watch together"] },
      { id: "movies", label: "How to watch movies together on Discord", headingPhrases: ["watch movies together on discord"] },
      { id: "platforms", label: "Setup by platform", headingPhrases: ["setup by platform", "platform"] },
    ],
    ownedElsewhere: [{ phrases: ["how to stream netflix on discord"], owner: "/guides/how-to-screen-share-netflix-on-discord" }],
    parentLinks: ["/"],
  },
  {
    path: "/watch-party-app",
    kind: "directory",
    ticket: "ANI-40",
    keywordMapKey: "directory",
    primary: g(0, "streaming services that work with anidachi", "supported streaming services", "streaming services anidachi supports"),
    secondary: [g(260, "netflix watch party extension")],
    questions: [
      { id: "supported", label: "Supported today", headingPhrases: ["supported"] },
      { id: "soon", label: "Coming soon", headingPhrases: ["coming soon"] },
    ],
    ownedElsewhere: [{ phrases: ["watch party app"], owner: "/" }],
    parentLinks: ["/"],
    exceptions: [
      {
        rule: "intro-primary",
        reason: "The directory is rewritten at the four-adapter launch, with new targets.",
        ref: "ANI-40",
        deferredTo: "adapter launch",
      },
    ],
  },
  {
    path: "/guides/watch-movies-together-online",
    kind: "guide",
    ticket: "ANI-47",
    keywordMapKey: "movies_guide",
    primary: g(9900, "how to watch movies together online"),
    secondary: [g(4400, "how to watch movies with friends online"), g(2400, "website to watch movies together")],
    questions: [
      { id: "ways", label: "The ways to watch together, compared", headingPhrases: ["ways"] },
      { id: "best", label: "Best way for your group", headingPhrases: ["best way"] },
    ],
    ownedElsewhere: [{ phrases: ["watch party app"], owner: "/" }],
    parentLinks: ["/"],
  },
];
