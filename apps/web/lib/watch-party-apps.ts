import { PRICING_FREE_TIER_TABLE } from "@/lib/pricing-copy";

/**
 * One source of competitor facts for the comparison pages (/compare and the
 * "<app> alternatives" guides), so the pages can't disagree (ANI-44, 23 Nov 2026).
 *
 * Every competitor fact comes from that company's own site. Checked 23 Nov 2026 unless
 * a source label gives another date (Teleparty premium page 19 Nov, Discord 22 Nov).
 * Re-check all of them on 21 Dec 2026 and update CHECKED_ON.
 */
export const WATCH_PARTY_APPS_CHECKED_ON = "23 Nov 2026";

export type WatchPartyAppId =
  | "anidachi"
  | "teleparty"
  | "kosmi"
  | "syncup"
  | "watch2gether"
  | "rave"
  | "discord"
  | "hyperbeam"
  | "metastream"
  | "syncplay"
  | "kast";

export type WatchPartyApp = {
  id: WatchPartyAppId;
  name: string;
  /** Short "best for" line, used after the name in headings. */
  tagline: string;
  /** Our page about this app (an alternatives page, hub or anchor). */
  href: string;
  /** Link text for href. */
  hrefLabel: string;
  runs: string;
  phones: string;
  netflix: string;
  crunchyroll: string;
  calls: string;
  price: string;
  /** One plain paragraph, facts only, safe to reuse on any page. */
  summary: string;
  sources: { href: string; label: string }[];
};

export const WATCH_PARTY_APPS: Record<WatchPartyAppId, WatchPartyApp> = {
  anidachi: {
    id: "anidachi",
    name: "AniDachi",
    tagline: "calls on the player, and Crunchyroll",
    href: "/extension",
    hrefLabel: "Get AniDachi",
    runs: "Chrome extension, each person's own player",
    phones: "no",
    netflix: "yes",
    crunchyroll: "yes",
    calls: "Voice and video, on the player",
    price: PRICING_FREE_TIER_TABLE,
    summary:
      "Our Chrome extension syncs each person's own Netflix, YouTube or Crunchyroll player, with chat, reactions and voice and video calls on the video, so nobody needs Discord open beside it. Friends join free. A Free host gets 20 minutes a day for up to 4 people; Plus and Pro remove the daily limit. The limits: desktop Chrome only, and three services today.",
    sources: [],
  },
  teleparty: {
    id: "teleparty",
    name: "Teleparty",
    tagline: "the most streaming services",
    href: "/guides/best-teleparty-alternatives-for-anime",
    hrefLabel: "Teleparty alternatives",
    runs: "Browser extension; mobile apps",
    phones: "Apps with fewer services",
    netflix: "Free",
    crunchyroll: "Premium only",
    calls: "Premium only",
    price: "Free tier; Premium $6.59/month",
    summary:
      "The extension formerly called Netflix Party, for Chrome, Edge, Safari and Opera. It's free on Netflix, YouTube, Disney+, Hulu, HBO Max and Prime Video with text chat; Crunchyroll, Paramount+, ESPN+ and voice and video chat need Premium ($6.59 a month or $47.88 a year on its site). Its mobile apps support fewer services than the extension.",
    sources: [
      { href: "https://www.teleparty.com/support", label: "Teleparty support FAQ" },
      { href: "https://www.teleparty.com/premium", label: "Teleparty Premium page (19 Nov)" },
    ],
  },
  kosmi: {
    id: "kosmi",
    name: "Kosmi",
    tagline: "free rooms with video chat",
    href: "/compare/anidachi-vs-kosmi",
    hrefLabel: "Kosmi alternatives",
    runs: "Website with a shared browser",
    phones: "yes",
    netflix: "Says any streaming service",
    crunchyroll: "Not named",
    calls: "Voice and video, free",
    price: "Free; optional Premium",
    summary:
      "A room that opens from a link. Kosmi says it's free with no credit card, that voice, video and messaging are built in, and that you can host movie nights with Netflix, YouTube or any streaming service through its shared browser. It has a mobile app but recommends a desktop or tablet. Premium is optional.",
    sources: [
      { href: "https://kosmi.io/", label: "Kosmi home page" },
      { href: "https://kosmi.io/teleparty-alternative/", label: "Kosmi Teleparty alternative page" },
    ],
  },
  syncup: {
    id: "syncup",
    name: "SyncUp",
    tagline: "free web rooms plus a streaming extension",
    href: "/compare#syncup",
    hrefLabel: "SyncUp in the watch party app comparison",
    runs: "Website; extension for streaming services",
    phones: "Yes, for YouTube and web videos",
    netflix: "With its extension",
    crunchyroll: "With its extension",
    calls: "Voice, 1 hour a day free",
    price: "Free; Plus $3.99/month",
    summary:
      "Free rooms with no account for YouTube, Twitch and other web videos, on computers and phones. Its desktop extension (Chrome, Firefox, Safari, Edge) adds Netflix, Disney+, HBO Max, Prime Video, Hulu, Paramount+, Peacock, Apple TV+ and Crunchyroll. Voice chat is built in: an hour a day and rooms of up to 5 on the free plan; Plus ($3.99 a month or $39.99 a year) lifts the voice limit and raises rooms to 50. It doesn't describe video chat.",
    sources: [
      { href: "https://syncup.tv/faq", label: "SyncUp FAQ" },
      { href: "https://syncup.tv/extension", label: "SyncUp extension page" },
      { href: "https://syncup.tv/plus", label: "SyncUp Plus page" },
    ],
  },
  watch2gether: {
    id: "watch2gether",
    name: "Watch2Gether",
    tagline: "YouTube rooms with no account",
    href: "/guides/watch2gether-alternatives-for-anime",
    hrefLabel: "Watch2Gether alternatives",
    runs: "Website, no account",
    phones: "In the browser",
    netflix: "Listed, via its extension",
    crunchyroll: "Not named",
    calls: "Webcams and text chat",
    price: "Free",
    summary:
      "Make a room without signing up, share the link and queue YouTube, Vimeo and more, with text chat and webcams. Watch2Gether says Netflix, Amazon and Disney+ are also supported, through its browser extension for Chrome, Firefox, Opera and Edge. It's free.",
    sources: [{ href: "https://w2g.tv/en/", label: "Watch2Gether home page" }],
  },
  rave: {
    id: "rave",
    name: "Rave",
    tagline: "an app for Android and computers",
    href: "/guides/rave-alternatives-for-youtube",
    hrefLabel: "Rave alternatives",
    runs: "App",
    phones: "Android; off Apple's App Store",
    netflix: "yes",
    crunchyroll: "yes",
    calls: "Talk and text",
    price: "Free with ads; Premium removes ads",
    summary:
      "Rave's FAQ lists YouTube, Netflix, Prime Video, Disney+, HBO Max, Crunchyroll and more, talk and text chat, no limit on group size, and a free app with ads. It has apps for Android, Windows, Mac, Linux and Chromebook. Its FAQ still lists iPhone and iPad, but a notice on rave.io says Apple removed Rave from the App Store. Rented or bought YouTube and Amazon titles aren't supported.",
    sources: [
      { href: "https://rave.io/faq", label: "Rave FAQ" },
      { href: "https://rave.io/", label: "Rave home page (App Store notice)" },
    ],
  },
  discord: {
    id: "discord",
    name: "Discord",
    tagline: "the call, not the video",
    href: "/discord-watch-party",
    hrefLabel: "Discord watch party",
    runs: "Desktop and phone app",
    phones: "yes",
    netflix: "Screen share often shows black",
    crunchyroll: "Screen share often shows black",
    calls: "Voice and video, free",
    price: "Free",
    summary:
      "Discord's Watch Together activity plays YouTube only, and a Go Live share of Netflix or other paid services usually shows a black screen. Keep the voice call in Discord and sync the video with an app made for it.",
    sources: [
      {
        href: "https://support-apps.discord.com/hc/en-us/articles/26502500234519-Watch-Together-FAQ",
        label: "Discord Watch Together FAQ (22 Nov)",
      },
    ],
  },
  hyperbeam: {
    id: "hyperbeam",
    name: "Hyperbeam",
    tagline: "a shared browser",
    href: "/compare/anidachi-vs-hyperbeam",
    hrefLabel: "Hyperbeam alternatives",
    runs: "Shared cloud browser",
    phones: "Not stated",
    netflix: "Not stated",
    crunchyroll: "Not stated",
    calls: "Audio and video",
    price: "Free start; price not shown",
    summary:
      "Everyone sees and controls one cloud browser, with audio and video calling. Its watch party app now lives at watch.hyperbeam.com, while hyperbeam.com sells its virtual browser to developers. The page offers a free start but shows no price and doesn't list which streaming sites play.",
    sources: [
      { href: "https://watch.hyperbeam.com/", label: "Hyperbeam watch party app" },
      { href: "https://hyperbeam.com/", label: "Hyperbeam home page" },
    ],
  },
  metastream: {
    id: "metastream",
    name: "Metastream",
    tagline: "a shared queue for web videos",
    href: "/compare/anidachi-vs-metastream",
    hrefLabel: "Metastream alternatives",
    runs: "App with a shared queue",
    phones: "Not stated",
    netflix: "Not stated",
    crunchyroll: "Not stated",
    calls: "Text chat",
    price: "No price shown",
    summary:
      "Watch or listen to streaming media together from a shared queue, with chat and timestamp markers. Its site says popular websites are supported without naming them, and shows no price or release date.",
    sources: [{ href: "https://getmetastream.com/", label: "Metastream home page" }],
  },
  syncplay: {
    id: "syncplay",
    name: "Syncplay",
    tagline: "for video files you already have",
    href: "/compare#syncplay",
    hrefLabel: "Syncplay in the watch party app comparison",
    runs: "Desktop app for video files",
    phones: "no",
    netflix: "no",
    crunchyroll: "no",
    calls: "Use a separate voice app",
    price: "Free, open source",
    summary:
      "Free, open-source software that syncs pause, play and seek between desktop media players such as mpv, VLC and IINA on Windows, macOS and Linux, so everyone needs the same file. No streaming services and no built-in voice: its site suggests running it alongside a voice app. Version 1.7.6 came out on 4 Aug 2026.",
    sources: [{ href: "https://syncplay.pl/", label: "Syncplay home page" }],
  },
  /** Not ranked on /compare: its site no longer describes a watch party app. */
  kast: {
    id: "kast",
    name: "Kast",
    tagline: "status unclear",
    href: "/guides/kast-alternatives-for-youtube",
    hrefLabel: "Kast alternatives",
    runs: "Not described on its site now",
    phones: "Not stated",
    netflix: "Not stated",
    crunchyroll: "Not stated",
    calls: "Not stated",
    price: "Not stated",
    summary:
      "kast.gg now says Kast is joining the Amaze family and asks for an email to hear what's next. It doesn't describe a watch party app or say whether existing rooms still work.",
    sources: [{ href: "https://kast.gg/", label: "Kast home page" }],
  },
};

export function watchPartyApps(ids: WatchPartyAppId[]): WatchPartyApp[] {
  return ids.map((id) => WATCH_PARTY_APPS[id]);
}

/** Sources for a set of apps, without duplicates, in the order given. */
export function watchPartySources(ids: WatchPartyAppId[]) {
  const seen = new Set<string>();
  return watchPartyApps(ids)
    .flatMap((app) => app.sources)
    .filter((source) => (seen.has(source.href) ? false : (seen.add(source.href), true)));
}
