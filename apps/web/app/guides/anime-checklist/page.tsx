import type { Metadata } from "next";
import Link from "next/link";
import {
  SeoGuideAnswer,
  SeoGuideBulletList,
  SeoGuideRelated,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const articleImage = `${getResolvedSiteOrigin()}/opengraph-image.png`;

export const metadata: Metadata = {
  title: "Anime Checklist — Mark Titles You Actually Finished",
  description:
    "An anime checklist is the titles you mean to finish. Check one off when AniDachi has the episode from your Crunchyroll or YouTube player.",
  alternates: { canonical: "/guides/anime-checklist" },
  openGraph: {
    title: "Anime Checklist",
    description: "Finish the episode, then check the title off.",
    url: "/guides/anime-checklist",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Anime Checklist",
    description: "A completion list tied to saved episodes.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "How do I use an anime checklist?",
    answer:
      "List the titles you intend to finish. Open each one on your own Crunchyroll or YouTube account. Plus or Pro can save the episode so you know it is done.",
  },
  {
    question: "Should I check a title off when I add it?",
    answer:
      "No. Adding it only means you plan to watch. Check it off after you have played it.",
  },
  {
    question: "Is this a ranked list of the best anime?",
    answer:
      "No. A checklist is personal. Group picks live on best anime to watch with friends.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "use", label: "How to check a title off", level: 2 },
  { id: "episode", label: "Episode checklist", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function AnimeChecklistPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Anime tracker", url: "/anime-tracker" },
        { name: "Anime checklist", url: "/guides/anime-checklist" },
      ]}
      title="Anime checklist"
      description="A personal completion list tied to saved episodes."
      url="/guides/anime-checklist"
      datePublished="2026-09-27"
      dateModified="2026-09-27"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
    >
      <SeoGuideTitle>Anime checklist for titles you finish</SeoGuideTitle>
      <SeoGuideAnswer>
        <p>
          An anime checklist is the short set of titles you mean to complete.
          Check one off after you have played it on Crunchyroll or YouTube.{" "}
          <Link href="/anime-tracker">AniDachi</Link> can save that episode on
          Plus or Pro so the box matches the player, not a guess.
        </p>
      </SeoGuideAnswer>
      <h2 id="use" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        How to check a title off
      </h2>
      <SeoGuideBulletList
        items={[
          {
            title: "Write the titles first",
            body: "Keep the list small enough that you remember why each one is on it.",
          },
          {
            title: "Play it yourself",
            body: "Use your own account in desktop Chrome. A room link is not the same as watching.",
          },
          {
            title: "Then mark it",
            body: "Plus or Pro records progress. Free can open saved history and Resume.",
          },
        ]}
      />
      <h2 id="episode" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        An episode checklist, not a public ranking
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        A series checklist fails when you only remember the title. Note the
        episode you reached. Friends do not share that list. If you are still
        deciding what to start, use the{" "}
        <Link
          href="/guides/animes-to-watch-list"
          className="text-brand-orange hover:underline"
        >
          animes to watch list
        </Link>
        . After you have watched, the{" "}
        <Link
          href="/guides/anime-diary"
          className="text-brand-orange hover:underline"
        >
          anime diary
        </Link>{" "}
        is the place for the date and a note. Install from{" "}
        <Link href="/extension" className="text-brand-orange hover:underline">
          /extension
        </Link>
        .
      </p>
      <SeoGuideRelated
        links={[
          { href: "/anime-tracker", label: "Anime tracker" },
          { href: "/guides/anime-diary", label: "Anime diary" },
          {
            href: "/guides/best-anime-to-watch-with-friends",
            label: "Best anime to watch with friends",
          },
        ]}
      />
    </SeoPageLayout>
  );
}
