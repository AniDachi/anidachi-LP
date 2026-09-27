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
  title: "Anime Diary — What You Watched, Saved From the Player",
  description:
    "An anime diary records what you played. AniDachi saves the Crunchyroll episode or YouTube video on Plus or Pro. It is not a public profile.",
  alternates: { canonical: "/guides/anime-diary" },
  openGraph: {
    title: "Anime Diary",
    description: "A private record of the episode you actually opened.",
    url: "/guides/anime-diary",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Anime Diary",
    description: "Save the episode you played, then write the rest yourself.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "What is an anime diary?",
    answer:
      "A personal record of titles you started, the episode you reached, and anything you want to remember. AniDachi fills in the episode from your own Crunchyroll or YouTube player when you are on Plus or Pro.",
  },
  {
    question: "Does AniDachi publish my diary?",
    answer:
      "No. Progress stays on your account. Friends in a watchroom do not share one history.",
  },
  {
    question: "Can I diary a title I have not started?",
    answer:
      "Keep those on an animes to watch list. The diary should be what you have already opened and played.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "write", label: "What you write", level: 2 },
  { id: "saved", label: "What the player saves", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function AnimeDiaryPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Anime tracker", url: "/anime-tracker" },
        { name: "Anime diary", url: "/guides/anime-diary" },
      ]}
      title="Anime diary"
      description="A private record of Crunchyroll and YouTube progress."
      url="/guides/anime-diary"
      datePublished="2026-09-27"
      dateModified="2026-09-27"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
    >
      <SeoGuideTitle>Anime diary for what you actually played</SeoGuideTitle>
      <SeoGuideAnswer>
        <p>
          An anime diary is your own record of what you watched.{" "}
          <Link href="/anime-tracker">AniDachi’s anime tracker</Link> saves the
          Crunchyroll episode or YouTube video that was open in desktop Chrome.
          Notes about how you felt stay yours. The page is not a public list.
        </p>
      </SeoGuideAnswer>
      <h2 id="write" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        What to write in the diary
      </h2>
      <SeoGuideBulletList
        items={[
          {
            title: "The title and the date",
            body: "Enough to find the night later. A mood or a line you liked can sit next to it.",
          },
          {
            title: "Where you stopped",
            body: "Episode number, or the YouTube video. That is the part the player can fill in.",
          },
          {
            title: "Leave unstarted titles off",
            body: "A diary of intentions turns into a backlog. Queue those separately.",
          },
        ]}
      />
      <h2 id="saved" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        A written diary versus a saved episode
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        Writing “episode 4” in a note can drift from the player. Plus or Pro
        records the place from the tab you have open. Free can still open saved
        history and Resume. Adding a title to a note does not mark it watched,
        and a friend’s room does not write into your diary.
      </p>
      <p className="mb-6 leading-relaxed text-ani-muted">
        Start the queue on the{" "}
        <Link
          href="/guides/animes-to-watch-list"
          className="text-brand-orange hover:underline"
        >
          animes to watch list
        </Link>
        , then install from{" "}
        <Link href="/extension" className="text-brand-orange hover:underline">
          /extension
        </Link>
        . A finish checklist is on the{" "}
        <Link
          href="/guides/anime-checklist"
          className="text-brand-orange hover:underline"
        >
          anime checklist
        </Link>
        .
      </p>
      <SeoGuideRelated
        links={[
          { href: "/anime-tracker", label: "Anime tracker" },
          { href: "/guides/animes-to-watch-list", label: "Animes to watch list" },
          { href: "/guides/anime-checklist", label: "Anime checklist" },
        ]}
      />
    </SeoPageLayout>
  );
}
