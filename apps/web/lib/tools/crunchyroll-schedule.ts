import type { ScheduleWeek } from "@/lib/tools/schedule-time";

/**
 * Crunchyroll sub simulcasts for one week, checked 12 Oct 2026.
 * Times come from the AnimeSchedule.net week 42 timetable, converted to UTC, kept only
 * where the show links to Crunchyroll. Slots are JST-anchored, so UTC does not move when
 * US daylight time ends. Update every Monday: new weekStart, checked, episodes, and the
 * page dateModified.
 */
export const CRUNCHYROLL_WEEK: ScheduleWeek = {
  weekStart: "2026-10-12",
  checked: "12 Oct 2026",
  slots: [
    {
      title: "Hello, I am a Witch and my Crush Wants me to Make a Love Potion!",
      utcDay: 0,
      utcTime: "12:31",
      episode: "Ep 2",
    },
    {
      title: "So What's Wrong with Getting Reborn as a Goblin?",
      utcDay: 0,
      utcTime: "13:01",
      episode: "Ep 3",
    },
    { title: "PSYREN", utcDay: 0, utcTime: "14:30", episode: "Ep 2" },
    {
      title: "The Laid-Off Cheat-Granting Mage Enjoys a Second Lease on Life",
      utcDay: 1,
      utcTime: "15:30",
      episode: "Ep 2",
    },
    { title: "Red River", utcDay: 1, utcTime: "17:40", episode: "Ep 15" },
    { title: "Sasaki and Peeps Season 2", utcDay: 2, utcTime: "13:01", episode: "Ep 2" },
    {
      title: "The Detective Is Already Dead Season 2",
      utcDay: 2,
      utcTime: "13:30",
      episode: "Ep 2",
    },
    { title: "The World's Strongest Witch", utcDay: 2, utcTime: "14:00", episode: "Ep 2" },
    { title: "Magic Knight Rayearth (2026)", utcDay: 2, utcTime: "15:15", episode: "Ep 2" },
    {
      title: "The Prince of Tennis II: U-17 World Cup",
      utcDay: 2,
      utcTime: "16:00",
      episode: "Ep 3",
    },
    {
      title: "A Returner's Magic Should Be Special Season 2",
      utcDay: 2,
      utcTime: "17:15",
      episode: "Ep 2",
    },
    { title: "FX Fighter Kurumi-chan", utcDay: 3, utcTime: "12:31", episode: "Ep 3" },
    {
      title: "The Exiled Heavy Knight Knows How to Game the System",
      utcDay: 3,
      utcTime: "16:00",
      episode: "Ep 16",
    },
    {
      title: "The Iceblade Sorcerer Shall Rule the World II",
      utcDay: 3,
      utcTime: "17:00",
      episode: "Ep 2",
    },
    { title: "Link Click Season 3", utcDay: 4, utcTime: "03:01", episode: "Ep 11" },
    {
      title: "The Apothecary Diaries Season 3",
      utcDay: 4,
      utcTime: "15:00",
      episode: "Ep 3",
      watchSlug: "the-apothecary-diaries",
    },
    { title: 'A Certain Scientific "ITEM"', utcDay: 4, utcTime: "15:31", episode: "Ep 2" },
    { title: "Firefly Wedding", utcDay: 4, utcTime: "16:00", episode: "Ep 2" },
    { title: "Tougen Anki", utcDay: 4, utcTime: "16:00", episode: "Ep 3" },
    { title: "Please Excuse My Younger Brothers", utcDay: 4, utcTime: "16:30", episode: "Ep 15" },
    { title: "The Vermilion Mask", utcDay: 5, utcTime: "09:30", episode: "Ep 2" },
    {
      title: "Case Closed (Detective Conan)",
      utcDay: 5,
      utcTime: "11:30",
      episode: "Ep 1217",
      watchSlug: "detective-conan",
    },
    { title: "Romelia War Chronicle", utcDay: 5, utcTime: "13:00", episode: "Ep 3" },
    { title: "A Tale of the Secret Saint", utcDay: 5, utcTime: "13:01", episode: "Ep 4" },
    { title: "A Wild Last Boss Appeared! Season 2", utcDay: 5, utcTime: "13:31", episode: "Ep 4" },
    {
      title: "Black Clover Season 2",
      utcDay: 5,
      utcTime: "15:00",
      episode: "Ep 173",
      watchSlug: "black-clover",
    },
    { title: "#I'm Looking For a Zombie", utcDay: 5, utcTime: "15:00", episode: "Ep 3" },
    { title: "VERTEX FORCE", utcDay: 5, utcTime: "16:00", episode: "Ep 3" },
    { title: "Magical Explorer", utcDay: 5, utcTime: "16:30", episode: "Ep 4" },
    { title: "Star Detective Precure!", utcDay: 6, utcTime: "00:30", episode: "Ep 38" },
    { title: "Aoashi Season 2", utcDay: 6, utcTime: "09:00", episode: "Ep 3" },
    {
      title: "Ace of the Diamond act II, 2nd Season",
      utcDay: 6,
      utcTime: "09:00",
      episode: "Ep 2",
    },
    { title: "Reborn as a Space Mercenary", utcDay: 6, utcTime: "14:00", episode: "Ep 3" },
    { title: "Uncle's Obsession with Cute Things", utcDay: 6, utcTime: "14:00", episode: "Ep 3" },
    { title: "Overgeared", utcDay: 6, utcTime: "14:31", episode: "Ep 4" },
    {
      title: "Even Though I'm a Super Timid Noble Girl, I Accepted the Bet",
      utcDay: 6,
      utcTime: "14:31",
      episode: "Ep 3",
    },
    {
      title:
        "As a Reincarnated Aristocrat, I'll Use My Appraisal Skill to Rise in the World Season 3",
      utcDay: 6,
      utcTime: "15:01",
      episode: "Ep 4",
    },
    { title: "HOTEL INHUMANS Season 2", utcDay: 6, utcTime: "15:15", episode: "Ep 3" },
    {
      title: "Dragon Ball Super: Beerus",
      utcDay: 6,
      utcTime: "16:00",
      episode: "Ep 2",
      watchSlug: "dragon-ball-super",
    },
    { title: "From Far Away", utcDay: 6, utcTime: "16:00", episode: "Ep 3" },
  ],
};

/** One Piece is between broadcast runs. Keep this note until episode 1181 has a date. */
export const ONE_PIECE_STATUS =
  "One Piece is on break after episode 1180 (27 Sep 2026). New episodes return in 2027 under the show’s new 26-episodes-a-year format.";
