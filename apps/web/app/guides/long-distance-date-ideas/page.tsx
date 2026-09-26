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
  title: "Long Distance Date Ideas — Watch Together From Two Places",
  description:
    "Long distance date ideas that work on a call. The main plan is a synced Crunchyroll episode or YouTube movie with AniDachi.",
  alternates: { canonical: "/guides/long-distance-date-ideas" },
  openGraph: {
    title: "Long Distance Date Ideas",
    description: "A watch date for couples who are not in the same room.",
    url: "/guides/long-distance-date-ideas",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Long Distance Date Ideas",
    description: "Plan a night around a synced show.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "What is a good long distance date idea?",
    answer:
      "Pick one episode or movie you can both stream, stay on a voice or video call, and sync playback so you react at the same moment. AniDachi does that for Crunchyroll and YouTube.",
  },
  {
    question: "Do we have to be online at the same time?",
    answer:
      "For a live date, yes. AniDachi rooms sync while you are both in them. Async catch-up is planned, not available today.",
  },
  {
    question: "Can we watch Netflix together this way?",
    answer:
      "No. AniDachi syncs Crunchyroll catalog pages and full YouTube watch pages in desktop Chrome. It does not sync Netflix.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "ideas", label: "Ideas", level: 2 },
  { id: "same-search", label: "Same search", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function LongDistanceDateIdeasPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        {
          name: "Watch movies long distance",
          url: "/watch-movies-together-long-distance",
        },
        {
          name: "Long distance date ideas",
          url: "/guides/long-distance-date-ideas",
        },
      ]}
      title="Long distance date ideas"
      description="Date ideas built around watching together."
      url="/guides/long-distance-date-ideas"
      datePublished="2026-09-26"
      dateModified="2026-09-26"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
    >
      <SeoGuideTitle>Long distance date ideas that start with a show</SeoGuideTitle>
      <SeoGuideAnswer>
        <p>
          The date that holds up is a shared episode. Stay on a call, open the
          same Crunchyroll title or YouTube video, and sync it. More ways to
          set that up are on{" "}
          <Link href="/watch-movies-together-long-distance">
            watch movies together long distance
          </Link>
          .
        </p>
      </SeoGuideAnswer>
      <h2 id="ideas" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Ideas
      </h2>
      <SeoGuideBulletList
        items={[
          {
            title: "One episode, then talk",
            body: "A 24-minute episode is long enough for a weeknight and short enough that the call does not die.",
          },
          {
            title: "A YouTube movie",
            body: "Pick a full youtube.com/watch film you can both open. Each person plays it locally.",
          },
          {
            title: "Cook, then press play",
            body: "Make the same simple meal on the call, then start the room when you are both ready to press play.",
          },
        ]}
      />
      <h2 id="same-search" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Date ideas for a long distance relationship
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        “Long distance date ideas” and “date ideas long distance relationship”
        are the same search. A weekly episode is the one that repeats without
        planning a new activity every time. Agree on the series once, then use
        the same room link.
      </p>
      <p className="mb-6 leading-relaxed text-ani-muted">
        Apps that help the rest of the week are on{" "}
        <Link
          href="/guides/apps-for-long-distance-couples"
          className="text-brand-orange hover:underline"
        >
          apps for long distance couples
        </Link>
        . Install AniDachi from{" "}
        <Link href="/extension" className="text-brand-orange hover:underline">
          /extension
        </Link>
        .
      </p>
      <SeoGuideRelated
        links={[
          {
            href: "/watch-movies-together-long-distance",
            label: "Watch movies long distance",
          },
          {
            href: "/long-distance-anime-date-night-ideas",
            label: "Anime date night ideas",
          },
        ]}
      />
    </SeoPageLayout>
  );
}
