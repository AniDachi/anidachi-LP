/**
 * Title-specific content for the watch pages that already earn search impressions.
 * Picked from Search Console (90 days to 9 Oct 2026): Blue Lock 268, Black Clover 164,
 * Attack on Titan 116, Death Note 112 impressions. Facts checked 12 Oct 2026.
 * Second wave (owner-approved 19 Oct 2026): the next 15 by impressions, 21 Sep – 18 Oct 2026,
 * with sources noted above each entry. Other watch pages use the shared template only.
 * Keep entries short and verifiable; no streaming-availability claims.
 */
export type WatchEnrichment = {
  /** ISO date the entry was written or re-checked; becomes the page's dateModified. */
  updated?: string;
  /** Verified episode count shown on the page, used instead of the cached MyAnimeList entry. */
  episodes?: string;
  /** Short facts a group needs before committing. */
  facts: string[];
  /** A concrete session plan for this title. */
  plan: string;
  links?: { href: string; label: string }[];
  faq: { question: string; answer: string }[];
};

export const WATCH_ENRICHMENT: Record<string, WatchEnrichment> = {
  "blue-lock": {
    episodes: "38 episodes across 2 seasons",
    facts: [
      "Season 1: 24 episodes (2022–23). Season 2: 14 episodes (2024).",
      "Blue Lock: Episode Nagi (2024) is a film that retells part of season 1 from Seishiro Nagi's side.",
      "About 15 hours for both TV seasons at 24 minutes an episode.",
    ],
    plan: "Season 1 splits cleanly into selection rounds. Three episodes a session gets a group through it in eight nights, with a natural break after each round's final match.",
    faq: [
      {
        question: "How many episodes of Blue Lock are there?",
        answer:
          "38 across two TV seasons: 24 in season 1 and 14 in season 2. The Episode Nagi film is separate.",
      },
      {
        question: "Does the group need to watch Blue Lock: Episode Nagi?",
        answer:
          "No. It retells events from season 1 through Nagi's eyes. Watch it after season 1 if the group wants more of him; skipping it loses no story.",
      },
      {
        question: "Where should a new group start Blue Lock?",
        answer:
          "Season 1, episode 1. The selection format is set up there, and nothing earlier is required.",
      },
    ],
  },
  "black-clover": {
    facts: [
      "The first run has 170 episodes (2017–21). Season 2 started on 3 Oct 2026 at episode 171.",
      "18 of the first 170 episodes are filler. Skipping them leaves 152.",
      "Sword of the Wizard King (2023) is an anime-original film and optional.",
    ],
    plan: "170 episodes is a long commitment. At six episodes a week, a group finishes the first run in about seven months, or about six if it skips the filler.",
    faq: [
      {
        question: "How many episodes of Black Clover are there?",
        answer:
          "170 in the first run. Season 2 continues the numbering from episode 171 and began airing on 3 Oct 2026.",
      },
      {
        question: "Can we skip Black Clover filler?",
        answer:
          "Yes. 18 episodes are filler, including 29, 66, 68, 82, 123–125, and 142–149. The filler list has every range.",
      },
      {
        question: "Is the Black Clover movie canon?",
        answer:
          "Sword of the Wizard King is an anime-original story. It is optional and fits best after the first 170 episodes.",
      },
    ],
  },
  "attack-on-titan": {
    episodes: "87 episodes across 4 seasons, plus 2 specials",
    facts: [
      "87 TV episodes across four seasons, plus two Final Chapters specials (2023).",
      "Season 3 and The Final Season each air in two parts.",
      "About 35 hours for the TV episodes, before the specials.",
    ],
    plan: "Watch in release order: seasons 1 to 3, The Final Season parts 1 and 2, then The Final Chapters specials 1 and 2. Plan a longer session for the specials, which run about an hour or more each.",
    faq: [
      {
        question: "What order do we watch Attack on Titan in?",
        answer:
          "Release order: season 1, season 2, season 3 parts 1 and 2, The Final Season parts 1 and 2, then The Final Chapters specials 1 and 2.",
      },
      {
        question: "How long does Attack on Titan take to watch?",
        answer:
          "About 35 hours for the 87 TV episodes, plus the two Final Chapters specials. Three episodes a night takes a group about 30 sessions.",
      },
      {
        question: "Are the Final Chapters specials part of the ending?",
        answer:
          "Yes. They conclude the story after The Final Season part 2. Do not stop before them.",
      },
    ],
  },
  "death-note": {
    facts: [
      "37 episodes (2006–07), about 14 hours.",
      "Relight 1 and Relight 2 are recap specials. A group watching the series can skip them.",
      "No filler arcs. Every episode moves the plot.",
    ],
    plan: "Death Note works well at three or four episodes a session, which finishes the series in about ten nights. Plan a pause point at episode 25, where the story shifts.",
    faq: [
      {
        question: "How many episodes is Death Note?",
        answer: "37 episodes, about 14 hours in total.",
      },
      {
        question: "Do we need to watch Death Note Relight?",
        answer:
          "No. Relight 1 and 2 are recap specials that re-edit the series. They are optional after the 37 episodes.",
      },
      {
        question: "Does Death Note have filler?",
        answer: "No. All 37 episodes follow the main story, so a group can watch straight through.",
      },
    ],
  },

// Batch 1 enrichment entries for WATCH_ENRICHMENT. All facts checked 19 Oct 2026.
// Paste the entries below into the WATCH_ENRICHMENT record in apps/web/lib/watch-page-enrichment.ts.

  // Sources (checked 2026-10-19):
  // https://en.wikipedia.org/wiki/List_of_Mashle_episodes
  // https://myanimelist.net/anime/52211/Mashle (12 eps, 23 min, A-1 Pictures)
  // https://www.animenewsnetwork.com/news/2026-07-02/mashle-magic-and-muscles-season-3-anime-trailer-unveils-january-2027-debut/.239227
  // https://animecorner.me/mashle-magic-and-muscles-season-3-first-trailer-and-january-2027-release-date-revealed/
  "mashle": {
    updated: "2026-10-19",
    episodes: "24 episodes across 2 seasons",
    facts: [
      "Season 1: 12 episodes (2023). Season 2, The Divine Visionary Candidate Exam Arc: 12 episodes (2024).",
      "Episode 6.5 is a recap special. A group can skip it.",
      "About 9 hours for both seasons at 23 minutes an episode. Season 3 is set to premiere in January 2027.",
    ],
    plan: "Four episodes a session is about an hour and a half. That covers both seasons in six nights, with a natural break after episode 12, where season 1 ends.",
    faq: [
      {
        question: "How many episodes of Mashle are there?",
        answer:
          "24 across two seasons: 12 in season 1 and 12 in season 2. The recap special, episode 6.5, is not counted.",
      },
      {
        question: "Is there a Mashle season 3?",
        answer:
          "Yes. Season 3 adapts the Tri-Magicathalon Divine Visionary Final Exam arc and is set to premiere in January 2027. Its episode count had not been announced as of Oct 2026.",
      },
      {
        question: "Do we need to watch Mashle episode 6.5?",
        answer: "No. It is a recap of the first six episodes. Go straight from episode 6 to episode 7.",
      },
    ],
  },

  // Sources (checked 2026-10-19):
  // https://en.wikipedia.org/wiki/List_of_Naruto_episodes (220 eps, Oct 2002 to Feb 2007)
  // https://en.wikipedia.org/wiki/List_of_Naruto:_Shippuden_episodes (500 eps, Feb 2007 to Mar 2017)
  // https://myanimelist.net/anime/20/Naruto (23 min per episode)
  // https://www.animefillerlist.com/shows/naruto (90 filler)
  // https://www.animefillerlist.com/shows/naruto-shippuden (203 filler)
  // https://en.wikipedia.org/wiki/The_Last:_Naruto_the_Movie (set after Shippuden episode 493)
  // Episode 135 ends the Sasuke retrieval arc: tvmaze.com/episodes/45140 and episode guides
  // Repo cross-check: app/tools/naruto-filler-list (90/220, 130 to watch) and
  // app/tools/naruto-shippuden-filler-list (203/500, 297 to watch) use the same counts.
  "naruto": {
    updated: "2026-10-19",
    episodes: "720 episodes (Naruto + Shippuden)",
    facts: [
      "Naruto has 220 episodes (2002–07). Naruto Shippuden has 500 (2007–17). That is 720 in total.",
      "90 of Naruto's episodes and 203 of Shippuden's are filler. Skipping them leaves 130 and 297.",
      "The Last: Naruto the Movie (2014) is set after Shippuden episode 493.",
    ],
    plan: "Skipping filler, original Naruto is 130 episodes. At eight a week a group finishes it in about 16 weeks. Episode 135 is a good pause point: it ends the Sasuke retrieval arc, and the long filler run starts right after it.",
    links: [
      { href: "/tools/naruto-filler-list", label: "Naruto filler list" },
      { href: "/tools/naruto-shippuden-filler-list", label: "Naruto Shippuden filler list" },
    ],
    faq: [
      {
        question: "What order do we watch Naruto in?",
        answer:
          "Naruto episodes 1–220, then Naruto Shippuden episodes 1–500. The Last: Naruto the Movie fits after Shippuden episode 493.",
      },
      {
        question: "How many episodes of Naruto are there?",
        answer:
          "720: 220 in Naruto and 500 in Naruto Shippuden. Without filler, that drops to 427 (130 plus 297).",
      },
      {
        question: "Can we skip Naruto filler?",
        answer:
          "Yes. Naruto's long filler run is episodes 143–219, and Shippuden has 203 filler episodes spread across the series. The filler lists have every range.",
      },
    ],
  },

  // Sources (checked 2026-10-19):
  // https://en.wikipedia.org/wiki/Cyberpunk:_Edgerunners (10 eps, 13 Sep 2022, Trigger with CD Projekt Red, dir. Hiroyuki Imaishi; Edgerunners 2 dated 20 Oct 2026)
  // https://myanimelist.net/anime/42310/Cyberpunk__Edgerunners (10 eps, 25 min)
  // https://opencritic.com/news/33820/cyberpunk-edgerunners-2-has-an-official-release-date
  // https://beebom.com/cyberpunk-edgerunners-2-release-date-announced/ (10 eps, new leads, standalone story)
  "cyberpunk-edgerunners": {
    updated: "2026-10-19",
    episodes: "10 episodes",
    facts: [
      "10 episodes, all released on 13 Sep 2022. About 4 hours at 25 minutes an episode.",
      "Made by Studio Trigger with CD Projekt Red, set in the world of the Cyberpunk 2077 game.",
      "Cyberpunk: Edgerunners 2 is a separate 10-episode story with new main characters.",
    ],
    plan: "Edgerunners fits in two sessions of five episodes, about two hours each. A group that wants one long night can take a break after episode 5, the halfway point.",
    faq: [
      {
        question: "How many episodes is Cyberpunk: Edgerunners?",
        answer: "10 episodes of about 25 minutes, roughly 4 hours in total.",
      },
      {
        question: "Do we need to play Cyberpunk 2077 before watching Edgerunners?",
        answer:
          "No. The series shares the game's setting, Night City, but tells its own complete story with its own characters.",
      },
      {
        question: "Is Cyberpunk: Edgerunners 2 a continuation?",
        answer:
          "No. It is a standalone 10-episode story with new leads, and it does not continue the first series' main characters.",
      },
    ],
  },

  // Sources (checked 2026-10-19):
  // https://en.wikipedia.org/wiki/Serial_Experiments_Lain (13 "Layers", 6 Jul to 28 Sep 1998, Triangle Staff, dir. Ryutaro Nakamura, writer Chiaki J. Konaka, PlayStation game Nov 1998)
  // https://myanimelist.net/anime/339/Serial_Experiments_Lain (13 eps, 23 min)
  "serial-experiments-lain": {
    updated: "2026-10-19",
    facts: [
      "13 episodes, called Layers (1998). About 5 hours at 23 minutes an episode.",
      "An original anime, not adapted from a manga. No filler or recap episodes.",
      "The 1998 PlayStation game is a separate work. The series does not require it.",
    ],
    plan: "Three sessions of four, four and five episodes cover the series at 90 to 115 minutes a night. Lain rewards talking it over, so leave time between sessions rather than watching all 13 at once.",
    faq: [
      {
        question: "How many episodes is Serial Experiments Lain?",
        answer: "13 episodes, called Layers, about 5 hours in total.",
      },
      {
        question: "Does Serial Experiments Lain have filler?",
        answer: "No. All 13 episodes are part of the main story, so watch them in order without skipping.",
      },
      {
        question: "Do we need to play the Serial Experiments Lain game?",
        answer:
          "No. The PlayStation game came out in 1998, after the anime aired, and is a separate work. The 13 episodes stand on their own.",
      },
    ],
  },

  // Sources (checked 2026-10-19):
  // https://en.wikipedia.org/wiki/List_of_Tokyo_Revengers_episodes (S1 24, Christmas Showdown 13, Tenjiku 13, War of the Three Titans premiered Oct 2026, count TBA)
  // https://myanimelist.net/anime/42249/Tokyo_Revengers (24 eps, 23 min, LIDENFILMS)
  // https://animecorner.me/tokyo-revengers-war-of-the-three-titans-arc-season-4-reveals-new-trailer-cast-october-2026-release/
  // https://www.anitrendz.com/news/2026/03/29/tokyo-revengers-war-of-the-three-titans-arc-reveals-2nd-trailer-october-2026-start
  // Note: sources give the season 4 premiere as 2 or 3 Oct 2026 (time zone), so the entry says "October 2026".
  "tokyo-revengers": {
    updated: "2026-10-19",
    episodes: "50 episodes across 3 seasons (season 4 airing)",
    facts: [
      "Season 1: 24 episodes (2021). Christmas Showdown: 13 (2023). Tenjiku Arc: 13 (2023). That is 50 episodes.",
      "About 19 hours for those 50 episodes at 23 minutes each.",
      "Season 4, the War of the Three Titans Arc, began airing in October 2026. Its episode count had not been announced as of Oct 2026.",
    ],
    plan: "Four episodes a session gets a group through season 1 in six nights, with a natural break at episode 24, where season 1 ends. The Christmas Showdown and Tenjiku arcs add 26 more, about seven sessions at the same pace.",
    faq: [
      {
        question: "How many episodes of Tokyo Revengers are there?",
        answer:
          "50 across the first three seasons: 24, 13 and 13. Season 4 began in October 2026 and is still airing as of Oct 2026.",
      },
      {
        question: "What order do we watch Tokyo Revengers in?",
        answer:
          "Release order: season 1, Christmas Showdown, Tenjiku Arc, then the War of the Three Titans Arc.",
      },
      {
        question: "Is Tokyo Revengers finished?",
        answer:
          "Not yet in anime form. Season 4, airing since October 2026, adapts the manga's final storylines.",
      },
    ],
  },

  // Sources (checked 2026-10-19):
  // https://en.wikipedia.org/wiki/List_of_Tokyo_Ghoul_episodes (12 + 12 + 24 = 48, Pierrot, OVAs Jack and Pinto 2015)
  // https://en.wikipedia.org/wiki/Tokyo_Ghoul (√A "follows an original story"; :re based on the sequel manga)
  // https://myanimelist.net/anime/22319/Tokyo_Ghoul (12 eps, 24 min)
  "tokyo-ghoul": {
    updated: "2026-10-19",
    episodes: "48 episodes across 4 seasons",
    facts: [
      "48 TV episodes: season 1 (12, 2014), Tokyo Ghoul √A (12, 2015), and Tokyo Ghoul:re (24 in two parts of 12, 2018).",
      "√A follows an original story instead of the manga. :re adapts the sequel manga.",
      "About 19 hours at 24 minutes an episode. The Jack and Pinto OVAs (2015) are optional.",
    ],
    plan: "The series comes in four 12-episode blocks. Four episodes a session finishes each block in three nights, and the whole run in 12, with a natural break at the end of each block.",
    faq: [
      {
        question: "What order do we watch Tokyo Ghoul in?",
        answer:
          "Release order: Tokyo Ghoul, Tokyo Ghoul √A, then Tokyo Ghoul:re parts 1 and 2. The Jack and Pinto OVAs are optional extras.",
      },
      {
        question: "How many episodes of Tokyo Ghoul are there?",
        answer: "48 TV episodes: 12 in season 1, 12 in √A, and 24 in :re. The two OVAs are separate.",
      },
      {
        question: "Is Tokyo Ghoul √A canon?",
        answer:
          "No. √A follows an original story that differs from the manga. Tokyo Ghoul:re adapts the sequel manga.",
      },
    ],
  },

  // Sources (checked 2026-10-19):
  // https://en.wikipedia.org/wiki/Howl%27s_Moving_Castle_(film) (Japan release 20 Nov 2004, 119 min, Studio Ghibli, dir. Hayao Miyazaki,
  //   based on Diana Wynne Jones's 1986 novel, Oscar nomination at the 78th Academy Awards, English dub released in the US 10 Jun 2005)
  "howls-moving-castle": {
    updated: "2026-10-19",
    episodes: "Movie (119 minutes)",
    facts: [
      "A Studio Ghibli film directed by Hayao Miyazaki, released in Japan in 2004. It runs 119 minutes.",
      "Adapted from Diana Wynne Jones's 1986 novel of the same name.",
      "Nominated for Best Animated Feature at the 78th Academy Awards.",
    ],
    plan: "One sitting is enough. Budget about two and a half hours for the 119-minute film plus setup and a short talk afterwards, and agree on the English dub or Japanese audio with subtitles before pressing play.",
    faq: [
      {
        question: "How long is Howl's Moving Castle?",
        answer: "119 minutes, just under two hours.",
      },
      {
        question: "Is Howl's Moving Castle based on a book?",
        answer:
          "Yes. It adapts Diana Wynne Jones's 1986 novel Howl's Moving Castle.",
      },
      {
        question: "Should we watch Howl's Moving Castle dubbed or subbed?",
        answer:
          "Either works, so it is a group choice. The 2005 English dub casts Christian Bale as Howl, Emily Mortimer and Jean Simmons as Sophie, and Billy Crystal as Calcifer.",
      },
    ],
  },

  // Sources (checked 2026-10-19):
  // https://en.wikipedia.org/wiki/List_of_My_Hero_Academia_episodes (8 seasons, 170 eps: 13/25/25/25/25/25/21/11; final season 4 Oct to 13 Dec 2025;
  //   bonus special "More" adapting chapter 431 aired 2 May 2026)
  // https://en.wikipedia.org/wiki/My_Hero_Academia (four films: 2018, 2019, 2021, 2024)
  // https://myanimelist.net/anime/31964/Boku_no_Hero_Academia (24 min per episode)
  // https://animecorner.me/my-hero-academia-anime-ends-with-final-season-episode-11-episode-170-overall-gets-plus-ultra-visual/
  // https://www.animenewsnetwork.com/news/2025-12-19/my-hero-academia-anime-gets-1-more-bonus-episode-concert-world-tour/.232275
  // https://www.animefillerlist.com/shows/my-hero-academia (filler: 39, 58, 64, 104)
  // https://www.sportskeeda.com/anime/are-the-my-hero-academia-movies-canon (films are original stories; You're Next set between seasons 6 and 7)
  "my-hero-academia": {
    updated: "2026-10-19",
    episodes: "170 episodes across 8 seasons",
    facts: [
      "170 episodes across eight seasons (2016–25). The final season has 11 episodes.",
      "A bonus episode, More, adapting the manga's extra final chapter, aired in May 2026.",
      "About 68 hours at 24 minutes an episode. The four films (2018–24) tell original side stories and are optional.",
    ],
    plan: "170 episodes is a long commitment. At six episodes a week, a group finishes in about 28 weeks, roughly seven months. Each season ending is a natural pause, and season 1 is only 13 episodes, about two weeks at that pace.",
    faq: [
      {
        question: "How many episodes of My Hero Academia are there?",
        answer:
          "170 across eight seasons, ending in December 2025. A bonus episode, More, aired in May 2026 after the finale.",
      },
      {
        question: "Does My Hero Academia have filler?",
        answer:
          "Very little. Fan filler guides list four filler episodes out of 170: 39, 58, 64 and 104.",
      },
      {
        question: "Are the My Hero Academia movies canon?",
        answer:
          "They are original stories, not adapted from the manga, so the group can skip them.",
      },
    ],
  },

// Batch 2 entries for WATCH_ENRICHMENT (apps/web/lib/watch-page-enrichment.ts).
// All facts checked 19 Oct 2026. No streaming-availability claims.

  // Sources (checked 2026-10-19):
  // https://en.wikipedia.org/wiki/Another_(novel)
  // https://myanimelist.net/anime/11111 (Another TV: 12 eps, 24 min, Jan 10 – Mar 27, 2012)
  // https://myanimelist.net/anime/11701 (Another: The Other - Inga OVA: 1 ep, 24 min, May 26, 2012)
  "another": {
    updated: "2026-10-19",
    facts: [
      "12 episodes (2012), about 24 minutes each. Just under 5 hours in total.",
      "Another: The Other – Inga (2012) is a one-episode OVA side story about Mei Misaki. It was released after the series aired.",
      "The 2012 live-action film is a separate adaptation of the same novel, not a continuation.",
    ],
    plan: "Four episodes a session finishes Another in three nights of about 1 hour 36 minutes each. A group that wants one horror marathon can watch all 12 in a single sitting of just under 5 hours, with a break at the halfway point after episode 6.",
    faq: [
      {
        question: "How many episodes of Another are there?",
        answer:
          "12 TV episodes, plus one OVA, The Other – Inga. The series runs just under 5 hours.",
      },
      {
        question: "Do we need to watch the Another OVA?",
        answer:
          "No. The Other – Inga is a side story about Mei and adds nothing the main plot needs. It came out after the series aired, so it works as an extra once the group has finished episode 12.",
      },
      {
        question: "Is there a season 2 of Another?",
        answer:
          "No. The 12 episodes tell a complete story. A sequel novel, Another 2001, was published in 2020, but no anime of it had been announced as of Oct 2026.",
      },
    ],
  },

  // Sources (checked 2026-10-19):
  // https://en.wikipedia.org/wiki/Odd_Taxi (13 eps, Apr 6 – Jun 29, 2021)
  // https://myanimelist.net/anime/46102 (13 eps, 23 min; In the Woods listed as Summary movie)
  // https://en.wikipedia.org/wiki/Odd_Taxi:_In_the_Woods (released Apr 1, 2022; 128 min; reconstruction plus post-finale events)
  // https://www.animenewsnetwork.com/review/odd-taxi/in-the-woods/.184586 (mostly recap; epilogue after TV finale; watch series first)
  "odd-taxi": {
    updated: "2026-10-19",
    facts: [
      "13 episodes (2021), about 23 minutes each. Roughly 5 hours in total.",
      "ODDTAXI: In the Woods (2022, 128 minutes) is a film that retells the series through interviews and adds an epilogue set after episode 13.",
      "There is no filler. It is a single 13-episode mystery, so watch every episode in order.",
    ],
    plan: "Three sessions of four, four and five episodes cover the series in about 5 hours. Save In the Woods for a fourth night after episode 13, since its new material picks up where the finale leaves off.",
    faq: [
      {
        question: "How many episodes of ODDTAXI are there?",
        answer: "13 episodes, about 5 hours in total, plus the film In the Woods.",
      },
      {
        question: "Do we need to watch ODDTAXI: In the Woods?",
        answer:
          "It is optional, but it is the only place to see what happens after episode 13. Most of its two hours recaps the series, so watch it after the finale, not instead of the show.",
      },
      {
        question: "What order should we watch ODDTAXI in?",
        answer:
          "Episodes 1 to 13, then the film In the Woods. The film retells the series before its epilogue, so watching it first would spoil the mystery.",
      },
    ],
  },

  // Sources (checked 2026-10-19):
  // https://en.wikipedia.org/wiki/List_of_Is_It_Wrong_to_Try_to_Pick_Up_Girls_in_a_Dungeon%3F_episodes
  //   (S1 13 eps 2015; S2 12 eps 2019; S3 12 eps 2020; S4 22 eps in two parts of 11, 2022–23;
  //    S5 15 eps Oct 5, 2024 – Mar 7, 2025; 3 OVAs; S6 announced Feb 7, 2026, no air date; page edited Oct 9, 2026)
  // https://en.wikipedia.org/wiki/Is_It_Wrong_to_Try_to_Pick_Up_Girls_in_a_Dungeon%3F
  //   (74 TV episodes + 3 OVAs; Arrow of the Orion: original film, Feb 15, 2019; Sword Oratoria aired Apr–Jun 2017)
  // https://myanimelist.net/anime/32887 (Sword Oratoria: 12 eps, Apr 15 – Jul 1, 2017)
  // https://www.anitrendz.com/news/2026/02/07/danmachi-season-6-has-been-announced
  // https://www.cbr.com/crunchyrolls-danmachi-officially-confirms-season-6/
  "danmachi": {
    updated: "2026-10-19",
    episodes: "74 episodes across 5 seasons",
    facts: [
      "74 TV episodes across five seasons: 13, 12, 12, 22 and 15 (2015–25). Season 4 aired in two parts of 11.",
      "Season 6 was announced on 7 Feb 2026. No air date had been set as of Oct 2026.",
      "Sword Oratoria (2017, 12 episodes) is a spin-off that runs parallel to season 1. Arrow of the Orion (2019) is an original film. Both are optional.",
    ],
    plan: "Treat each season as its own block. At four episodes a session, the 74 episodes take about 19 nights. Every season finale is a natural pause, and season 4 has an extra one after its first 11 episodes.",
    faq: [
      {
        question: "How many episodes of DanMachi are there?",
        answer:
          "74 across five TV seasons, plus three OVAs. Season 6 was announced in Feb 2026 but had no air date as of Oct 2026.",
      },
      {
        question: "What order should we watch DanMachi in?",
        answer:
          "Seasons 1 to 5 in release order. Add Sword Oratoria after season 1 if the group wants the same period from Ais Wallenstein's side, and Arrow of the Orion before season 2.",
      },
      {
        question: "Do we need to watch Sword Oratoria or the DanMachi movie?",
        answer:
          "No. Sword Oratoria is a side story told alongside season 1, and Arrow of the Orion is an original film. Skipping both loses nothing the main seasons need.",
      },
    ],
  },

  // Sources (checked 2026-10-19):
  // https://en.wikipedia.org/wiki/Berserk_(1997_TV_series) (25 eps, Oct 8, 1997 – Apr 1, 1998; adapts Black Swordsman + Golden Age, ~13 vols; ending called abrupt)
  // https://en.wikipedia.org/wiki/List_of_Berserk_episodes
  // https://myanimelist.net/anime/33 (1997: 25 eps, 23 min)
  // https://en.wikipedia.org/wiki/Berserk:_The_Golden_Age_Arc
  //   (films: Egg of the King Feb 4, 2012, 77 min; Battle for Doldrey Jun 23, 2012, 98 min; The Advent Feb 1, 2013, 113 min;
  //    Memorial Edition: 13 eps, Oct 2 – Dec 25, 2022, re-edit with new scenes)
  // https://en.wikipedia.org/wiki/Berserk_(2016_TV_series)
  //   (2016: 12 eps, Jul 1 – Sep 16, 2016, Conviction arc; 2017: 12 eps, Apr 7 – Jun 23, 2017, first half of
  //    Hawk of the Millennium Empire arc; continues from the films, film voice cast returns)
  // https://myanimelist.net/anime/32379 (2016: 12 eps, 24 min)
  "berserk": {
    updated: "2026-10-19",
    episodes: "25 episodes (1997) + 24 (2016–17)",
    facts: [
      "The 1997 series (25 episodes) and the Golden Age Arc films (three films, 2012–13) both adapt the Golden Age arc. Pick one.",
      "The 2016 and 2017 series (12 episodes each) continue from the films with the same voice cast. They stop partway through the manga's Hawk of the Millennium Empire arc.",
      "The Golden Age Arc – Memorial Edition (2022) is a 13-episode TV re-edit of the three films with new scenes.",
    ],
    plan: "The shorter path is three movie nights for the films (77, 98 and 113 minutes), then the 2016 and 2017 series at four episodes a session, which takes six sessions. For the longer path, swap the films for the 1997 series: six sessions of four episodes, with the 25th added to the last one.",
    faq: [
      {
        question: "What order should we watch Berserk in?",
        answer:
          "Start with the Golden Age arc, through either the 1997 series or the three films. Then watch the 2016 series and the 2017 series. The 2016 series follows on from the films.",
      },
      {
        question: "Should we watch Berserk 1997 or the Golden Age Arc films?",
        answer:
          "Either works. The 1997 series takes about 9.5 hours over 25 episodes and ends abruptly. The films cover the same arc in under 5 hours and lead straight into the 2016 series with the same cast. The Memorial Edition is the films re-cut for TV, so skip it if you watch the films.",
      },
      {
        question: "How many episodes of Berserk are there?",
        answer:
          "25 in the 1997 series and 24 in the 2016–17 series. The Golden Age Arc is three films, also released as the 13-episode Memorial Edition in 2022.",
      },
    ],
  },

  // Sources (checked 2026-10-19):
  // https://en.wikipedia.org/wiki/List_of_Dragon_Ball_Z_episodes (291 eps, Apr 26, 1989 – Jan 31, 1996)
  // https://myanimelist.net/anime/813 (291 eps, 24 min)
  // https://en.wikipedia.org/wiki/Dragon_Ball_Z_Kai (Kai 2009–11: 97 aired + ep 98 on video; Final Chapters 2014–15: 61 aired in Japan, 69 produced;
  //   159 in Japan, 167 internationally; omits most filler to follow the manga)
  // https://www.animefillerlist.com/shows/dragon-ball-z (38 filler eps incl. 108–117; 9 mixed)
  // https://www.themarysue.com/?p=613616 (about 38 filler)
  // https://www.animefillerguide.com/?p=240 (29 filler)
  // https://en.wikipedia.org/wiki/List_of_Dragon_Ball_films (13 DBZ films 1989–95, outside TV/manga continuity;
  //   Battle of Gods 2013 and Resurrection 'F' 2015 adapted into Dragon Ball Super)
  "dragon-ball-z": {
    updated: "2026-10-19",
    facts: [
      "291 episodes (1989–96), about 116 hours at 24 minutes each.",
      "Dragon Ball Z Kai is a remastered recut of the same story in 167 episodes (159 in its Japanese release), with most filler removed.",
      "Filler counts vary by list, from about 30 to about 40 episodes. The most cited count is 38, including the run of episodes 108–117.",
    ],
    plan: "Use the four big arcs as pause points: Saiyan, Frieza, Cell and Buu. At six episodes a week, the 291 episodes take about 49 weeks. Kai's 167 take about 28 weeks at the same pace.",
    faq: [
      {
        question: "How many episodes of Dragon Ball Z are there?",
        answer:
          "291, about 116 hours in total. Dragon Ball Z Kai tells the same story in 167 episodes.",
      },
      {
        question: "Should we watch Dragon Ball Z or Dragon Ball Z Kai?",
        answer:
          "Kai if the group wants the shorter run. It is a remastered recut that follows the manga more closely and drops most filler. The original 291 episodes keep the filler and the original pacing.",
      },
      {
        question: "Do we need to watch the Dragon Ball Z movies?",
        answer:
          "No. The 13 films from 1989 to 1995 are side stories that do not fit the TV continuity, so each works as a standalone movie night. Battle of Gods (2013) and Resurrection 'F' (2015) come after the series and were retold in Dragon Ball Super.",
      },
    ],
  },

  // Sources (checked 2026-10-19):
  // https://en.wikipedia.org/wiki/Neon_Genesis_Evangelion (26 eps, Oct 4, 1995 – Mar 27, 1996; Death & Rebirth Mar 15, 1997,
  //   "Death" ~60 min of clips from eps 1–24; Rebuild 1.0 2007, 2.0 2009, 3.0 2012, 3.0+1.0 2021)
  // https://myanimelist.net/anime/30 (26 eps, 24 min)
  // https://en.wikipedia.org/wiki/The_End_of_Evangelion (Jul 19, 1997; 87 min; picks up after ep 24; remake of eps 25–26 and alternative ending)
  // https://en.wikipedia.org/wiki/Rebuild_of_Evangelion (1.0 98 min, remake of eps 1–6; 2.0 108 min, looser retelling;
  //   3.0 96 min, new story; 3.0+1.0 155 min, concludes)
  "neon-genesis-evangelion": {
    updated: "2026-10-19",
    facts: [
      "26 episodes (1995–96), about 10.5 hours at 24 minutes each.",
      "The End of Evangelion (1997, 87 minutes) picks up after episode 24 and remakes episodes 25 and 26 as an alternative ending.",
      "The four Rebuild of Evangelion films (2007–21) are a separate retelling that turns into a new story. They are not a sequel to the series.",
    ],
    plan: "Four episodes a session covers episodes 1 to 24 in six nights. On the seventh, watch episodes 25 and 26 and then The End of Evangelion, about 2 hours 15 minutes in total. Start the Rebuild films on a later night.",
    faq: [
      {
        question: "What order should we watch Evangelion in?",
        answer:
          "Episodes 1 to 26, then The End of Evangelion. Skip Death & Rebirth, which is mostly a recap of episodes 1 to 24. Watch the Rebuild films afterwards in order: 1.0, 2.0, 3.0, then 3.0+1.0.",
      },
      {
        question: "Do we need to watch The End of Evangelion?",
        answer:
          "Watch it after the series. It picks up after episode 24 and retells episodes 25 and 26 as a more conventional, action-based ending. The TV ending and the film ending are meant to sit side by side.",
      },
      {
        question: "Are the Rebuild of Evangelion films the same story as the series?",
        answer:
          "Only at first. 1.0 closely remakes episodes 1 to 6, 2.0 loosely reworks later episodes, and 3.0 and 3.0+1.0 tell a new story. The four films run about 7.5 hours, with 3.0+1.0 alone at 155 minutes.",
      },
    ],
  },

  // Sources (checked 2026-10-19):
  // https://en.wikipedia.org/wiki/Ergo_Proxy (23 eps, Feb 25 – Aug 12, 2006, WOWOW, Manglobe; original screenplay;
  //   only related work is a 2-volume spin-off manga; Romdeau is a domed city)
  // https://myanimelist.net/anime/790 (23 eps, 25 min; related: spin-off manga only)
  // https://en.wikipedia.org/wiki/List_of_Ergo_Proxy_episodes (ep 3: Vincent leaves Romdeau; ep 15: "Nightmare Quiz Show")
  "ergo-proxy": {
    updated: "2026-10-19",
    facts: [
      "23 episodes (2006), about 25 minutes each. Roughly 9.5 hours in total.",
      "One season only. There is no sequel series, OVA or film.",
    ],
    plan: "Four episodes a session finishes Ergo Proxy in six nights, with three left for the last. Get through episode 3 in the first session: that is where Vincent leaves the domed city of Romdeau and the story opens up.",
    faq: [
      {
        question: "How many episodes of Ergo Proxy are there?",
        answer: "23 episodes in a single season, about 9.5 hours in total.",
      },
      {
        question: "Is there an Ergo Proxy season 2?",
        answer:
          "No. The 2006 series is the only anime. The one related work is a two-volume spin-off manga.",
      },
      {
        question: "Does Ergo Proxy have filler?",
        answer:
          "No filler arcs. A few middle episodes use unusual formats, such as the game-show episode 15, but they belong to the main run. Watch all 23 in order.",
      },
    ],
  },
};
