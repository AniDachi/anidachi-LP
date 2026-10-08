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
  title: "Online Date Ideas — Two Computers, One Evening",
  description:
    "Online date ideas from two computers: a call, one shared activity, and an optional Crunchyroll episode or YouTube movie synced with AniDachi.",
  alternates: { canonical: "/guides/online-date-ideas" },
  openGraph: {
    title: "Online Date Ideas",
    description: "Dates that happen from two browsers, with a clear ending.",
    url: "/guides/online-date-ideas",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Online Date Ideas",
    description: "One activity on two computers, then stop.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "What are online date ideas?",
    answer:
      "Something you both do at the same time from your own computers: cook, play a short game, or watch one episode. Stay on a call for voice.",
  },
  {
    question: "How is this different from virtual date ideas?",
    answer:
      "Virtual date ideas is the broader list, including a long-distance relationship. This page is the version that happens in two browser windows.",
  },
  {
    question: "Can the online date be a movie?",
    answer:
      "Yes, on YouTube or Crunchyroll, each person on their own account, in desktop Chrome. Netflix is coming soon and is not supported yet. Disney+, Hulu, and Prime are not supported.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "ideas", label: "Ideas from two computers", level: 2 },
  { id: "watch", label: "When the date is a watch", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function OnlineDateIdeasPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        {
          name: "Watch movies long distance",
          url: "/watch-movies-together-long-distance",
        },
        { name: "Online date ideas", url: "/guides/online-date-ideas" },
      ]}
      title="Online date ideas"
      description="Dates from two computers, including one synced watch."
      url="/guides/online-date-ideas"
      datePublished="2026-10-08"
      dateModified="2026-10-08"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
    >
      <SeoGuideTitle>Online date ideas from two computers</SeoGuideTitle>
      <SeoGuideAnswer>
        <p>
          An online date is one activity you both start from your own
          computer, with a call already open and a time to stop. The wider
          list is{" "}
          <Link href="/guides/virtual-date-ideas">virtual date ideas</Link>.
          The film version of the night is{" "}
          <Link href="/watch-movies-together-long-distance">
            watch movies together long distance
          </Link>
          .
        </p>
      </SeoGuideAnswer>
      <h2 id="ideas" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Ideas that fit two browsers
      </h2>
      <SeoGuideBulletList
        items={[
          {
            title: "The same recipe",
            body: "Open the recipe on both screens, cook, and eat on the call. End when the plates are done.",
          },
          {
            title: "One episode",
            body: "Same title, same audio, each person on their own Crunchyroll or YouTube account. AniDachi keeps the moment together.",
          },
          {
            title: "A short game",
            body: "Twenty minutes. A second unplanned activity makes the date longer than you agreed.",
          },
        ]}
      />
      <h2 id="watch" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        When the online date is a watch
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        Use desktop Chrome. Voice stays on FaceTime or Discord. Install
        AniDachi from{" "}
        <Link href="/extension" className="text-brand-orange hover:underline">
          /extension
        </Link>
        . A single evening built around the movie is{" "}
        <Link
          href="/guides/long-distance-date-night-ideas"
          className="text-brand-orange hover:underline"
        >
          long distance date night ideas
        </Link>
        . More activities are on{" "}
        <Link
          href="/guides/things-to-do-long-distance"
          className="text-brand-orange hover:underline"
        >
          things to do long distance
        </Link>
        .
      </p>
      <SeoGuideRelated
        links={[
          { href: "/guides/virtual-date-ideas", label: "Virtual date ideas" },
          {
            href: "/watch-movies-together-long-distance",
            label: "Watch movies long distance",
          },
          {
            href: "/guides/long-distance-date-night-ideas",
            label: "Long distance date night ideas",
          },
        ]}
      />
    </SeoPageLayout>
  );
}
