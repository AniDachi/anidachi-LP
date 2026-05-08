import type { AnimeEntry } from "@/lib/anime-data";

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
 * Curated hub links for ItemList JSON-LD — same list is rendered in the page body
 * (pillar → glossary → guides cluster per SEO agent internal-linking rules).
 */
export function watchPageResourceItemList(): {
  name: string;
  url: string;
  position: number;
}[] {
  return [
    {
      name: "Watch Anime Together — complete guide",
      url: "/watch-anime-together",
      position: 1,
    },
    {
      name: "Watch Crunchyroll Together — pillar hub",
      url: "/watch-crunchyroll-together",
      position: 2,
    },
    {
      name: "Anime watch party toolkit",
      url: "/anime-watch-party-toolkit",
      position: 3,
    },
    {
      name: "How to watch Crunchyroll with friends",
      url: "/guides/how-to-watch-crunchyroll-with-friends",
      position: 4,
    },
    {
      name: "What is a watchroom? (glossary)",
      url: "/glossary/watchroom",
      position: 5,
    },
    {
      name: "Asynchronous watching (glossary)",
      url: "/glossary/asynchronous-watching",
      position: 6,
    },
    {
      name: "How to watch anime without spoilers",
      url: "/guides/how-to-watch-anime-without-spoilers",
      position: 7,
    },
    {
      name: "First anime watch party checklist",
      url: "/guides/first-anime-watch-party-checklist",
      position: 8,
    },
  ];
}
