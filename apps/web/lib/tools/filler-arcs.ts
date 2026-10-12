export type FillerKind = "filler" | "mixed";

export type FillerArc = {
  name: string;
  start: number;
  end: number;
  kind: FillerKind;
  note?: string;
};

export type FillerSeries = {
  id: "one-piece" | "naruto" | "naruto-shippuden" | "bleach" | "black-clover";
  title: string;
  totalEpisodes: number;
  minutesPerEpisode: number;
  scope: string;
  arcs: FillerArc[];
};

export function arcLength(arc: FillerArc): number {
  return arc.end - arc.start + 1;
}

export function episodesOfKind(arcs: FillerArc[], kind: FillerKind): number {
  return arcs.filter((arc) => arc.kind === kind).reduce((sum, arc) => sum + arcLength(arc), 0);
}

export type EpisodeRange = { start: number; end: number };

export function rangeLength(range: EpisodeRange): number {
  return range.end - range.start + 1;
}

export function formatRange(range: EpisodeRange): string {
  return range.start === range.end ? `${range.start}` : `${range.start}–${range.end}`;
}

/** Filler arcs merged where they touch, e.g. 131–135 and 136–138 become 131–138. */
export function skipRanges(series: FillerSeries): EpisodeRange[] {
  const sorted = series.arcs
    .filter((arc) => arc.kind === "filler")
    .map((arc) => ({ start: arc.start, end: arc.end }))
    .sort((a, b) => a.start - b.start);
  const merged: EpisodeRange[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end + 1) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

/** Every episode outside the filler ranges. Mixed episodes stay in, because they adapt the manga. */
export function watchRanges(series: FillerSeries): EpisodeRange[] {
  const ranges: EpisodeRange[] = [];
  let next = 1;
  for (const skip of skipRanges(series)) {
    if (skip.start > next) ranges.push({ start: next, end: skip.start - 1 });
    next = Math.max(next, skip.end + 1);
  }
  if (next <= series.totalEpisodes) ranges.push({ start: next, end: series.totalEpisodes });
  return ranges;
}

/**
 * Anime-original runs, checked 9 Oct 2026.
 * One Piece ranges are standalone filler arcs, not every recap inside a canon arc.
 * Naruto’s skip list is the usual “about 90 of 220.” Episode 220 stays canon.
 * Shippuden ranges are the commonly published 203 filler episodes of 500.
 * Episode titles are omitted on purpose.
 * Bleach and Black Clover checked 12 Oct 2026. Filler ranges agree across two independent
 * per-episode lists. Arc boundaries follow the Wikipedia season tables.
 */
export const FILLER_SERIES: Record<FillerSeries["id"], FillerSeries> = {
  "one-piece": {
    id: "one-piece",
    title: "One Piece",
    totalEpisodes: 1180,
    minutesPerEpisode: 24,
    scope:
      "These are the standalone anime-original arcs. Recap episodes inside canon arcs are not all listed. Everything else through episode 1180 is the main story.",
    arcs: [
      { name: "Warship Island", start: 54, end: 61, kind: "filler" },
      { name: "Post-Alabasta", start: 131, end: 135, kind: "filler" },
      { name: "Goat Island", start: 136, end: 138, kind: "filler" },
      { name: "Ruluka Island", start: 139, end: 143, kind: "filler" },
      {
        name: "G-8",
        start: 196,
        end: 206,
        kind: "filler",
        note: "Anime-original. Some groups still watch this one.",
      },
      { name: "Ocean's Dream", start: 220, end: 224, kind: "filler" },
      { name: "Foxy's Return", start: 225, end: 226, kind: "filler" },
      { name: "Ice Hunter", start: 326, end: 335, kind: "filler" },
      { name: "Spa Island", start: 382, end: 384, kind: "filler" },
      { name: "Little East Blue", start: 426, end: 429, kind: "filler" },
      { name: "Z's Ambition", start: 575, end: 578, kind: "filler" },
      { name: "Caesar Retrieval", start: 626, end: 628, kind: "filler" },
      { name: "Silver Mine", start: 747, end: 750, kind: "filler" },
      { name: "Marine Rookie", start: 780, end: 782, kind: "filler" },
      { name: "Cidre Guild", start: 895, end: 896, kind: "filler" },
      {
        name: "Film Red tie-in",
        start: 1029,
        end: 1030,
        kind: "filler",
        note: "Tied to the Film Red story, not the weekly manga run.",
      },
    ],
  },
  naruto: {
    id: "naruto",
    title: "Naruto",
    totalEpisodes: 220,
    minutesPerEpisode: 23,
    scope:
      "Skip these for the manga story. Episode 220, Departure, is canon and leads into Shippuden. Episode 142 is a one-episode bridge and is not in the skip list.",
    arcs: [
      { name: "Forest of Death recap", start: 26, end: 26, kind: "filler", note: "Clip show." },
      { name: "Hot Spring", start: 97, end: 97, kind: "filler" },
      {
        name: "Land of Tea",
        start: 101,
        end: 106,
        kind: "filler",
        note: "Some groups still watch this arc.",
      },
      { name: "Land of Rice Fields", start: 136, end: 140, kind: "filler" },
      { name: "Sakura after the retrieval", start: 141, end: 141, kind: "mixed" },
      {
        name: "Anime-original missions",
        start: 143,
        end: 219,
        kind: "filler",
        note: "The long run after Sasuke leaves. Episode 220 is not in this range.",
      },
    ],
  },
  "naruto-shippuden": {
    id: "naruto-shippuden",
    title: "Naruto Shippuden",
    totalEpisodes: 500,
    minutesPerEpisode: 23,
    scope:
      "These ranges are the usual 203 filler episodes. Mixed episodes that still adapt the manga are not itemized. Naruto Kai is a later edit that drops most of these anime-original episodes. This list is for the original 500-episode broadcast.",
    arcs: [
      { name: "Twelve Guardian Ninja", start: 57, end: 71, kind: "filler" },
      { name: "Three-Tails", start: 91, end: 112, kind: "filler" },
      { name: "Six-Tails", start: 144, end: 151, kind: "filler" },
      { name: "Two Saviors side episodes", start: 170, end: 171, kind: "filler" },
      { name: "Past of Konoha", start: 176, end: 196, kind: "filler" },
      { name: "Life on a boat", start: 223, end: 242, kind: "filler" },
      { name: "Nine-Tails side episodes", start: 257, end: 260, kind: "filler" },
      { name: "Nine-Tails side episode", start: 271, end: 271, kind: "filler" },
      { name: "War side episodes", start: 279, end: 281, kind: "filler" },
      { name: "War side episodes, continued", start: 284, end: 295, kind: "filler" },
      { name: "Attackers from afar", start: 303, end: 320, kind: "filler" },
      {
        name: "Kakashi Anbu",
        start: 347,
        end: 361,
        kind: "filler",
        note: "Anime-original backstory. Skip for the plot. Some groups still watch it.",
      },
      { name: "Mecha Naruto", start: 376, end: 377, kind: "filler" },
      { name: "Ten-Tails side episodes", start: 388, end: 390, kind: "filler" },
      { name: "Friends' paths", start: 394, end: 413, kind: "filler" },
      { name: "Ten-Tails side episodes, short", start: 416, end: 417, kind: "filler" },
      { name: "Ten-Tails side episodes, short", start: 422, end: 423, kind: "filler" },
      { name: "Jiraiya ninja tales", start: 427, end: 450, kind: "filler" },
      { name: "Shinobi history side episodes", start: 464, end: 468, kind: "filler" },
      { name: "Childhood side episodes", start: 480, end: 483, kind: "filler" },
    ],
  },
  bleach: {
    id: "bleach",
    title: "Bleach",
    totalEpisodes: 366,
    minutesPerEpisode: 24,
    scope:
      "These are the 163 filler episodes of the original 366. Mixed episodes that still adapt the manga are not all itemized, so keep anything not listed. Thousand-Year Blood War (episodes 367 onward) is canon and picks up right after episode 366.",
    arcs: [
      { name: "Standalone episode", start: 33, end: 33, kind: "filler" },
      { name: "Standalone episode", start: 50, end: 50, kind: "filler" },
      {
        name: "Bount arc",
        start: 64,
        end: 108,
        kind: "filler",
        note: "The longest skip, including the Bount attack on Soul Society. The skip most groups agree on.",
      },
      {
        name: "Bount wrap-up into the Arrancar arc",
        start: 109,
        end: 109,
        kind: "mixed",
        note: "Some lists end the Bount arc here. It sets up the next canon arc.",
      },
      { name: "Stolen Hōgyoku", start: 128, end: 137, kind: "filler" },
      { name: "Menos Forest", start: 147, end: 149, kind: "filler" },
      { name: "New Captain Amagai", start: 168, end: 189, kind: "filler" },
      { name: "Side episodes", start: 204, end: 205, kind: "filler" },
      { name: "Karakura-Raizer", start: 213, end: 214, kind: "filler" },
      { name: "Standalone episodes", start: 228, end: 229, kind: "filler" },
      {
        name: "Zanpakutō Unknown Tales and Beast Swords",
        start: 230,
        end: 265,
        kind: "filler",
        note: "The swords take human form. Some groups watch it for the fights.",
      },
      { name: "Recap", start: 266, end: 266, kind: "filler" },
      { name: "Standalone episode", start: 287, end: 287, kind: "filler" },
      { name: "Shinigami Film Festival", start: 298, end: 299, kind: "filler" },
      { name: "Standalone episodes", start: 303, end: 305, kind: "filler" },
      { name: "Standalone episodes", start: 311, end: 316, kind: "filler" },
      { name: "Gotei 13 Invasion", start: 317, end: 341, kind: "filler" },
      {
        name: "Lead-in to the Lost Agent arc",
        start: 342,
        end: 342,
        kind: "mixed",
        note: "Many lists end Gotei 13 Invasion at 342. It opens the last canon arc.",
      },
      { name: "New Year special", start: 355, end: 355, kind: "filler" },
    ],
  },
  "black-clover": {
    id: "black-clover",
    title: "Black Clover",
    totalEpisodes: 170,
    minutesPerEpisode: 23,
    scope:
      "These are the 18 filler episodes of the first 170, plus the mixed episodes to keep. Anime-original episodes that fit the story, like most of the Heart Kingdom training arc, are not filler and stay on the watch list. Season 2 started on 3 Oct 2026 at episode 171.",
    arcs: [
      { name: "Expanded opening episode", start: 2, end: 2, kind: "mixed" },
      { name: "Early expanded episodes", start: 8, end: 9, kind: "mixed" },
      { name: "Dungeon arc expanded episode", start: 12, end: 12, kind: "mixed" },
      { name: "Encounter arc side episode", start: 29, end: 29, kind: "filler" },
      { name: "Encounter arc expanded episode", start: 30, end: 30, kind: "mixed" },
      { name: "Royal Knights side episode", start: 66, end: 66, kind: "filler" },
      { name: "Royal Knights side episode", start: 68, end: 68, kind: "filler" },
      { name: "Royal Knights expanded episode", start: 69, end: 69, kind: "mixed" },
      { name: "Petit Clover special", start: 82, end: 82, kind: "filler" },
      { name: "Elf Reincarnation expanded episode", start: 102, end: 102, kind: "mixed" },
      { name: "Nero flashbacks", start: 123, end: 125, kind: "filler" },
      { name: "Heart Kingdom training side episode", start: 131, end: 131, kind: "filler" },
      { name: "Heart Kingdom training side episodes", start: 134, end: 135, kind: "filler" },
      {
        name: "Anime-original cult story",
        start: 142,
        end: 149,
        kind: "filler",
        note: "Some lists count episode 149 as canon. It is safe to watch either way.",
      },
    ],
  },
};
