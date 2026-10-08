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
  title: "Watch Netflix Together — Same Title, Own Accounts",
  description:
    "Watch Netflix together from two computers: the same movie or episode, each person signed into Netflix. AniDachi is adding this for desktop Chrome. It is not on the public extension yet.",
  alternates: { canonical: "/guides/watch-netflix-together" },
  openGraph: {
    title: "Watch Netflix Together",
    description: "Two accounts, one title, playback that stays together.",
    url: "/guides/watch-netflix-together",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Watch Netflix Together",
    description: "The setup for watching Netflix at the same time.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "Can two people watch Netflix together?",
    answer:
      "Yes, if each person has Netflix and you keep the same title in sync. Netflix does not offer that sync itself.",
  },
  {
    question: "Is this different from how to watch Netflix together?",
    answer:
      "This page is the setup. The numbered steps are on how to watch Netflix together.",
  },
  {
    question: "Does long distance change it?",
    answer:
      "The accounts are the same. The existing long-distance page is watch Netflix together long distance. AniDachi Netflix rooms are still coming.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "setup", label: "The setup", level: 2 },
  { id: "steps", label: "Where the steps are", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function WatchNetflixTogetherPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Netflix watch party", url: "/netflix-watch-party" },
        { name: "Watch Netflix together", url: "/guides/watch-netflix-together" },
      ]}
      title="Watch Netflix together"
      description="Watch the same Netflix title from two accounts."
      url="/guides/watch-netflix-together"
      datePublished="2026-10-08"
      dateModified="2026-10-08"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
    >
      <SeoGuideTitle>Watch Netflix together</SeoGuideTitle>
      <SeoGuideAnswer id="answer">
        <p>
          Watch Netflix together means both of you are on the same movie or
          episode at the same time, each signed into Netflix. A{" "}
          <Link href="/netflix-watch-party">Netflix watch party</Link> is that
          night. AniDachi’s version for desktop Chrome is not on the public
          extension yet.
        </p>
      </SeoGuideAnswer>
      <h2 id="setup" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        What has to match
      </h2>
      <SeoGuideBulletList
        items={[
          {
            title: "The title",
            body: "Same movie or same episode. A different season puts you on different scenes.",
          },
          {
            title: "The account",
            body: "Each computer signs into Netflix. One person cannot play the title through the other person’s login inside AniDachi.",
          },
          {
            title: "The browser",
            body: "Desktop Chrome. The Netflix phone app is a different player.",
          },
        ]}
      />
      <h2 id="steps" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        The click-by-click version
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        Numbered steps are on{" "}
        <Link
          href="/guides/how-to-watch-netflix-together"
          className="text-brand-orange hover:underline"
        >
          how to watch Netflix together
        </Link>
        . Friends, rather than one other person, are on{" "}
        <Link
          href="/guides/how-to-watch-netflix-with-friends"
          className="text-brand-orange hover:underline"
        >
          how to watch Netflix with friends
        </Link>
        . Distance is already covered on{" "}
        <Link
          href="/watch-netflix-together-long-distance"
          className="text-brand-orange hover:underline"
        >
          watch Netflix together long distance
        </Link>
        .
      </p>
      <SeoGuideRelated
        links={[
          { href: "/netflix-watch-party", label: "Netflix watch party" },
          {
            href: "/guides/how-to-watch-netflix-together",
            label: "How to watch Netflix together",
          },
          {
            href: "/watch-netflix-together-long-distance",
            label: "Watch Netflix together long distance",
          },
        ]}
      />
    </SeoPageLayout>
  );
}
