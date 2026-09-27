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
  title: "Things to Do Long Distance — Activities That Fit a Call",
  description:
    "Things to do long distance: cook, play, or watch one Crunchyroll episode or YouTube video together. Same ideas as long distance relationship activities.",
  alternates: { canonical: "/guides/things-to-do-long-distance" },
  openGraph: {
    title: "Things to Do Long Distance",
    description: "A few activities that work while you are apart.",
    url: "/guides/things-to-do-long-distance",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Things to Do Long Distance",
    description: "Activities for couples who are not in the same room.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "What are things to do long distance?",
    answer:
      "Pick one shared activity with a start and an end: a meal, a game, or one episode. Stay on a call for voice. Watch Crunchyroll or YouTube on your own accounts if the activity is a show.",
  },
  {
    question: "What are long distance relationship activities?",
    answer:
      "The same set. The relationship label does not change the activity. Keep the list short so the night does not turn into planning.",
  },
  {
    question: "What are long distance activities for couples?",
    answer:
      "Couples can use the same ideas. A synced episode is one activity, not the only one. AniDachi covers Crunchyroll and YouTube in desktop Chrome. It does not sync Netflix.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "do", label: "Things to do", level: 2 },
  { id: "activities", label: "Relationship activities", level: 2 },
  { id: "couples", label: "Activities for couples", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function ThingsToDoLongDistancePage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        {
          name: "Watch movies long distance",
          url: "/watch-movies-together-long-distance",
        },
        {
          name: "Things to do long distance",
          url: "/guides/things-to-do-long-distance",
        },
      ]}
      title="Things to do long distance"
      description="Long distance activities, including one synced episode."
      url="/guides/things-to-do-long-distance"
      datePublished="2026-09-27"
      dateModified="2026-09-27"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
    >
      <SeoGuideTitle>Things to do long distance</SeoGuideTitle>
      <SeoGuideAnswer>
        <p>
          Things to do long distance work when both of you can start and stop
          them on a call. Cook the same thing, play one short game, or watch
          one episode. The film version of that last idea lives on{" "}
          <Link href="/watch-movies-together-long-distance">
            watch movies together long distance
          </Link>
          .
        </p>
      </SeoGuideAnswer>
      <h2 id="do" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        A short list
      </h2>
      <SeoGuideBulletList
        items={[
          {
            title: "Eat the same dinner",
            body: "Order or cook the same dish. Talk until the food is gone, then hang up.",
          },
          {
            title: "Watch one thing",
            body: "A YouTube movie or a Crunchyroll episode, on each person’s account, with AniDachi keeping playback together.",
          },
          {
            title: "Show a walk or a room",
            body: "Point the camera at something ordinary. Ten minutes is a real visit.",
          },
        ]}
      />
      <h2 id="activities" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Long distance relationship activities
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        “Long distance relationship activities” is this same list. Pick one
        for the night you already have, not a board of twelve. If you want
        the evening framed as a date, use{" "}
        <Link
          href="/guides/virtual-date-ideas"
          className="text-brand-orange hover:underline"
        >
          virtual date ideas
        </Link>
        .
      </p>
      <h2 id="couples" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Long distance activities for couples
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        Couples apart need the same constraint: one activity, both time zones,
        a time to stop. Voice stays on FaceTime or Discord. The video, when
        you choose a video, stays on Crunchyroll or YouTube. Install from{" "}
        <Link href="/extension" className="text-brand-orange hover:underline">
          /extension
        </Link>
        . More date framing is on{" "}
        <Link
          href="/guides/long-distance-date-ideas"
          className="text-brand-orange hover:underline"
        >
          long distance date ideas
        </Link>
        .
      </p>
      <SeoGuideRelated
        links={[
          {
            href: "/watch-movies-together-long-distance",
            label: "Watch movies long distance",
          },
          { href: "/guides/virtual-date-ideas", label: "Virtual date ideas" },
          {
            href: "/guides/apps-for-long-distance-couples",
            label: "Apps for long distance couples",
          },
        ]}
      />
    </SeoPageLayout>
  );
}
