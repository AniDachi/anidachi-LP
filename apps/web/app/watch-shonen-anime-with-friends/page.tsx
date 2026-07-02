import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { animeList, getAnimeByGenre, type AnimeEntry } from "@/lib/anime-data";

export const metadata: Metadata = {
  title: "Watch Shonen Anime With Friends (2026) | AniDachi",
  description:
    "Watch shonen anime with friends on Crunchyroll — Demon Slayer, Jujutsu Kaisen, Haikyuu, Hunter x Hunter, and more. Synced watchrooms with spoiler-safe chat and async catch-up.",
  alternates: { canonical: "/watch-shonen-anime-with-friends" },
  openGraph: {
    title: "Watch Shonen Anime With Friends (2026) | AniDachi",
    description:
      "Group watchroom guides for shonen anime on Crunchyroll — battles, sports rivalries, and long-run marathons.",
    url: "/watch-shonen-anime-with-friends",
  },
};

const SHONEN_EXTRA_SLUGS = [
  "demon-slayer",
  "jujutsu-kaisen",
  "my-hero-academia",
  "one-punch-man",
  "mob-psycho-100",
  "haikyuu",
  "blue-lock",
  "hunter-x-hunter",
  "naruto",
  "one-piece",
  "bleach",
  "fullmetal-alchemist-brotherhood",
  "chainsaw-man",
  "solo-leveling",
  "black-clover",
  "fire-force",
  "assassination-classroom",
  "yu-yu-hakusho",
  "dragon-ball-super",
  "dragon-ball-z",
];

function getShonenHubAnime(): AnimeEntry[] {
  const seen = new Set<string>();
  const result: AnimeEntry[] = [];

  for (const genre of ["shonen", "shounen"]) {
    for (const anime of getAnimeByGenre(genre)) {
      if (!seen.has(anime.slug)) {
        seen.add(anime.slug);
        result.push(anime);
      }
    }
  }

  for (const slug of SHONEN_EXTRA_SLUGS) {
    if (seen.has(slug)) continue;
    const anime = animeList.find((a) => a.slug === slug);
    if (anime) {
      seen.add(slug);
      result.push(anime);
    }
  }

  return result.sort((a, b) => a.title.localeCompare(b.title));
}

const faq = [
  {
    question: "What is the best shonen anime to watch with friends?",
    answer:
      "Haikyuu!! is the top pick for most groups — 85 episodes of sports rivalry with intuitive stakes and natural session breaks after each match. Demon Slayer is the best first shonen for groups who want stunning animation in 26 episodes. Hunter x Hunter (148 episodes) is the strongest choice for groups ready for a long-run commitment with zero filler.",
  },
  {
    question: "How do we watch long shonen series like One Piece without spoilers?",
    answer:
      "Pin a safe episode marker in your AniDachi watchroom and use async mode so members who binge ahead post episode-tagged reactions instead of spoiling fight outcomes. Agree on a weekly episode count (3–4 episodes) and skip filler arcs with a shared filler guide.",
  },
  {
    question: "Is shonen anime good for groups new to anime?",
    answer:
      "Yes — shonen conflicts are intuitive (training, rivalry, teamwork). Demon Slayer (26 episodes), Jujutsu Kaisen (24 episodes), and Haikyuu!! work well for mixed groups because the visual spectacle keeps non-fans engaged even when lore context is thin.",
  },
  {
    question: "Can we sync hype reactions for big shonen fight episodes?",
    answer:
      "Yes — schedule a live watchroom session for finale fights and transformation scenes. AniDachi keeps everyone at the same timestamp so nobody auto-plays ahead. Use voice or text chat for real-time reactions during the episode.",
  },
  {
    question: "Do we all need Crunchyroll to watch shonen anime together?",
    answer:
      "Yes — each person needs their own active Crunchyroll subscription to stream. AniDachi adds the watchroom, sync, and chat layer on top.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "why-shonen", label: "Why shonen for groups?", level: 2 },
  { id: "top-picks", label: "Shonen anime to watch together", level: 2 },
  { id: "setup", label: "How to set up your watchroom", level: 2 },
  { id: "spoilers", label: "Spoiler strategy", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function WatchShonenAnimeWithFriendsPage() {
  const shonenAnime = getShonenHubAnime();

  const itemList = shonenAnime.map((anime, i) => ({
    name: `Watch ${anime.title} with friends`,
    url: `/watch/${anime.slug}-with-friends`,
    position: i + 1,
  }));

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Watch Anime Together", url: "/watch-anime-together" },
        { name: "Shonen Anime", url: "/watch-shonen-anime-with-friends" },
      ]}
      title="Watch Shonen Anime With Friends (2026) | AniDachi"
      description="Group watchroom guides for shonen anime on Crunchyroll."
      url="/watch-shonen-anime-with-friends"
      datePublished="2026-07-02"
      dateModified="2026-07-02"
      faq={faq}
      headings={tocHeadings}
      itemList={itemList}
      aboveFoldCta
    >
      <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
        Watch Shonen Anime With Friends
      </h1>

      <h2
        id="answer"
        className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
      >
        Short Answer
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-8">
        <strong>
          Shonen is built for group reactions — install AniDachi, open any
          Crunchyroll series below, and create a watchroom. Sync battles live or
          catch up asynchronously when schedules diverge.
        </strong>{" "}
        Each person streams from their own Crunchyroll account at full quality.
      </p>

      <h2
        id="why-shonen"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Why Is Shonen Anime Perfect for Group Watching?
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-4">
        Shonen anime centers on rivalry, training arcs, and payoff fights that
        land hardest when someone else is watching. Weekly episode drops create
        natural club cadence, and tournament or sports structures give groups
        prediction games before every match.
      </p>
      <p className="text-foreground/80 leading-relaxed mb-8">
        AniDachi watchrooms support live sync for premiere nights and async
        catch-up for long-run series like One Piece or Naruto — so nobody falls
        permanently behind the club.
      </p>

      <h2
        id="top-picks"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Shonen Anime to Watch Together — Full List
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-4">
        All {shonenAnime.length} titles below have dedicated watchroom guides
        with setup steps, pacing advice, and spoiler tips:
      </p>
      <ul className="grid grid-cols-2 gap-2 text-brand-orange mb-8">
        {shonenAnime.map((anime) => (
          <li key={anime.slug}>
            <Link
              href={`/watch/${anime.slug}-with-friends`}
              className="hover:underline"
            >
              {anime.title}
            </Link>
          </li>
        ))}
      </ul>

      <h2
        id="setup"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        How to Set Up a Shonen Watchroom
      </h2>
      <ol className="list-decimal pl-6 space-y-2 text-foreground/80 mb-8">
        <li>
          <span className="font-medium text-foreground">Install AniDachi</span>{" "}
          on every device in your watch group.
        </li>
        <li>
          <span className="font-medium text-foreground">Open the series on Crunchyroll</span>{" "}
          — each person uses their own account.
        </li>
        <li>
          <span className="font-medium text-foreground">Create a watchroom and share the link.</span>
        </li>
        <li>
          <span className="font-medium text-foreground">Agree on live or async pacing</span>{" "}
          — live for finales, async for weekly club episodes.
        </li>
        <li>
          <span className="font-medium text-foreground">Pin your spoiler boundary</span>{" "}
          at the safe episode number before anyone posts fight outcomes.
        </li>
      </ol>

      <h2
        id="spoilers"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        How to Avoid Spoilers in Shonen Watchrooms
      </h2>
      <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-8">
        <li>Use feelings-only reactions until everyone clears the same episode.</li>
        <li>Tag every message with an episode number for late viewers.</li>
        <li>Skip filler arcs with a shared guide for One Piece, Naruto, and Bleach.</li>
        <li>Run episode predictions before fights — wrong guesses are half the fun.</li>
      </ul>

      <p className="text-foreground/80 mb-4">
        Browse more:{" "}
        <Link href="/guides/best-shonen-anime-to-watch-with-friends" className="text-brand-orange hover:underline">
          Best shonen anime listicle
        </Link>
        {" · "}
        <Link href="/watch-action-anime-with-friends" className="text-brand-orange hover:underline">
          Action anime hub
        </Link>
        {" · "}
        <Link href="/watch-sports-anime-with-friends" className="text-brand-orange hover:underline">
          Sports anime hub
        </Link>
        {" · "}
        <Link href="/anime-watch-party" className="text-brand-orange hover:underline">
          Anime watch party guide
        </Link>
      </p>
    </SeoPageLayout>
  );
}
