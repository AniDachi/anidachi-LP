/** Mid-funnel genre hub routes — keep in sync with `lib/sitemap-discovery.ts` priority list. */
export const GENRE_HUB_LINKS = [
  {
    href: "/watch-action-anime-with-friends",
    label: "Watch action anime with friends",
  },
  {
    href: "/watch-romance-anime-with-friends",
    label: "Watch romance anime with friends",
  },
  {
    href: "/watch-comedy-anime-with-friends",
    label: "Watch comedy anime with friends",
  },
  {
    href: "/watch-sports-anime-with-friends",
    label: "Watch sports anime with friends",
  },
  {
    href: "/watch-mystery-anime-with-friends",
    label: "Watch mystery anime with friends",
  },
  {
    href: "/watch-isekai-anime-with-friends",
    label: "Watch isekai anime with friends",
  },
  {
    href: "/watch-psychological-anime-with-friends",
    label: "Watch psychological anime with friends",
  },
  {
    href: "/watch-horror-anime-with-friends",
    label: "Watch horror anime with friends",
  },
  {
    href: "/watch-slice-of-life-anime-with-friends",
    label: "Watch slice of life anime with friends",
  },
  {
    href: "/watch-mecha-anime-with-friends",
    label: "Watch mecha anime with friends",
  },
  {
    href: "/watch-fantasy-anime-with-friends",
    label: "Watch fantasy anime with friends",
  },
  {
    href: "/watch-sci-fi-anime-with-friends",
    label: "Watch sci-fi anime with friends",
  },
  {
    href: "/watch-shoujo-anime-with-friends",
    label: "Watch shoujo anime with friends",
  },
  {
    href: "/watch-supernatural-anime-with-friends",
    label: "Watch supernatural anime with friends",
  },
] as const;

/** ItemList JSON-LD entries for pillar/toolkit pages. */
export function genreHubItemList(
  startPosition = 1
): { name: string; url: string; position: number }[] {
  return GENRE_HUB_LINKS.map((hub, i) => ({
    name: hub.label,
    url: hub.href,
    position: startPosition + i,
  }));
}
