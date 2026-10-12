/** Japanese broadcast count. Wikipedia, “List of One Piece episodes,” as of this date. */
export const ONE_PIECE_EPISODE_COUNT = 1180;

export const ONE_PIECE_COUNT_AS_OF = "2026-09-27";

/** Typical broadcast length used for the hours estimate. Recaps and specials vary. */
export const ONE_PIECE_MINUTES_PER_EPISODE = 24;

/** Home-media seasons by arc, same Wikipedia list. Elbaph is still airing. */
export const ONE_PIECE_SEASONS: { arc: string; episodes: number; years: string }[] = [
  { arc: "East Blue", episodes: 61, years: "1999–2001" },
  { arc: "Entering into the Grand Line", episodes: 16, years: "2001" },
  { arc: "Drum Kingdom", episodes: 15, years: "2001" },
  { arc: "Alabasta", episodes: 38, years: "2001–2002" },
  { arc: "TV original", episodes: 13, years: "2002–2003" },
  { arc: "Skypiea", episodes: 52, years: "2003–2004" },
  { arc: "Naval Fortress & Foxy", episodes: 33, years: "2004–2005" },
  { arc: "Water Seven", episodes: 35, years: "2005–2006" },
  { arc: "Enies Lobby", episodes: 73, years: "2006–2007" },
  { arc: "Thriller Bark", episodes: 45, years: "2008" },
  { arc: "Sabaody Archipelago", episodes: 26, years: "2008–2009" },
  { arc: "Amazon Lily", episodes: 14, years: "2009" },
  { arc: "Impel Down", episodes: 35, years: "2009–2010" },
  { arc: "Marineford", episodes: 60, years: "2010–2011" },
  { arc: "Fish-Man Island", episodes: 62, years: "2011–2012" },
  { arc: "Punk Hazard", episodes: 50, years: "2013–2014" },
  { arc: "Dressrosa", episodes: 118, years: "2014–2016" },
  { arc: "Zou", episodes: 36, years: "2016–2017" },
  { arc: "Whole Cake Island", episodes: 109, years: "2017–2019" },
  { arc: "Wano Country", episodes: 197, years: "2019–2023" },
  { arc: "Egghead", episodes: 67, years: "2024–2025" },
  { arc: "Elbaph", episodes: 25, years: "2026–" },
];

export function watchHours(episodes: number, minutesPerEpisode: number): number {
  return Math.round((episodes * minutesPerEpisode) / 60);
}

export function weeksAtPace(episodes: number, episodesPerWeek: number): number {
  if (episodesPerWeek < 1) return episodes;
  return Math.ceil(episodes / episodesPerWeek);
}
