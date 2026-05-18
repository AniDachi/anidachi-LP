import type { AnimeEntry } from "@/lib/anime-data";
import { isMovieEntry } from "@/lib/anime-data";

function genreSet(genres: string[]): Set<string> {
  return new Set(genres.map((g) => g.toLowerCase()));
}

function has(gs: Set<string>, ...needles: string[]): boolean {
  return needles.some((n) => gs.has(n.toLowerCase()));
}

/** Extra "why watch together" copy keyed lightly off genres — still truthful and generic enough for SEO scale. */
export function extraWhyWatchParagraphs(anime: AnimeEntry): string[] {
  const gs = genreSet(anime.genres);
  const paragraphs: string[] = [];

  if (has(gs, "comedy", "parody")) {
    paragraphs.push(
      `${anime.title} lands jokes and reaction beats quickly—perfect for a voice channel or watchroom where people talk over quiet scenes. Async mode helps when half the group laughs through episodes at lunch and the other half binge at night.`
    );
  }

  if (has(gs, "romance", "drama")) {
    paragraphs.push(
      `Relationship beats and emotional swings land harder when you debrief right after the credits. Use episode-scoped chat so nobody reads confessions or flashbacks before they have pressed play.`
    );
  }

  if (
    has(gs, "action") ||
    has(gs, "adventure") ||
    has(gs, "martial arts") ||
    has(gs, "supernatural")
  ) {
    paragraphs.push(
      `Fight choreography and cliffhanger cadence reward synchronized hype—pause for bathroom breaks, then count down together so nobody spoils the transformation scene three seconds early.`
    );
  }

  if (has(gs, "mystery", "psychological", "thriller")) {
    paragraphs.push(
      `Theory-crafting works best with clear episode checkpoints: agree where late viewers must mute threads until they hit the same ending card. That keeps wild guesses fun instead of careless spoilers.`
    );
  }

  if (has(gs, "sports")) {
    paragraphs.push(
      `Match-sized episodes make natural weekly rituals—treat each game or tournament block like a season stretch where everyone rallies for the same whistle moments.`
    );
  }

  if (has(gs, "slice of life", "school")) {
    paragraphs.push(
      `Lower-stakes episodes are ideal for casual hangouts: you can dip in for two installments without losing the emotional through-line, especially if your watchroom tracks who cleared which arc.`
    );
  }

  // Fallback when nothing matched — still adds uniqueness vs thin templates.
  if (paragraphs.length === 0) {
    paragraphs.push(
      `${anime.title} works well in a shared watchroom because you can match the show's rhythm to your group's real schedules—tight bursts when everyone is free, slower pacing when life gets loud—without losing the thread of which episode you are on.`
    );
  }

  return paragraphs.slice(0, 3);
}

/** Genre-aware discussion bullets (deduped). */
export function genreDiscussionTips(genres: string[]): string[] {
  const gs = genreSet(genres);
  const tips: string[] = [];

  if (has(gs, "comedy", "parody")) {
    tips.push(
      `Timestamp your favorite gag or facial expression so friends can replay the same three seconds without spoiling the next sketch.`
    );
  }
  if (has(gs, "romance", "drama")) {
    tips.push(
      `Agree on “shipping rules” for chat—fun predictions welcome, but mark episode numbers when referencing future-looking scenes.`
    );
  }
  if (has(gs, "action", "adventure", "supernatural")) {
    tips.push(
      `After big battles, take sixty seconds for “what just broke?” reactions before anyone jumps into wiki lore—keeps newcomers included.`
    );
  }
  if (has(gs, "mystery", "psychological", "thriller")) {
    tips.push(
      `Run a quick “evidence vs vibe” poll after cliffhangers so theories stay playful instead of leak-adjacent.`
    );
  }
  if (has(gs, "horror")) {
    tips.push(
      `Use spoiler tags for jump-scare timestamps so anxious viewers can mute sound for specific seconds.`
    );
  }

  return tips.slice(0, 4);
}

/** Long-run vs short-run pacing note using episode display string. */
export function pacingLeadParagraph(
  anime: AnimeEntry,
  episodesDisplay: string
): string {
  const epBlob = `${episodesDisplay} ${anime.episodes}`;
  const long =
    /\+|1100|1000|\b720\b|\b700\b|seasons|multiple seasons|counting/i.test(
      epBlob
    ) || /one-piece|naruto|hunter-x-hunter|fairy-tail|case-closed|detective-conan|gintama|inuyasha|bleach/i.test(anime.slug);

  if (long) {
    return `With ${episodesDisplay} in play, treat ${anime.title} like a season-long club: set a weekly episode budget (for example one cour block), name a rotating host who posts the watchroom link, and celebrate milestones instead of sprinting to the finale in one weekend unless everyone explicitly opts in.`;
  }

  return `At ${episodesDisplay}, ${anime.title} fits tidy watch-party arcs—double features on Fridays, a single-episode debrief after work, or a two-night binge before spoilers leak online. Adjust on the fly when travel or finals interrupt without guilt; async chat carries the social thread.`;
}

/** Unique-enough meta descriptions for each programmatic watch URL (~≤155 chars for SERP snippets). */
export function buildWatchPageMetaDescription(anime: AnimeEntry): string {
  const genreSuffix =
    anime.genres.length > 0
      ? ` ${anime.genres.slice(0, 2).join(" · ")}.`
      : "";
  const s = `Watch ${anime.title} with friends on Crunchyroll: AniDachi watchrooms for sync, chat, async catch-up, and spoiler-aware group pacing.${genreSuffix}`;
  const t = s.trim();
  if (t.length <= 160) return t;
  return `${t.slice(0, 157).trim()}…`;
}

/** HowTo JSON-LD steps aligned with on-page ordered list (programmatic watch pages). */
export function buildWatchHowToSteps(anime: AnimeEntry): {
  name: string;
  text: string;
}[] {
  return [
    {
      name: "Install AniDachi",
      text: "Add the AniDachi Chrome extension from the AniDachi site or Chrome Web Store on each device your watch group uses.",
    },
    {
      name: "Open the anime on Crunchyroll",
      text: `While signed into Crunchyroll, start ${anime.title} in your browser and run AniDachi's anime detection so metadata matches this series.`,
    },
    {
      name: "Create and share a watchroom",
      text: `Create an AniDachi watchroom for ${anime.title}, then share the invite link in Discord, group chat, or email.`,
    },
    {
      name: "Choose live sync or async catch-up",
      text: `Press play together for synced viewing, or watch on staggered schedules while reactions stay tied to each episode for ${anime.title}.`,
    },
    {
      name: "Track episodes and spoiler boundaries",
      text: "Mark what you have watched and scan friends' notes before the next episode so late viewers stay spoiler-safe.",
    },
  ];
}

/**
 * Curated hub links for ItemList JSON-LD.
 * Accepts optional anime genres to append relevant genre-hub links (up to 2).
 */
export function watchPageResourceItemList(
  genres: string[] = []
): { name: string; url: string; position: number }[] {
  const base = [
    { name: "Watch Anime Together — complete guide", url: "/watch-anime-together", position: 1 },
    { name: "Watch Crunchyroll Together — pillar hub", url: "/watch-crunchyroll-together", position: 2 },
    { name: "Anime watch party toolkit", url: "/anime-watch-party-toolkit", position: 3 },
    { name: "How to watch Crunchyroll with friends", url: "/guides/how-to-watch-crunchyroll-with-friends", position: 4 },
    { name: "What is a watchroom? (glossary)", url: "/glossary/watchroom", position: 5 },
    { name: "Asynchronous watching (glossary)", url: "/glossary/asynchronous-watching", position: 6 },
    { name: "How to watch anime without spoilers", url: "/guides/how-to-watch-anime-without-spoilers", position: 7 },
    { name: "First anime watch party checklist", url: "/guides/first-anime-watch-party-checklist", position: 8 },
  ];

  const gs = genreSet(genres);
  const genreHubs: { name: string; url: string }[] = [];
  if (has(gs, "action")) genreHubs.push({ name: "Watch action anime with friends — genre hub", url: "/watch-action-anime-with-friends" });
  if (has(gs, "romance")) genreHubs.push({ name: "Watch romance anime with friends — genre hub", url: "/watch-romance-anime-with-friends" });
  if (has(gs, "comedy")) genreHubs.push({ name: "Watch comedy anime with friends — genre hub", url: "/watch-comedy-anime-with-friends" });
  if (has(gs, "sports")) genreHubs.push({ name: "Watch sports anime with friends — genre hub", url: "/watch-sports-anime-with-friends" });
  if (has(gs, "mystery", "psychological")) genreHubs.push({ name: "Watch mystery anime with friends — genre hub", url: "/watch-mystery-anime-with-friends" });

  const extra = genreHubs.slice(0, 2).map((h, i) => ({ ...h, position: base.length + i + 1 }));
  return [...base, ...extra];
}

type EpisodeClass = "movie" | "long" | "standard";

function classifyEpisodes(anime: AnimeEntry, episodesDisplay: string): EpisodeClass {
  if (isMovieEntry(anime)) return "movie";
  const blob = `${episodesDisplay} ${anime.episodes}`;
  const isLong =
    /\+|1100|1000|\b720\b|\b700\b|seasons|multiple seasons|counting/i.test(blob) ||
    /one-piece|naruto|hunter-x-hunter|fairy-tail|case-closed|detective-conan|gintama|inuyasha|bleach/i.test(anime.slug);
  return isLong ? "long" : "standard";
}

/**
 * Builds per-anime differentiated FAQ questions.
 * 4 universal questions + 3 slots that vary by mediaType, episode count, and genre.
 * Reduces near-duplicate content risk across the 139 programmatic watch pages.
 */
export function buildWatchPageFaq(
  anime: AnimeEntry,
  episodesDisplay: string
): { question: string; answer: string }[] {
  const gs = genreSet(anime.genres);
  const epClass = classifyEpisodes(anime, episodesDisplay);

  // Slot A: episode format / opening question
  let slotA: { question: string; answer: string };
  if (epClass === "movie") {
    slotA = {
      question: `Can we watch ${anime.title} together in one sitting?`,
      answer: `Yes — ${anime.title} is a feature-length film, making it perfect for a single group movie night. Install AniDachi, open the film on Crunchyroll, create a watchroom, and share the invite link before you press play. No need to coordinate a multi-session schedule.`,
    };
  } else if (epClass === "long") {
    slotA = {
      question: `How do we pace watching ${anime.title} as a group without it taking forever?`,
      answer: `With ${episodesDisplay}, treat ${anime.title} like a long-running club: set a weekly episode budget (e.g. one cour block per month), name a rotating host who posts the watchroom link, and celebrate major arc finales as milestones. AniDachi's async mode means nobody needs to sprint — late viewers catch up behind spoiler-safe episode markers and rejoin the group for the next arc.`,
    };
  } else {
    slotA = {
      question: `How many episodes of ${anime.title} should we watch per session?`,
      answer: `Two to three episodes per session works well for ${anime.title} — enough for a satisfying story beat without a four-hour commitment. A four-episode double feature on weekends still finishes in under two hours. AniDachi's async mode means stragglers can catch up before the next session without the whole group waiting.`,
    };
  }

  // Slot B: async/schedule — genre-aware
  let slotB: { question: string; answer: string };
  if (has(gs, "sports")) {
    slotB = {
      question: `What is the best way to watch ${anime.title} match episodes as a group?`,
      answer: `Match-block episodes make natural session boundaries for ${anime.title}. Schedule watch nights around tournament arcs, pin each team's bracket in the watchroom, and use AniDachi's async mode when someone misses a round — they can catch up before the next bracket and rejoin without spoilers.`,
    };
  } else if (has(gs, "mystery", "psychological", "thriller")) {
    slotB = {
      question: `Can we share theories about ${anime.title} without accidentally spoiling each other?`,
      answer: `Yes — AniDachi's episode-scoped chat keeps theory threads tied to the episode where the clue appeared. Pin a "free speculation" thread for wild guesses and a "confirmed facts" thread for what the show has actually revealed, so newcomers can read one without stumbling on the other.`,
    };
  } else if (has(gs, "romance", "drama")) {
    slotB = {
      question: `How do we manage emotional spoilers and shipping debates in ${anime.title}?`,
      answer: `Set a simple rule in your AniDachi watchroom: episode-number-tag any message that references a scene ("Ep 8 reaction:…") so late viewers know exactly when to mute a thread. Shipping debate channels work best as a pinned space separate from the main episode feed.`,
    };
  } else {
    slotB = {
      question: `Can I watch ${anime.title} with friends asynchronously?`,
      answer: `Yes. AniDachi watchrooms for ${anime.title} work whether everyone is online at the same time or on completely different schedules. Mark episodes as watched, leave reactions, and read friends' notes when you catch up — no shared calendar block required.`,
    };
  }

  // Slot C: spoiler management — episode-count-aware
  let slotC: { question: string; answer: string };
  if (epClass === "movie") {
    slotC = {
      question: `How do we avoid ${anime.title} spoilers before our group movie night?`,
      answer: `Set your watchroom to "movie night pending" and ask everyone to mute reactions and stay off review aggregators until after the credits roll together. Even a runtime or ending-tone spoiler can change expectations for a first-time group watch.`,
    };
  } else if (epClass === "long") {
    slotC = {
      question: `How do we track who has seen which arc in ${anime.title}?`,
      answer: `Pin a shared progress note in your AniDachi watchroom showing the last "safe" arc everyone has cleared. Name chat threads by arc title rather than episode number to make it easy for members re-joining after a break to find where they left off without reading ahead.`,
    };
  } else {
    slotC = {
      question: `How do we avoid spoilers when someone falls behind on ${anime.title}?`,
      answer: `Rename threads or room notes with the latest safe episode number, pin "no spoilers past Ep X" at the top, and encourage screenshot reactions instead of plot summaries until the slowest viewer catches up.`,
    };
  }

  return [
    slotA,
    slotB,
    {
      question: `Does ${anime.title} have a watch party feature on Crunchyroll?`,
      answer: `Crunchyroll does not offer a first-party "watch with friends" room. You can still watch together by installing AniDachi, playing ${anime.title} in your own Crunchyroll tab, and joining the same AniDachi watchroom for synced playback and group chat — live or async.`,
    },
    {
      question: `Do all my friends need Crunchyroll to watch ${anime.title} together?`,
      answer: `Yes — each person needs their own active Crunchyroll subscription to stream the video. AniDachi adds the watchroom, chat, and progress sync on top; it does not replace Crunchyroll's catalog or access control.`,
    },
    {
      question: `Is AniDachi free for ${anime.title} watch parties?`,
      answer: `AniDachi is a paid Chrome extension during early access — pricing and checkout are on the AniDachi homepage. You still need individual Crunchyroll access for ${anime.title}; AniDachi provides the watchroom, sync, and chat layer on top of each person's stream.`,
    },
    {
      question: `Can we host a ${anime.title} watch night if we live in different countries?`,
      answer: `You can use the same watchroom flow as long as each person can stream ${anime.title} legally in their region. Rights and episode availability may differ by territory — if someone is geo-blocked on a specific arc, pause the group plan until everyone can access the same episode legally, then resume with clear episode labels in chat.`,
    },
    slotC,
  ];
}
