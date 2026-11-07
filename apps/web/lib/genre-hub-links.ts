/**
 * One genre destination per genre. Genres with a "best X anime" guide link to the guide; their old
 * `/watch-{genre}-anime-with-friends` hubs 308 there (ANI-14). The rest keep their hub page.
 * Keep the hub entries in sync with the `lib/sitemap-discovery.ts` priority list.
 */
export const GENRE_HUB_LINKS = [
  {
    genre: "action",
    href: "/guides/best-action-anime-to-watch-with-friends",
    label: "Best action anime to watch with friends",
  },
  {
    genre: "shonen",
    href: "/guides/best-shonen-anime-to-watch-with-friends",
    label: "Best shonen anime to watch with friends",
  },
  {
    genre: "romance",
    href: "/guides/best-romance-anime-to-watch-with-friends",
    label: "Best romance anime to watch with friends",
  },
  {
    genre: "comedy",
    href: "/guides/best-comedy-anime-to-watch-with-friends",
    label: "Best comedy anime to watch with friends",
  },
  {
    genre: "sports",
    href: "/guides/best-sports-anime-to-watch-with-friends",
    label: "Best sports anime to watch with friends",
  },
  {
    genre: "mystery",
    href: "/watch-mystery-anime-with-friends",
    label: "Watch mystery anime with friends",
  },
  {
    genre: "isekai",
    href: "/guides/best-isekai-anime-to-watch-with-friends",
    label: "Best isekai anime to watch with friends",
  },
  {
    genre: "psychological",
    href: "/guides/best-psychological-anime-to-watch-with-friends",
    label: "Best psychological anime to watch with friends",
  },
  {
    genre: "horror",
    href: "/guides/best-horror-anime-to-watch-with-friends",
    label: "Best horror anime to watch with friends",
  },
  {
    genre: "slice-of-life",
    href: "/guides/best-slice-of-life-anime-to-watch-with-friends",
    label: "Best slice of life anime to watch with friends",
  },
  {
    genre: "mecha",
    href: "/watch-mecha-anime-with-friends",
    label: "Watch mecha anime with friends",
  },
  {
    genre: "fantasy",
    href: "/guides/best-fantasy-anime-to-watch-with-friends",
    label: "Best fantasy anime to watch with friends",
  },
  {
    genre: "sci-fi",
    href: "/guides/best-sci-fi-anime-to-watch-with-friends",
    label: "Best sci fi anime to watch with friends",
  },
  {
    genre: "shoujo",
    href: "/watch-shoujo-anime-with-friends",
    label: "Watch shoujo anime with friends",
  },
  {
    genre: "supernatural",
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
