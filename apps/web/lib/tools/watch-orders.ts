export type WatchOrderEntry = {
  title: string;
  year: string;
  format: "TV" | "Film" | "Films" | "ONA";
  /** Visible length, e.g. "25 eps" or "3 films". */
  length: string;
  /** Rough runtime used for the hours stat. */
  minutes: number;
  note: string;
  /** Existing `/watch/{slug}-with-friends` page, when there is one. */
  watchSlug?: string;
};

export type WatchOrder = {
  id: "fate" | "monogatari";
  title: string;
  checked: string;
  firstWatch: WatchOrderEntry[];
  later: WatchOrderEntry[];
};

export function totalHours(entries: WatchOrderEntry[]): number {
  return Math.round(entries.reduce((sum, entry) => sum + entry.minutes, 0) / 60);
}

export function stepAnchor(index: number): string {
  return `step-${index + 1}`;
}

export function orderAsText(order: WatchOrder): string {
  return `${order.title} watch order: ${order.firstWatch
    .map((entry, i) => `${i + 1}. ${entry.title} (${entry.year})`)
    .join(" → ")}`;
}

/**
 * Checked 12 Oct 2026 against Wikipedia episode lists, ANN news, and MAL.
 * Runtimes are rough: 24 minutes a TV episode, real film lengths rounded.
 * Notes are our own wording. Streaming availability changes, so it is not listed per entry.
 */
export const WATCH_ORDERS: Record<WatchOrder["id"], WatchOrder> = {
  fate: {
    id: "fate",
    title: "Fate",
    checked: "12 Oct 2026",
    firstWatch: [
      {
        title: "Fate/stay night: Unlimited Blade Works",
        year: "2014–15",
        format: "TV",
        length: "26 eps (#00–#25)",
        minutes: 648,
        note: "Start here. Episode #00 is an hour-long prologue. Streaming services often split it into two 13-episode seasons, so play both.",
        watchSlug: "fate-stay-night-unlimited-blade-works",
      },
      {
        title: "Fate/stay night: Heaven's Feel I–III",
        year: "2017–20",
        format: "Films",
        length: "3 films",
        minutes: 360,
        note: "The third route of the same war, told as a film trilogy. It assumes you know the cast from Unlimited Blade Works. Watch the three films in order.",
      },
      {
        title: "Fate/Zero",
        year: "2011–12",
        format: "TV",
        length: "25 eps",
        minutes: 600,
        note: "The prequel war ten years earlier. Watched first, it gives away the big reveals of stay night. Watched third, every scene lands harder.",
        watchSlug: "fate-zero",
      },
      {
        title: "Fate/strange Fake",
        year: "2023–26",
        format: "TV",
        length: "1 special + 13 eps",
        minutes: 372,
        note: "A new Grail War in America. Start with the Whispers of Dawn special, then the 2026 series. A second season is confirmed but has no date yet.",
      },
    ],
    later: [
      {
        title: "Fate/stay night (Studio DEEN)",
        year: "2006",
        format: "TV",
        length: "24 eps",
        minutes: 576,
        note: "The first adaptation, mostly Saber's route. Older and rougher. For completists after the core.",
      },
      {
        title: "Lord El-Melloi II's Case Files",
        year: "2019",
        format: "TV",
        length: "13 eps + specials",
        minutes: 336,
        note: "A mystery series starring a Fate/Zero survivor. Best after Fate/Zero.",
      },
      {
        title: "Fate/Apocrypha",
        year: "2017",
        format: "TV",
        length: "25 eps",
        minutes: 600,
        note: "A separate world with a fourteen-servant war. Stands on its own.",
      },
      {
        title: "Fate/Grand Order: Babylonia",
        year: "2019–20",
        format: "TV",
        length: "Ep 0 + 21 eps",
        minutes: 528,
        note: "The strongest entry from the mobile game. Expect game terms that are not explained.",
      },
      {
        title: "Fate/Extra Last Encore",
        year: "2018",
        format: "TV",
        length: "13 eps",
        minutes: 312,
        note: "A digital-world spinoff. Ten episodes plus the three-episode Illustrias arc.",
      },
      {
        title: "Today's Menu for the Emiya Family",
        year: "2018–19",
        format: "ONA",
        length: "13 eps",
        minutes: 156,
        note: "Short cooking episodes with the stay night cast. A cool-down after Heaven's Feel.",
      },
    ],
  },
  monogatari: {
    id: "monogatari",
    title: "Monogatari",
    checked: "12 Oct 2026",
    firstWatch: [
      {
        title: "Bakemonogatari",
        year: "2009–10",
        format: "TV",
        length: "15 eps",
        minutes: 360,
        note: "Start here. Twelve episodes aired on TV and the last three online. Make sure your copy has all fifteen.",
      },
      {
        title: "Nisemonogatari",
        year: "2012",
        format: "TV",
        length: "11 eps",
        minutes: 264,
        note: "Koyomi's sisters take the spotlight.",
      },
      {
        title: "Nekomonogatari (Black)",
        year: "2012",
        format: "TV",
        length: "4 eps",
        minutes: 96,
        note: "A prequel about Tsubasa during Golden Week. Aired as one New Year's Eve marathon.",
      },
      {
        title: "Monogatari Series Second Season",
        year: "2013",
        format: "TV",
        length: "5 arcs",
        minutes: 552,
        note: "Five arcs in one broadcast: Nekomonogatari White, Kabukimonogatari, Otorimonogatari, Onimonogatari, and Koimonogatari.",
      },
      {
        title: "Hanamonogatari",
        year: "2014",
        format: "TV",
        length: "5 eps",
        minutes: 120,
        note: "A Suruga Kanbaru side story set later in time. Safe to move after Owarimonogatari II if the group wants the main plot first.",
      },
      {
        title: "Tsukimonogatari",
        year: "2014",
        format: "TV",
        length: "4 eps",
        minutes: 96,
        note: "The bridge into the final arc.",
      },
      {
        title: "Owarimonogatari",
        year: "2015",
        format: "TV",
        length: "13 eps",
        minutes: 312,
        note: "The start of the end. Ougi Oshino arrives and Koyomi's middle-school past comes back.",
      },
      {
        title: "Kizumonogatari I–III (or Koyomi Vamp)",
        year: "2016–17",
        format: "Films",
        length: "3 films, or 1 re-edit",
        minutes: 216,
        note: "The spring-break prequel. Bakemonogatari keeps referring to it, and Owarimonogatari II depends on it. The 2024 Koyomi Vamp film re-cuts the trilogy into about 2.5 hours.",
      },
      {
        title: "Owarimonogatari II",
        year: "2017",
        format: "TV",
        length: "7 eps",
        minutes: 168,
        note: "The finale of the main story.",
      },
      {
        title: "Zoku Owarimonogatari",
        year: "2018–19",
        format: "TV",
        length: "6 eps",
        minutes: 144,
        note: "An epilogue in a mirror world. Also released as a film.",
      },
      {
        title: "Monogatari Series: Off & Monster Season",
        year: "2024",
        format: "ONA",
        length: "14 eps",
        minutes: 336,
        note: "The newest season, after high school. One more episode is announced with no date yet.",
      },
    ],
    later: [
      {
        title: "Koyomimonogatari",
        year: "2016",
        format: "ONA",
        length: "12 short eps",
        minutes: 144,
        note: "Short one-month vignettes. Optional, and hard to find on US streaming.",
      },
    ],
  },
};
