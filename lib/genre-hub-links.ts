/** Mid-funnel genre hub routes — keep in sync with `app/sitemap.ts` priority list. */
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
