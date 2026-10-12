/**
 * Title-specific content for the watch pages that already earn search impressions.
 * Picked from Search Console (90 days to 9 Oct 2026): Blue Lock 268, Black Clover 164,
 * Attack on Titan 116, Death Note 112 impressions. Other watch pages use the shared template only.
 * Facts checked 12 Oct 2026. Keep entries short and verifiable; no streaming-availability claims.
 */
export type WatchEnrichment = {
  /** Short facts a group needs before committing. */
  facts: string[];
  /** A concrete session plan for this title. */
  plan: string;
  links?: { href: string; label: string }[];
  faq: { question: string; answer: string }[];
};

export const WATCH_ENRICHMENT: Record<string, WatchEnrichment> = {
  "blue-lock": {
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
};
