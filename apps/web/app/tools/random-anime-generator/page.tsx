import type { Metadata } from "next";
import { SeoGuideAnswer, SeoGuideRelated, SeoGuideTitle } from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { AnimeSpin, type SpinEntry, type SpinLength } from "@/components/tools/anime-spin";
import { ToolWebAppJsonLd } from "@/components/tools/tool-json-ld";
import { animeList, isMovieEntry } from "@/lib/anime-data";
import { getCachedJikanEntry } from "@/lib/anime-jikan-cache";
import { getSeoSiteOrigin } from "@/lib/site-url";

const url = "/tools/random-anime-generator";
const headingClass = "mt-12 mb-3 scroll-mt-24 text-2xl font-bold tracking-[-0.02em] text-ani-text";

function lengthOf(episodes: string): SpinLength {
  const count = Number(episodes.match(/\d+/)?.[0] ?? Number.NaN);
  if (!Number.isFinite(count)) return "medium";
  if (count <= 26) return "short";
  if (count <= 100) return "medium";
  return "long";
}

const entries: SpinEntry[] = animeList
  .filter((anime) => !isMovieEntry(anime))
  .map((anime) => ({
    slug: anime.slug,
    title: anime.title,
    episodes: anime.episodes,
    genres: anime.genres.slice(0, 3).join(", "),
    length: lengthOf(anime.episodes),
    posterUrl: getCachedJikanEntry(anime.slug)?.posterUrl ?? null,
  }));

const shortCount = entries.filter((entry) => entry.length === "short").length;

export const metadata: Metadata = {
  title: "Random Anime Generator — What Anime Should I Watch?",
  description: `Spin a random anime from ${entries.length} series, filter by length, then open a guide to watch it with friends on Crunchyroll. Free, no signup.`,
  alternates: { canonical: url },
  openGraph: {
    title: "Random Anime Generator",
    description: "Spin a series, filter by length, then watch episode 1 together.",
    url,
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
};

const faq = [
  {
    question: "What anime should I watch?",
    answer: `Spin the generator. It picks from ${entries.length} series on this site, not a separate catalog. Use the length filter if the group only has one night or wants a long run.`,
  },
  {
    question: "Can I spin only short anime?",
    answer: `Yes. Choose "Up to 26 eps" to spin from ${shortCount} shorter series. Episode counts for airing shows can grow, so check before you commit.`,
  },
  {
    question: "Are these anime on Crunchyroll?",
    answer:
      "The watch guides are written for Crunchyroll in desktop Chrome. A title can leave a region, so check that everyone can open it before you start.",
  },
  {
    question: "How do we start episode 1 together?",
    answer:
      "One person hosts with Plus or Pro, including a trial. Friends join free. Everyone opens the same episode in desktop Chrome. AniDachi syncs the room. It does not re-stream the video.",
  },
];

const headings: TocHeading[] = [
  { id: "spin", label: "Spin", level: 2 },
  { id: "what-to-watch", label: "What anime should I watch?", level: 2 },
  { id: "related", label: "Related", level: 2 },
];

export default function RandomAnimeGeneratorPage() {
  return (
    <>
      <ToolWebAppJsonLd
        name="Random anime generator"
        description="Spin a series from the AniDachi list, filter by length, then watch it together on Crunchyroll."
        url={url}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Watch anime together", url: "/watch-anime-together" },
          { name: "Random anime generator", url },
        ]}
        title="Random anime generator"
        description="Spin a series from the AniDachi list, filter by length, then watch it together on Crunchyroll."
        url={url}
        datePublished="2026-10-09"
        dateModified="2026-10-11"
        faq={faq}
        headings={headings}
        articleImage={`${getSeoSiteOrigin()}/opengraph-image.png`}
      >
        <SeoGuideTitle>Random anime generator</SeoGuideTitle>
        <SeoGuideAnswer>
          <p>
            Spin a series from <strong>{entries.length} anime</strong> with watch guides on this
            site. Filter by length, spin until it fits the group, then open the guide to watch it
            together.
          </p>
        </SeoGuideAnswer>

        <h2 id="spin" className="sr-only">
          Spin a random anime
        </h2>
        <div className="mb-10">
          <AnimeSpin entries={entries} initialSlug="one-piece" />
        </div>

        <h2 id="what-to-watch" className={headingClass}>
          What anime should I watch?
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Start with length. A short series fits one or two nights. A 100-plus episode show needs a
          weekly slot. The spin skips the show you just saw, and movies are left out.
        </p>
        <p className="mb-8 leading-relaxed text-ani-muted">
          Each person watches on their own Crunchyroll account. AniDachi keeps the room in sync,
          with chat and reactions on the player.
        </p>

        <h2 id="related" className={headingClass}>
          Related
        </h2>
        <SeoGuideRelated
          className="mb-8"
          links={[
            { href: "/watch-anime-together", label: "Watch anime together" },
            { href: "/watch-crunchyroll-together", label: "Crunchyroll watch party" },
            {
              href: "/guides/best-short-anime-to-watch-with-friends",
              label: "Best short anime to watch with friends",
            },
            {
              href: "/tools/one-piece-how-many-episodes",
              label: "How many episodes One Piece has",
            },
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
