import type { ScheduleWeek } from "@/lib/tools/schedule-time";

/**
 * Crunchyroll sub simulcasts for one week, checked 15 Nov 2026.
 * Times come from the AnimeSchedule.net week 47 timetable, converted to UTC, kept only
 * where the show links to Crunchyroll, and cross-checked with the drop times on Crunchyroll's
 * release calendar for 9-15 Nov. Slots are JST-anchored, so UTC does not move when US
 * daylight time ends. Update every Monday: new weekStart, checked, episodes, and the page
 * dateModified.
 *
 * Episode numbers are left out where AnimeSchedule's count and Crunchyroll's running count
 * disagree (Chitose, A Returner's Magic Season 2, The Apothecary Diaries Season 3, Black
 * Clover Season 2, Star Detective Precure!, Ace of the Diamond, As a Reincarnated Aristocrat
 * Season 3). Rilakkuma uses Crunchyroll's own drop time (02:00 UTC), an hour after
 * AnimeSchedule's. Suikoden: The Anime joined on 10 Nov (Tuesdays, 6:30 a.m. PT).
 */
export const CRUNCHYROLL_WEEK: ScheduleWeek = {
  weekStart: "2026-11-16",
  checked: "15 Nov 2026",
  slots: [
    { title: "Hello, I am a Witch and my Crush Wants me to Make a Love Potion!", utcDay: 0, utcTime: "12:31", episode: "Ep 7" },
    { title: "So What's Wrong with Getting Reborn as a Goblin?", utcDay: 0, utcTime: "13:01", episode: "Ep 7" },
    { title: "PSYREN", utcDay: 0, utcTime: "14:30", episode: "Ep 6" },
    { title: "The Cold Sato-san Is Only Sweet to Me", utcDay: 1, utcTime: "13:30", episode: "Ep 7" },
    { title: "Super Psychic Policeman Chojo", utcDay: 1, utcTime: "14:30", episode: "Ep 7" },
    { title: "Battle Spirits [Re] Zekkai No Ku", utcDay: 1, utcTime: "14:30", episode: "Ep 7" },
    { title: "Suikoden: The Anime", utcDay: 1, utcTime: "14:30", episode: "Ep 7" },
    { title: "The Laid-Off Cheat-Granting Mage Enjoys a Second Lease on Life", utcDay: 1, utcTime: "15:30", episode: "Ep 7" },
    { title: "Chitose Is in the Ramune Bottle", utcDay: 1, utcTime: "16:30" },
    { title: "Red River", utcDay: 1, utcTime: "17:35", episode: "Ep 20" },
    { title: "DARK MACHINE The Animation", utcDay: 1, utcTime: "18:15", episode: "Ep 6" },
    { title: "The World's Strongest Witch", utcDay: 2, utcTime: "13:01", episode: "Ep 7" },
    { title: "Sasaki and Peeps Season 2", utcDay: 2, utcTime: "13:01", episode: "Ep 7" },
    { title: "The Detective Is Already Dead Season 2", utcDay: 2, utcTime: "13:30", episode: "Ep 7" },
    { title: "Paw & Palaces", utcDay: 2, utcTime: "14:30", episode: "Ep 10" },
    { title: "Magic Knight Rayearth (2026)", utcDay: 2, utcTime: "15:15", episode: "Ep 7" },
    { title: "The Prince of Tennis II: U-17 World Cup", utcDay: 2, utcTime: "16:00", episode: "Ep 8" },
    { title: "Dandivine", utcDay: 2, utcTime: "17:00", episode: "Ep 7" },
    { title: "A Returner's Magic Should Be Special Season 2", utcDay: 2, utcTime: "17:15" },
    { title: "FX Fighter Kurumi-chan", utcDay: 3, utcTime: "12:31", episode: "Ep 8" },
    { title: "The Exiled Heavy Knight Knows How to Game the System", utcDay: 3, utcTime: "16:00", episode: "Ep 21" },
    { title: "The Iceblade Sorcerer Shall Rule the World II", utcDay: 3, utcTime: "17:00", episode: "Ep 7" },
    { title: "The Apothecary Diaries Season 3", utcDay: 4, utcTime: "15:00", watchSlug: "the-apothecary-diaries" },
    { title: "A Certain Dark Item", utcDay: 4, utcTime: "15:31", episode: "Ep 7" },
    { title: "Firefly Wedding", utcDay: 4, utcTime: "16:00", episode: "Ep 7" },
    { title: "Tougen Anki", utcDay: 4, utcTime: "16:00", episode: "Ep 8" },
    { title: "Please Excuse My Younger Brothers", utcDay: 4, utcTime: "16:30", episode: "Ep 20" },
    { title: "Keroro", utcDay: 5, utcTime: "01:00", episode: "Ep 8" },
    { title: "Rilakkuma: Goyururi Yume no Tabi", utcDay: 5, utcTime: "02:00", episode: "Ep 33" },
    { title: "The Vermilion Mask", utcDay: 5, utcTime: "09:30", episode: "Ep 7" },
    { title: "Case Closed (Detective Conan)", utcDay: 5, utcTime: "12:30", episode: "Ep 1221", watchSlug: "detective-conan" },
    { title: "Romelia War Chronicle", utcDay: 5, utcTime: "13:00", episode: "Ep 8" },
    { title: "A Tale of the Secret Saint", utcDay: 5, utcTime: "13:01", episode: "Ep 9" },
    { title: "A Wild Last Boss Appeared! Season 2", utcDay: 5, utcTime: "13:31", episode: "Ep 9" },
    { title: "Black Clover Season 2", utcDay: 5, utcTime: "15:00", watchSlug: "black-clover" },
    { title: "#I'm Looking For a Zombie", utcDay: 5, utcTime: "15:00", episode: "Ep 7" },
    { title: "VERTEX FORCE", utcDay: 5, utcTime: "16:00", episode: "Ep 8" },
    { title: "Magical Explorer", utcDay: 5, utcTime: "16:30", episode: "Ep 9" },
    { title: "Horror Collector", utcDay: 5, utcTime: "17:15", episode: "Ep 7" },
    { title: "Magic Repo Man: Dumped by My Party, I'll Cash In With a Cute Support Fairy to Become the Strongest!", utcDay: 5, utcTime: "18:00", episode: "Ep 8" },
    { title: "Star Detective Precure!", utcDay: 6, utcTime: "01:30" },
    { title: "Aoashi Season 2", utcDay: 6, utcTime: "09:00", episode: "Ep 8" },
    { title: "Ace of the Diamond act II, 2nd Season", utcDay: 6, utcTime: "09:00" },
    { title: "Reborn as a Space Mercenary", utcDay: 6, utcTime: "14:00", episode: "Ep 8" },
    { title: "Uncle's Obsession with Cute Things", utcDay: 6, utcTime: "14:00", episode: "Ep 8" },
    { title: "Overgeared", utcDay: 6, utcTime: "14:31", episode: "Ep 9" },
    { title: "Even Though I'm a Super Timid Noble Girl, I Accepted the Bet", utcDay: 6, utcTime: "14:31", episode: "Ep 8" },
    { title: "Full Clearing Another World under a Goddess with Zero Believers", utcDay: 6, utcTime: "14:31", episode: "Ep 7" },
    { title: "As a Reincarnated Aristocrat, I'll Use My Appraisal Skill to Rise in the World Season 3", utcDay: 6, utcTime: "15:01" },
    { title: "HOTEL INHUMANS Season 2", utcDay: 6, utcTime: "15:15", episode: "Ep 8" },
    { title: "Dragon Ball Super: Beerus", utcDay: 6, utcTime: "16:00", episode: "Ep 7", watchSlug: "dragon-ball-super" },
    { title: "From Far Away", utcDay: 6, utcTime: "16:00", episode: "Ep 8" },
  ],
};

/** One Piece is between broadcast runs. Keep this note until episode 1181 has a date. */
export const ONE_PIECE_STATUS =
  "One Piece is on break after episode 1180 (27 Sep 2026). New episodes return in 2027 under the show’s new 26-episodes-a-year format.";
