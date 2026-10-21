import type { ScheduleSlot, ScheduleWeek } from "@/lib/tools/schedule-time";

/**
 * Crunchyroll English dubs for one week (Mon–Sun, UTC).
 *
 * UPKEEP — every Monday, together with `crunchyroll-schedule.ts` (same `weekStart`):
 * 1. Take dub times from the AnimeSchedule.net timetable (DUB rows that list Crunchyroll),
 *    converted to UTC. Their times change with US/EU daylight time, unlike the JST-anchored
 *    sub slots, so recheck every row: One Piece is "9:00 a.m. PT", which is 16:00 UTC until
 *    1 Nov 2026 and 17:00 UTC after.
 * 2. Keep a row only when Crunchyroll News confirms that English dub (a dated "English Dub
 *    Reveals Release Date" post, or the season's dub list). Record both sources and the
 *    check date. If a time can't be confirmed, leave the row out.
 * 3. Bump episodes, `subEpisode`, `episodesBehindSub`, the One Piece block, `DUBS_WITHOUT_DATE`,
 *    and the page's `dateModified`.
 * A week that is not updated goes stale fast: if nobody can update it, say so on the page.
 */

export type DubSource = { label: string; url: string };

export type DubSlot = ScheduleSlot & {
  /** Exact title of the same show in CRUNCHYROLL_WEEK when its sub airs this week. */
  subTitle?: string;
  /** How many episodes the dub trails the sub this week; 0 = same-day dub. */
  episodesBehindSub?: number;
  sources: DubSource[];
  checked: string;
};

export type DubWeek = Omit<ScheduleWeek, "slots"> & { slots: DubSlot[] };

const CHECKED = "20 Oct 2026";
const AS = (route: string): DubSource => ({
  label: "AnimeSchedule.net dub timetable",
  url: `https://animeschedule.net/anime/${route}`,
});
const CR = (slug: string, label = "Crunchyroll News"): DubSource => ({
  label,
  url: `https://www.crunchyroll.com/news/${slug}`,
});
const FALL_LIST = CR(
  "announcements/2026/9/15/fall-2026-dubs-crunchyroll",
  "Crunchyroll News: Fall 2026 dubs list",
);
const SUMMER_LIST = CR(
  "announcements/2026/6/17/summer-2026-dubs-crunchyroll",
  "Crunchyroll News: Summer 2026 dubs list",
);

export const CRUNCHYROLL_DUB_WEEK: DubWeek = {
  weekStart: "2026-10-19",
  checked: CHECKED,
  slots: [
    {
      title: "PSYREN",
      utcDay: 0,
      utcTime: "14:30",
      episode: "Ep 1",
      subTitle: "PSYREN",
      episodesBehindSub: 2,
      sources: [AS("psyren"), CR("announcements/2026/10/18/psyren-anime-english-dub-release-date-cast-crew")],
      checked: CHECKED,
    },
    {
      title: "One Piece",
      utcDay: 1,
      utcTime: "16:00",
      episode: "Ep 1156",
      watchSlug: "one-piece",
      note: "Elbaph Arc dub premiere",
      sources: [
        AS("one-piece"),
        CR("announcements/2026/8/24/one-piece-elbaph-arc-english-dub-weekly-stream-crunchyroll-starting-october-20"),
      ],
      checked: CHECKED,
    },
    {
      title: "The Laid-Off Cheat-Granting Mage Enjoys a Second Lease on Life",
      utcDay: 1,
      utcTime: "15:30",
      episode: "Ep 3",
      subTitle: "The Laid-Off Cheat-Granting Mage Enjoys a Second Lease on Life",
      episodesBehindSub: 0,
      sources: [
        AS(
          "tsuihou-sareta-cheat-fuyo-majutsushi-wa-kimama-na-second-life-wo-ouka-suru-ore-wa-buki-dake-ja-naku-arayuru-mono-ni-kyouka-point-wo-fuyo-dekiru-shi-ore-no-ishi-de-itsudemo-kouka-wo-kaijo-dekiru-kedo-nokotta-hitotachi-daijoubu",
        ),
        CR("announcements/2026/10/5/the-laid-off-cheat-granting-mage-enjoys-a-second-lease-on-life-anime-english-dub-release-date-cast-crew"),
      ],
      checked: CHECKED,
    },
    {
      title: "Saga of Tanya the Evil Season 2",
      utcDay: 2,
      utcTime: "13:30",
      episode: "Ep 7",
      sources: [
        AS("youjo-senki-ii"),
        CR("announcements/2026/9/9/saga-of-tanya-the-evil-season-2-anime-english-dub-release-date-cast-crew"),
      ],
      checked: CHECKED,
    },
    {
      title: "The Detective Is Already Dead Season 2",
      utcDay: 2,
      utcTime: "13:30",
      episode: "Ep 1",
      subTitle: "The Detective Is Already Dead Season 2",
      episodesBehindSub: 2,
      sources: [
        AS("tantei-wa-mou-shindeiru-season-2"),
        CR("announcements/2026/10/19/the-detective-is-already-dead-season-2-anime-english-dub-release-date-cast-crew"),
      ],
      checked: CHECKED,
    },
    {
      title: "Re:ZERO -Starting Life in Another World- Season 4",
      utcDay: 2,
      utcTime: "14:00",
      episode: "Ep 19",
      note: "Season finale",
      sources: [AS("re-zero-kara-hajimeru-isekai-seikatsu-4"), SUMMER_LIST],
      checked: CHECKED,
    },
    {
      title: "The Prince of Tennis II: U-17 World Cup",
      utcDay: 2,
      utcTime: "16:00",
      episode: "Ep 2",
      subTitle: "The Prince of Tennis II: U-17 World Cup",
      episodesBehindSub: 2,
      sources: [AS("shin-tennis-no-oujisama-u-17-world-cup-kesshou-member-ketteisen"), FALL_LIST],
      checked: CHECKED,
    },
    {
      title: "A Returner's Magic Should Be Special Season 2",
      utcDay: 2,
      utcTime: "17:15",
      episode: "Ep 3",
      subTitle: "A Returner's Magic Should Be Special Season 2",
      episodesBehindSub: 0,
      sources: [
        AS("kikansha-no-mahou-wa-tokubetsu-desu-season-2"),
        CR("announcements/2026/10/6/a-returners-magic-should-be-special-anime-english-dub-release-date-cast-crew"),
      ],
      checked: CHECKED,
    },
    {
      title: "FX Fighter Kurumi-chan",
      utcDay: 3,
      utcTime: "12:31",
      episode: "Ep 4",
      subTitle: "FX Fighter Kurumi-chan",
      episodesBehindSub: 0,
      sources: [
        AS("fx-senshi-kurumi-chan"),
        CR("announcements/2026/10/2/fx-fighter-kurumi-chan-anime-english-dub-release-date-cast-crew"),
      ],
      checked: CHECKED,
    },
    {
      title: "The Exiled Heavy Knight Knows How to Game the System",
      utcDay: 3,
      utcTime: "16:30",
      episode: "Ep 15",
      subTitle: "The Exiled Heavy Knight Knows How to Game the System",
      episodesBehindSub: 2,
      sources: [AS("tsuihou-sareta-tensei-juukishi-wa-game-chishiki-de-musou-suru"), SUMMER_LIST, FALL_LIST],
      checked: CHECKED,
    },
    {
      title: "Link Click Season 3",
      utcDay: 4,
      utcTime: "03:01",
      episode: "Ep 9",
      subTitle: "Link Click Season 3",
      episodesBehindSub: 3,
      sources: [AS("shi-guang-dai-li-ren-3"), SUMMER_LIST],
      checked: CHECKED,
    },
    {
      title: "The Apothecary Diaries Season 3",
      utcDay: 4,
      utcTime: "15:00",
      episode: "Ep 2",
      watchSlug: "the-apothecary-diaries",
      subTitle: "The Apothecary Diaries Season 3",
      episodesBehindSub: 2,
      sources: [
        AS("kusuriya-no-hitorigoto-zoku-hen"),
        CR("announcements/2026/10/15/the-apothecary-diaries-season-3-anime-english-dub-release-date-cast-crew"),
      ],
      checked: CHECKED,
    },
    {
      title: "#I'm Looking For a Zombie",
      utcDay: 5,
      utcTime: "15:00",
      episode: "Ep 4",
      subTitle: "#I'm Looking For a Zombie",
      episodesBehindSub: 0,
      sources: [
        AS("zombie-sagashitemasu"),
        CR("announcements/2026/10/2/im-looking-for-a-zombie-anime-english-dub-release-date-cast-crew"),
      ],
      checked: CHECKED,
    },
    {
      title: "Black Clover Season 2",
      utcDay: 5,
      utcTime: "15:00",
      episode: "Ep 2",
      watchSlug: "black-clover",
      // The sub continues the first series' numbering: Ep 174 is Season 2 Ep 4.
      subTitle: "Black Clover Season 2",
      episodesBehindSub: 2,
      sources: [
        AS("black-clover-2nd-season"),
        CR("announcements/2026/10/17/black-clover-season-2-anime-english-dub-release-date-cast-crew"),
      ],
      checked: CHECKED,
    },
    {
      title: "Magical Explorer",
      utcDay: 5,
      utcTime: "16:30",
      episode: "Ep 5",
      subTitle: "Magical Explorer",
      episodesBehindSub: 0,
      sources: [
        AS("magical-explorer"),
        CR("latest/2026/10/5/magical-explorer-anime-english-dub-now-streaming-on-crunchyroll"),
      ],
      checked: CHECKED,
    },
    {
      title: "Aoashi Season 2",
      utcDay: 6,
      utcTime: "09:00",
      episode: "Ep 2",
      subTitle: "Aoashi Season 2",
      episodesBehindSub: 2,
      sources: [
        AS("ao-ashi-2nd-season"),
        CR("announcements/2026/10/17/aoashi-season-2-anime-english-dub-release-date-cast-crew"),
      ],
      checked: CHECKED,
    },
    {
      title: "Reborn as a Space Mercenary",
      utcDay: 6,
      utcTime: "14:00",
      episode: "Ep 4",
      subTitle: "Reborn as a Space Mercenary",
      episodesBehindSub: 0,
      sources: [
        AS("mezametara-saikyou-soubi-to-uchuusenmochi-datta-node-ikkodate-mezashite-youhei-toshite-jiyuu-ni-ikitai"),
        CR("announcements/2026/10/2/reborn-as-a-space-mercenary-i-woke-up-piloting-the-strongest-starship-anime-english-dub-release-date-cast-crew"),
      ],
      checked: CHECKED,
    },
    {
      title: "Overgeared",
      utcDay: 6,
      utcTime: "14:31",
      episode: "Ep 5",
      subTitle: "Overgeared",
      episodesBehindSub: 0,
      sources: [AS("overgeared"), CR("announcements/2026/9/25/overgeared-anime-english-dub-release-date-cast-and-crew")],
      checked: CHECKED,
    },
    {
      title: "As a Reincarnated Aristocrat, I'll Use My Appraisal Skill to Rise in the World Season 3",
      utcDay: 6,
      utcTime: "15:01",
      episode: "Ep 3",
      subTitle:
        "As a Reincarnated Aristocrat, I'll Use My Appraisal Skill to Rise in the World Season 3",
      episodesBehindSub: 2,
      sources: [
        AS("tensei-kizoku-kantei-skill-de-nariagaru-3rd-season"),
        CR(
          "announcements/2026/10/19/as-a-reincarnated-aristocrat-ill-use-my-appraisal-skill-to-rise-in-the-world-season-3-anime-english-dub-now-streaming-on-crunchyroll-cast-crew",
        ),
      ],
      checked: CHECKED,
    },
  ],
};

/** Announced in Crunchyroll's Fall 2026 dub list, but not on the weekly timetable as of CHECKED. */
export const DUBS_WITHOUT_DATE: string[] = [
  "Firefly Wedding",
  "Full Clearing Another World under a Goddess with Zero Believers",
  "HORROR COLLECTOR",
  "Magic Knight Rayearth",
  "Sasaki and Peeps Season 2",
  "The Iceblade Sorcerer Shall Rule the World II",
  "The World's Strongest Witch",
];

export const FALL_DUB_LIST_SOURCE = FALL_LIST;

/** One Piece English dub, from Crunchyroll's 24 Aug 2026 announcement. Update weekly. */
export const ONE_PIECE_DUB = {
  /** Dub episode released this week, and its release date (Tuesday). */
  thisWeekEpisode: 1156,
  thisWeekDate: "Tuesday, October 20",
  nextEpisode: 1157,
  nextDate: "Tuesday, October 27",
  releaseTime: "9:00 a.m. PT",
  /** Last episode aired in Japan before the broadcast break. */
  japanLatestEpisode: 1180,
  regions:
    "the United States, Canada, Australia, New Zealand, South Africa, India, Southeast Asia and Latin America",
  source: CR(
    "announcements/2026/8/24/one-piece-elbaph-arc-english-dub-weekly-stream-crunchyroll-starting-october-20",
  ),
} as const;

/** "Same day as sub", "2 eps behind sub", or the row's own note. */
export function dubNote(slot: DubSlot): string | undefined {
  if (slot.note) return slot.note;
  if (slot.episodesBehindSub === undefined) return undefined;
  if (slot.episodesBehindSub === 0) return "Same day as sub";
  return `${slot.episodesBehindSub} ${slot.episodesBehindSub === 1 ? "ep" : "eps"} behind sub`;
}

/** Counts for the lag summary: same-day dubs, dubs behind the sub, and the typical gap. */
export function dubLagSummary(week: DubWeek): {
  total: number;
  sameDay: number;
  behind: number;
  /** Most common gap among dubs that trail the sub, in episodes. */
  typicalGap: number | null;
} {
  const compared = week.slots.filter((slot) => slot.episodesBehindSub !== undefined);
  const gaps = compared.map((slot) => slot.episodesBehindSub ?? 0).filter((gap) => gap > 0);
  const counts = new Map<number, number>();
  for (const gap of gaps) counts.set(gap, (counts.get(gap) ?? 0) + 1);
  const typicalGap =
    [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
  return {
    total: week.slots.length,
    sameDay: compared.length - gaps.length,
    behind: gaps.length,
    typicalGap,
  };
}

/** The week with each row's note filled in, ready for the schedule component. */
export function withDubNotes(week: DubWeek): ScheduleWeek {
  return {
    weekStart: week.weekStart,
    checked: week.checked,
    slots: week.slots.map(({ title, utcDay, utcTime, episode, watchSlug, ...rest }) => ({
      title,
      utcDay,
      utcTime,
      episode,
      watchSlug,
      note: dubNote({ title, utcDay, utcTime, episode, watchSlug, ...rest }),
    })),
  };
}
