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
  // ── Teleparty guides (ANI-68 "teleparty" section; convert best). Volumes: Keyword Planner exact, worldwide, 25 Nov 2026.
  {
    path: "/guides/is-teleparty-free",
    kind: "guide",
    ticket: "ANI-68",
    keywordMapKey: "teleparty",
    primary: g(1600, "is teleparty free"),
    secondary: [
      // /guides/is-teleparty-safe redirects here (308), so this page owns the safety search too.
      g(1900, "is teleparty safe"),
      g(720, "teleparty premium"),
      g(320, "is teleparty legit"),
      g(110, "does teleparty cost money"),
    ],
    questions: [
      { id: "free", label: "Is Teleparty free", headingPhrases: ["is teleparty free", "free"] },
      { id: "safe", label: "Is Teleparty safe", headingPhrases: ["is teleparty safe", "safe"] },
      { id: "premium", label: "What Teleparty Premium costs", headingPhrases: ["teleparty premium", "premium"] },
    ],
    ownedElsewhere: [{ phrases: ["teleparty alternative", "teleparty alternatives"], owner: "/guides/best-teleparty-alternatives-for-anime" }],
    parentLinks: ["/compare"],
  },
  {
    path: "/guides/best-teleparty-alternatives-for-anime",
    kind: "guide",
    ticket: "ANI-68",
    keywordMapKey: "teleparty",
    primary: g(880, "teleparty alternative", "teleparty alternatives"),
    secondary: [g(320, "apps like teleparty"), g(40, "sites like teleparty")],
    questions: [{ id: "best", label: "Best alternatives, ranked or compared", headingPhrases: ["best", "compared", "ranked"] }],
    ownedElsewhere: [
      { phrases: ["best watch party apps"], owner: "/compare" },
      { phrases: ["is teleparty free"], owner: "/guides/is-teleparty-free" },
    ],
    parentLinks: ["/compare"],
  },
  {
    path: "/guides/watch2gether-alternatives-for-anime",
    kind: "guide",
    ticket: "ANI-68",
    keywordMapKey: "teleparty",
    primary: g(480, "watch2gether alternative", "watch2gether alternatives"),
    secondary: [g(110, "watch2gether anime"), g(40, "sites like watch2gether")],
    questions: [{ id: "best", label: "Best alternatives, ranked or compared", headingPhrases: ["best", "compared", "ranked"] }],
    ownedElsewhere: [{ phrases: ["best watch party apps"], owner: "/compare" }],
    parentLinks: ["/compare"],
  },
  {
    path: "/guides/teleparty-not-working-youtube",
    kind: "guide",
    ticket: "ANI-68",
    keywordMapKey: "teleparty",
    primary: g(260, "teleparty not working"),
    secondary: [g(480, "teleparty youtube"), g(110, "why is teleparty not working"), g(50, "teleparty not syncing")],
    questions: [
      { id: "fix", label: "Fixes to try", headingPhrases: ["fix", "fixes"] },
      { id: "youtube", label: "Teleparty on YouTube", headingPhrases: ["youtube"] },
    ],
    ownedElsewhere: [{ phrases: ["watch youtube together", "youtube watch party"], owner: "/watch-youtube-together" }],
    parentLinks: ["/watch-youtube-together"],
  },
  {
    path: "/guides/best-anime-to-watch-with-friends",
    kind: "guide",
    ticket: "ANI-68",
    primary: g(390, "anime to watch with friends", "animes to watch with friends"),
    secondary: [g(170, "best anime to watch with friends"), g(170, "good anime to watch with friends")],
    questions: [],
    ownedElsewhere: [
      { phrases: ["watch anime together"], owner: "/watch-anime-together" },
      { phrases: ["how to watch anime with friends"], owner: "/watch-anime-together" },
    ],
    parentLinks: ["/watch-anime-together"],
  },

  // ── Discord guides (ANI-68 "discord_guides" section). Volumes: Keyword Planner exact, worldwide, 25 Nov 2026.
  {
    path: "/guides/how-to-screen-share-netflix-on-discord",
    kind: "guide",
    ticket: "ANI-68",
    keywordMapKey: "discord_guides",
    primary: g(14800, "how to stream netflix on discord", "stream netflix on discord"),
    secondary: [
      g(3600, "how to screen share netflix on discord", "how to screenshare netflix on discord"),
      g(2400, "can you stream netflix on discord"),
      g(2400, "how to stream netflix on discord without black screen"),
      g(1600, "how to share netflix on discord", "how to share screen netflix on discord"),
      g(260, "netflix discord black screen"),
    ],
    questions: [
      { id: "can", label: "Can you stream Netflix on Discord", headingPhrases: ["can you stream netflix on discord", "can you"] },
      { id: "black", label: "Why the screen is black, and the fix", headingPhrases: ["black screen"] },
      { id: "steps", label: "Step by step", headingPhrases: ["how to stream netflix on discord", "step"] },
    ],
    ownedElsewhere: [{ phrases: ["netflix watch party"], owner: "/netflix-watch-party" }],
    parentLinks: ["/discord-watch-party", "/netflix-watch-party"],
  },
  {
    path: "/guides/can-you-screen-share-crunchyroll-on-discord",
    kind: "guide",
    ticket: "ANI-68",
    keywordMapKey: "discord_guides",
    primary: g(4400, "how to stream crunchyroll on discord", "stream crunchyroll on discord"),
    secondary: [
      g(1300, "can you stream crunchyroll on discord", "can i stream crunchyroll on discord"),
      g(1300, "how to screen share crunchyroll on discord", "how to screenshare crunchyroll on discord"),
      g(1000, "how to stream crunchyroll on discord without black screen"),
      g(210, "crunchyroll black screen discord"),
    ],
    questions: [
      { id: "can", label: "Can you screen share Crunchyroll on Discord", headingPhrases: ["can you screen share crunchyroll", "can you"] },
      { id: "black", label: "Why the screen is black, and the fix", headingPhrases: ["black screen"] },
    ],
    ownedElsewhere: [
      { phrases: ["crunchyroll watch party"], owner: "/watch-crunchyroll-together" },
      { phrases: ["how to watch crunchyroll on discord"], owner: "/guides/crunchyroll-watch-party-with-discord" },
      { phrases: ["how to stream anime on discord"], owner: "/guides/how-to-watch-anime-with-friends-on-discord" },
    ],
    parentLinks: ["/discord-watch-party", "/watch-crunchyroll-together"],
  },
  {
    path: "/guides/crunchyroll-watch-party-with-discord",
    kind: "guide",
    ticket: "ANI-68",
    keywordMapKey: "discord_guides",
    primary: g(320, "how to watch crunchyroll on discord"),
    secondary: [g(880, "crunchyroll discord")],
    questions: [{ id: "voice", label: "Voice on Discord, sync with AniDachi", headingPhrases: ["voice", "sync"] }],
    ownedElsewhere: [
      { phrases: ["how to stream crunchyroll on discord"], owner: "/guides/can-you-screen-share-crunchyroll-on-discord" },
      { phrases: ["crunchyroll watch party"], owner: "/watch-crunchyroll-together" },
    ],
    parentLinks: ["/discord-watch-party", "/watch-crunchyroll-together"],
  },
  {
    path: "/guides/can-you-screen-share-youtube-on-discord",
    kind: "guide",
    ticket: "ANI-68",
    keywordMapKey: "discord_guides",
    primary: g(480, "how to stream youtube on discord"),
    secondary: [g(210, "can you stream youtube on discord"), g(90, "how to watch youtube on discord")],
    questions: [{ id: "watch-together", label: "Discord Watch Together for YouTube", headingPhrases: ["watch together"] }],
    ownedElsewhere: [{ phrases: ["watch youtube together", "youtube watch party"], owner: "/watch-youtube-together" }],
    parentLinks: ["/discord-watch-party", "/watch-youtube-together"],
  },
  {
    path: "/guides/how-to-stream-prime-video-on-discord",
    kind: "guide",
    ticket: "ANI-68",
    keywordMapKey: "discord_guides",
    primary: g(1600, "how to stream prime video on discord"),
    secondary: [
      g(1300, "how to stream amazon prime on discord"),
      g(210, "how to screenshare prime video on discord"),
      g(50, "prime video discord black screen"),
    ],
    questions: [{ id: "black", label: "Why the screen is black, and the fix", headingPhrases: ["black screen"] }],
    ownedElsewhere: [{ phrases: ["prime video watch party"], owner: "/prime-video-watch-party" }],
    parentLinks: ["/discord-watch-party", "/prime-video-watch-party"],
  },
  {
    path: "/guides/discord-screen-share-black-screen",
    kind: "guide",
    ticket: "ANI-68",
    keywordMapKey: "discord_guides",
    primary: g(1300, "discord screen share black screen"),
    secondary: [
      g(1600, "discord stream black screen"),
      g(590, "discord black screen when streaming"),
      g(110, "why is my discord stream black"),
    ],
    questions: [
      { id: "why", label: "Why it happens", headingPhrases: ["why"] },
      { id: "fix", label: "Fixes to try", headingPhrases: ["fix", "check"] },
    ],
    ownedElsewhere: [
      { phrases: ["how to stream netflix on discord"], owner: "/guides/how-to-screen-share-netflix-on-discord" },
      { phrases: ["how to stream crunchyroll on discord"], owner: "/guides/can-you-screen-share-crunchyroll-on-discord" },
    ],
    parentLinks: ["/discord-watch-party"],
  },

  // ── Compare pages. Volumes: Keyword Planner exact, worldwide, 25 Nov 2026.
  {
    path: "/compare",
    kind: "guide",
    ticket: "ANI-44",
    keywordMapKey: "teleparty",
    primary: g(260, "best watch party apps"),
    secondary: [g(480, "watch party sites"), g(90, "best watch party websites")],
    questions: [{ id: "table", label: "Apps compared side by side", headingPhrases: ["compared", "comparison"] }],
    ownedElsewhere: [],
    parentLinks: ["/"],
  },
  {
    path: "/compare/anidachi-vs-hyperbeam",
    kind: "guide",
    ticket: "ANI-44",
    primary: g(480, "hyperbeam alternative", "hyperbeam alternatives"),
    secondary: [g(110, "sites like hyperbeam")],
    questions: [],
    ownedElsewhere: [{ phrases: ["best watch party apps"], owner: "/compare" }],
    parentLinks: ["/compare"],
  },
  {
    path: "/compare/anidachi-vs-kosmi",
    kind: "guide",
    ticket: "ANI-44",
    primary: g(110, "kosmi alternative", "kosmi alternatives"),
    secondary: [g(40, "sites like kosmi")],
    questions: [],
    ownedElsewhere: [{ phrases: ["best watch party apps"], owner: "/compare" }],
    parentLinks: ["/compare"],
  },
  {
    path: "/compare/anidachi-vs-metastream",
    kind: "guide",
    ticket: "ANI-44",
    primary: g(210, "metastream alternative", "metastream alternatives"),
    secondary: [],
    questions: [],
    ownedElsewhere: [{ phrases: ["best watch party apps"], owner: "/compare" }],
    parentLinks: ["/compare"],
  },
  {
    path: "/guides/rave-alternatives-for-youtube",
    kind: "guide",
    ticket: "ANI-44",
    keywordMapKey: "teleparty",
    primary: g(480, "rave alternative", "rave alternatives"),
    secondary: [g(590, "apps like rave")],
    questions: [],
    ownedElsewhere: [{ phrases: ["best watch party apps"], owner: "/compare" }],
    parentLinks: ["/compare"],
  },
  {
    path: "/guides/kast-alternatives-for-youtube",
    kind: "guide",
    ticket: "ANI-44",
    primary: g(70, "kast alternative", "kast alternatives"),
    secondary: [g(10, "apps like kast")],
    questions: [],
    ownedElsewhere: [{ phrases: ["best watch party apps"], owner: "/compare" }],
    parentLinks: ["/compare"],
  },
];
