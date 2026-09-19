import type { AnimeEntry } from "@/lib/anime-data";
import { isMovieEntry } from "@/lib/anime-data";
import { pricingWatchPageFaqAnswer } from "@/lib/pricing-copy";

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
      `${anime.title} lands jokes and reaction beats quickly—perfect for a voice channel or watchroom where people talk over quiet scenes. For different schedules, agree on an episode target and discuss after everyone catches up.`
    );
  }

  if (has(gs, "romance", "drama")) {
    paragraphs.push(
      `Relationship beats and emotional swings land harder when you debrief right after the credits. Agree on a safe episode number before discussing confessions or flashbacks. Keep later spoilers in a separate chat.`
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
      `Lower-stakes episodes are ideal for casual hangouts: you can dip in for two installments without losing the emotional through-line, especially if you agree on a shared episode target before each meeting.`
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
    ) || /one-piece|naruto|boruto|hunter-x-hunter|fairy-tail|case-closed|detective-conan|gintama|inuyasha|bleach/i.test(anime.slug);

  if (long) {
    return `With ${episodesDisplay} in play, treat ${anime.title} like a season-long club: set a weekly episode budget (for example one cour block), name a rotating host who posts the watchroom link, and celebrate milestones instead of sprinting to the finale in one weekend unless everyone explicitly opts in.`;
  }

  return `At ${episodesDisplay}, ${anime.title} fits tidy watch-party arcs—double features on Fridays, a single-episode debrief after work, or a two-night binge before spoilers leak online. Adjust on the fly when travel or finals interrupt without guilt; a separate group chat can keep friends in touch between sessions.`;
}

/** 4-signal meta descriptions for programmatic watch URLs (≤160 chars).
 * Signals: group suitability angle, episode/format, availability, action phrase.
 * Near-identical descriptions across 161 pages cause Google to soft-canonicalize;
 * each description must differ meaningfully between any two titles of the same genre.
 */
export function buildWatchPageMetaDescription(anime: AnimeEntry): string {
  const gs = genreSet(anime.genres);
  const movie = isMovieEntry(anime);

  const isLong =
    /\+|1100|1000|\b720\b|\b700\b|seasons|multiple seasons|counting/i.test(anime.episodes) ||
    /one-piece|naruto|boruto|hunter-x-hunter|fairy-tail|case-closed|detective-conan|gintama|inuyasha|bleach/i.test(anime.slug);

  // Extract clean episode count from free-text episodes field (e.g. "87 episodes across 4 seasons" → "87 episodes")
  const epMatch = anime.episodes.match(/(\d+\+?)\s*episodes?/i);
  const epSignal = movie ? null : epMatch ? `${epMatch[1]} episodes` : null;

  // Genre suffix (first 2 genres, lowercase, e.g. "action · dark fantasy")
  const genreSuffix =
    anime.genres.length > 0
      ? anime.genres.slice(0, 2).map((g) => g.toLowerCase()).join(" · ")
      : "";

  let desc: string;

  if (movie) {
    // Movie: "Watch {title} as a group movie night — set up an AniDachi watchroom in seconds, no spoiler risk, {genres}, on Crunchyroll."
    const genrePart = genreSuffix ? `, ${genreSuffix}` : "";
    desc = `Watch ${anime.title} as a group movie night — set up an AniDachi watchroom in seconds, no spoiler risk${genrePart}, on Crunchyroll.`;
  } else if (isLong) {
    // Long-run: "Host a spoiler-safe {title} marathon with friends — {ep_signal}, {genres}, AniDachi watchrooms on Crunchyroll."
    const epPart = epSignal ? ` — ${epSignal}` : "";
    const genrePart = genreSuffix ? `, ${genreSuffix}` : "";
    desc = `Host a spoiler-safe ${anime.title} marathon with friends${epPart}${genrePart}, AniDachi watchrooms on Crunchyroll.`;
  } else if (has(gs, "sports")) {
    // Sports: "Run a {title} watch club with friends — {ep_signal}, {genres}, live sync via AniDachi on Crunchyroll."
    const epPart = epSignal ? ` — ${epSignal}` : "";
    const genrePart = genreSuffix ? `, ${genreSuffix}` : "";
    desc = `Run a ${anime.title} watch club with friends${epPart}${genrePart}, live sync via AniDachi on Crunchyroll.`;
  } else if (has(gs, "romance", "drama")) {
    // Romance/drama: "Start a {title} watch party with friends — {ep_signal}, {genres}, live sync via AniDachi on Crunchyroll."
    const epPart = epSignal ? ` — ${epSignal}` : "";
    const genrePart = genreSuffix ? `, ${genreSuffix}` : "";
    desc = `Start a ${anime.title} watch party with friends${epPart}${genrePart}, live sync via AniDachi on Crunchyroll.`;
  } else {
    // Default: "Host a {title} watch party with friends — {ep_signal}, {genres}, AniDachi watchrooms on Crunchyroll."
    const epPart = epSignal ? ` — ${epSignal}` : "";
    const genrePart = genreSuffix ? `, ${genreSuffix}` : "";
    desc = `Host a ${anime.title} watch party with friends${epPart}${genrePart}, AniDachi watchrooms on Crunchyroll.`;
  }

  const t = desc.trim();
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
      text: "Open /extension, download the official AniDachi zip, unzip it, then choose Load unpacked in Chrome Developer mode on each device your watch group uses.",
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
      name: "Watch live together",
      text: `Watch ${anime.title} together in the live room, with synced playback, chat, and reactions.`,
    },
    {
      name: "Track episodes and spoiler boundaries",
      text: "Plus and Pro save personal history. Agree with friends on a safe episode boundary before the next session; personal progress is not a shared group record.",
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
    /one-piece|naruto|boruto|hunter-x-hunter|fairy-tail|case-closed|detective-conan|gintama|inuyasha|bleach/i.test(anime.slug);
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

  // Extract clean episode count for use in FAQ answers
  const epMatch = anime.episodes.match(/(\d+\+?)\s*episodes?/i);
  const epSignal = epClass !== "movie" && epMatch ? `${epMatch[1]} episodes` : null;

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
      answer: `With ${episodesDisplay}, treat ${anime.title} like a long-running club: set a weekly episode budget (e.g. one cour block per month), name a rotating host who posts the watchroom link, and celebrate major arc finales as milestones. Let anyone who misses a session catch up independently before the next meeting.`,
    };
  } else {
    slotA = {
      question: `How many episodes of ${anime.title} should we watch per session?`,
      answer: `Two to three episodes per session works well for ${anime.title} — enough for a satisfying story beat without a four-hour commitment. A four-episode double feature on weekends still finishes in under two hours. Let anyone who misses a session catch up independently before the next meeting.`,
    };
  }

  // Slot B: async/schedule — genre-aware
  let slotB: { question: string; answer: string };
  if (has(gs, "sports")) {
    slotB = {
      question: `What is the best way to watch ${anime.title} match episodes as a group?`,
      answer: `Match-block episodes make natural session boundaries for ${anime.title}. Schedule live watch nights around tournament arcs and allow independent catch-up between meetings.`,
    };
  } else if (has(gs, "mystery", "psychological", "thriller")) {
    slotB = {
      question: `Can we share theories about ${anime.title} without accidentally spoiling each other?`,
      answer: `Agree on a safe episode boundary before each live session and keep later theories in a separate chat. AniDachi does not automatically hide spoilers or create episode threads.`,
    };
  } else if (has(gs, "romance", "drama")) {
    slotB = {
      question: `How do we manage emotional spoilers and shipping debates in ${anime.title}?`,
      answer: `Agree on a safe episode number in your group before discussing later scenes. Keep shipping debates with future spoilers in a separate chat outside the live room.`,
    };
  } else {
    slotB = {
      question: `Can I watch ${anime.title} with friends asynchronously?`,
      answer: `Not in AniDachi yet. Rooms currently sync ${anime.title} live. Async catch-up with replayed reactions is planned; for now, watch independently and discuss later if schedules do not overlap.`,
    };
  }

  // Slot C: spoiler management — episode-count-aware
  let slotC: { question: string; answer: string };
  if (epClass === "movie") {
    slotC = {
      question: `How do we avoid ${anime.title} spoilers before our group movie night?`,
      answer: `Arrange the movie night in your group chat and ask everyone to avoid reviews until after you watch together. Even a runtime or ending-tone spoiler can change expectations for a first-time group watch.`,
    };
  } else if (epClass === "long") {
    slotC = {
      question: `How do we track who has seen which arc in ${anime.title}?`,
      answer: `Agree on the last arc everyone has finished in your separate group chat. AniDachi personal history tracks each viewer separately on Plus or Pro; it does not create a shared group progress record.`,
    };
  } else {
    slotC = {
      question: `How do we avoid spoilers when someone falls behind on ${anime.title}?`,
      answer: `Agree on the latest safe episode number before meeting. Keep later plot discussions in a separate chat until everyone catches up; AniDachi does not automatically hide spoilers.`,
    };
  }

  return [
    // Watch Party Fit — title-specific, targets the "Is {title} good to watch with friends?" PAA box.
    // Must come first so it appears near the top of the page and anchors the FAQPage JSON-LD.
    {
      question: `Is ${anime.title} good to watch with a group?`,
      answer: (() => {
        if (epClass === "movie") {
          return `Yes — ${anime.title} is ideal for a group movie night. As a standalone film, everyone finishes together with no multi-session scheduling needed. The emotional payoff lands harder when you can react out loud and debrief right after the credits.`;
        }
        if (epClass === "long") {
          return `Yes, with the right structure. ${anime.title}${epSignal ? ` has ${epSignal}` : " is a long-running series"}, so a weekly club format keeps momentum without burnout. Let members who miss a week catch up independently before the next meeting.`;
        }
        if (has(gs, "sports")) {
          return `Yes — ${anime.title} is built for group watching. Tournament arcs and match-day tension are twice as exciting when the whole group reacts to the same whistle moment. Episode blocks align naturally with game or training sessions.`;
        }
        if (has(gs, "mystery", "psychological", "thriller")) {
          return `Yes — theory-crafting is half the fun of ${anime.title}. The psychological twists and mystery payoffs give your group something to debate after every episode, so agree on a safe episode boundary before discussing theories.`;
        }
        if (has(gs, "romance", "drama")) {
          return `Yes — ${anime.title} works especially well for smaller groups or date nights. Relationship beats and emotional payoffs hit harder with someone to debrief with right after the credits. Keep later-episode discussions in a separate chat so first-timers can avoid them.`;
        }
        if (has(gs, "comedy", "parody")) {
          return `Yes — ${anime.title} is best with a live audience. Comedy timing and reaction faces land much harder when someone else is laughing at the same moment. For different schedules, arrange independent catch-up before the next meeting.`;
        }
        return `Yes — ${anime.title} works well for group watching. Strong episode hooks and discussion-worthy moments reward synchronized viewing where everyone reacts together. If schedules differ, catch up independently and meet for a later live session.`;
      })(),
    },
    slotA,
    slotB,
    {
      question: `Does ${anime.title} have a watch party feature on Crunchyroll?`,
      answer: `Crunchyroll does not offer a first-party "watch with friends" room. You can still watch together by installing AniDachi, playing ${anime.title} in your own Crunchyroll tab, and joining the same AniDachi watchroom for synced playback and group chat — live together.`,
    },
    {
      question: `Do all my friends need Crunchyroll to watch ${anime.title} together?`,
      answer: `Yes — each person needs their own active Crunchyroll subscription to stream the video. AniDachi adds the watchroom, chat, and optional personal history on top; it does not replace Crunchyroll's catalog or access control.`,
    },
    {
      question: `Is AniDachi free for ${anime.title} watch parties?`,
      answer: pricingWatchPageFaqAnswer(anime.title),
    },
    {
      question: `Can we host a ${anime.title} watch night if we live in different countries?`,
      answer: `You can use the same watchroom flow as long as each person can stream ${anime.title} legally in their region. Rights and episode availability may differ by territory — if someone is geo-blocked on a specific arc, pause the group plan until everyone can access the same episode legally, then resume with clear episode labels in chat.`,
    },
    slotC,
  ];
}
