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
  title: "Long Distance Date Night Ideas — One Movie or Episode",
  description:
    "Long distance date night ideas for one evening: a call, a meal, and one YouTube movie or Crunchyroll episode synced with AniDachi on your own accounts.",
  alternates: { canonical: "/guides/long-distance-date-night-ideas" },
  openGraph: {
    title: "Long Distance Date Night Ideas",
    description: "One evening, one film or episode, then stop.",
    url: "/guides/long-distance-date-night-ideas",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Long Distance Date Night Ideas",
    description: "Build the night around one watch.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "What is a long distance date night?",
    answer:
      "One planned evening in both time zones. A call stays open. You eat, or you watch one movie or episode, and you stop when that is done.",
  },
  {
    question: "What should we watch?",
    answer:
      "A YouTube movie or a Crunchyroll episode, each person on their own account in desktop Chrome. AniDachi keeps playback together. Netflix is coming soon and is not supported yet.",
  },
  {
    question: "Is this the anime date night list?",
    answer:
      "No. Anime-only evenings stay on long distance anime date night ideas. This page is the evening itself, whether the watch is a film or an episode.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "evening", label: "One evening", level: 2 },
  { id: "anime", label: "When the night is anime", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function LongDistanceDateNightIdeasPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        {
          name: "Watch movies long distance",
          url: "/watch-movies-together-long-distance",
        },
        {
          name: "Long distance date night ideas",
          url: "/guides/long-distance-date-night-ideas",
        },
      ]}
      title="Long distance date night ideas"
      description="One evening built around a movie or episode."
      url="/guides/long-distance-date-night-ideas"
      datePublished="2026-10-08"
      dateModified="2026-10-08"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
    >
      <SeoGuideTitle>Long distance date night ideas for one evening</SeoGuideTitle>
      <h2 id="answer" className="scroll-mt-24">
        Short answer
      </h2>
      <SeoGuideAnswer>
        <p>
          A long distance date night is one block of time, not a list of apps.
          Put it on the calendar in both time zones. Watch one YouTube movie
          or one Crunchyroll episode, and use{" "}
          <Link href="/watch-movies-together-long-distance">
            watch movies together long distance
          </Link>{" "}
          when the film is the whole plan.
        </p>
      </SeoGuideAnswer>
      <h2 id="evening" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        How to spend the evening
      </h2>
      <SeoGuideBulletList
        items={[
          {
            title: "Start the call first",
            body: "FaceTime or Discord stays up for voices. Do not add a second call halfway through.",
          },
          {
            title: "Eat, or watch, not both as a surprise",
            body: "If dinner is the start, finish eating before the movie. Two activities only work if you planned both.",
          },
          {
            title: "One title",
            body: "Same episode or the same YouTube movie, each person on their own account. AniDachi keeps the picture in step.",
          },
        ]}
      />
      <h2 id="anime" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        When the date night is anime
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        Anime evenings stay on{" "}
        <Link
          href="/long-distance-anime-date-night-ideas"
          className="text-brand-orange hover:underline"
        >
          long distance anime date night ideas
        </Link>
        . This page is the shape of the night. Other online dates are on{" "}
        <Link
          href="/guides/online-date-ideas"
          className="text-brand-orange hover:underline"
        >
          online date ideas
        </Link>
        . Install from{" "}
        <Link href="/extension" className="text-brand-orange hover:underline">
          /extension
        </Link>
        . Netflix is coming soon and is not part of the AniDachi watch yet.
      </p>
      <SeoGuideRelated
        links={[
          {
            href: "/watch-movies-together-long-distance",
            label: "Watch movies long distance",
          },
          {
            href: "/guides/watch-movies-together-online",
            label: "Watch movies together online",
          },
          {
            href: "/long-distance-anime-date-night-ideas",
            label: "Long distance anime date night ideas",
          },
        ]}
      />
    </SeoPageLayout>
  );
}
