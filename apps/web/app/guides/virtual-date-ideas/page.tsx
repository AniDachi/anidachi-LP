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
  title: "Virtual Date Ideas — Including a Watch Date",
  description:
    "Virtual date ideas for a long distance relationship: a call, a shared meal, and a synced Crunchyroll episode or YouTube movie on your own accounts.",
  alternates: { canonical: "/guides/virtual-date-ideas" },
  openGraph: {
    title: "Virtual Date Ideas",
    description: "A call plus one shared thing to do, including a watch.",
    url: "/guides/virtual-date-ideas",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Virtual Date Ideas",
    description: "Virtual dates and a virtual date night, with a watch option.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "What are good virtual date ideas?",
    answer:
      "A video call, something you both do at the same time, and an end time. A synced episode or YouTube movie can be the activity. Each person uses their own account.",
  },
  {
    question: "What are virtual dates for a long distance relationship?",
    answer:
      "The same ideas, planned across the distance: cook the same meal, play a short game, or watch one episode together. The relationship is the reason. The date still needs a start and a stop.",
  },
  {
    question: "Can AniDachi be the virtual date night?",
    answer:
      "Yes for Crunchyroll and full YouTube watch pages in desktop Chrome. Stay on your usual call for voice. Netflix is coming soon and is not supported yet. Disney+, Hulu and Prime are not supported.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "ideas", label: "Ideas", level: 2 },
  { id: "ldr", label: "Long distance virtual dates", level: 2 },
  { id: "night", label: "Virtual date night", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function VirtualDateIdeasPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        {
          name: "Watch movies long distance",
          url: "/watch-movies-together-long-distance",
        },
        { name: "Virtual date ideas", url: "/guides/virtual-date-ideas" },
      ]}
      title="Virtual date ideas"
      description="Virtual dates for a long distance relationship, including a synced watch."
      url="/guides/virtual-date-ideas"
      datePublished="2026-09-27"
      dateModified="2026-09-27"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
    >
      <SeoGuideTitle>Virtual date ideas that fit one evening</SeoGuideTitle>
      <SeoGuideAnswer>
        <p>
          A virtual date needs a call and one shared activity with a clear
          ending. Watching the same Crunchyroll episode or YouTube movie is
          one of those activities. Use{" "}
          <Link href="/watch-movies-together-long-distance">
            watch movies together long distance
          </Link>{" "}
          when the night is the film itself.
        </p>
      </SeoGuideAnswer>
      <h2 id="ideas" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Virtual date ideas
      </h2>
      <SeoGuideBulletList
        items={[
          {
            title: "Same meal, two kitchens",
            body: "Pick one recipe, shop before the call, and eat while you talk. Stop when the plates are done.",
          },
          {
            title: "One episode",
            body: "Agree on the title and the audio. Each person presses play on their own account. AniDachi keeps the moment together.",
          },
          {
            title: "A short game, then stop",
            body: "Twenty minutes is enough. The date gets worse when you add a second activity you did not plan.",
          },
        ]}
      />
      <h2 id="ldr" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Virtual dates for a long distance relationship
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        That search is the same list with the distance named. Put the date on
        the calendar in both time zones. Keep FaceTime or Discord for voices.
        If you want more than one evening, the broader set is{" "}
        <Link
          href="/guides/long-distance-date-ideas"
          className="text-brand-orange hover:underline"
        >
          long distance date ideas
        </Link>
        .
      </p>
      <h2 id="night" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Virtual date night ideas
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        A virtual date night is one block of time, not a tour of apps. Start
        the call, do the meal or the episode, and say when it ends. For the
        movie version, open{" "}
        <Link
          href="/guides/watch-movies-together-online"
          className="text-brand-orange hover:underline"
        >
          watch movies together online
        </Link>{" "}
        and install AniDachi from{" "}
        <Link href="/extension" className="text-brand-orange hover:underline">
          /extension
        </Link>
        . More things to do are on{" "}
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
          {
            href: "/watch-movies-together-long-distance",
            label: "Watch movies long distance",
          },
          {
            href: "/guides/long-distance-date-ideas",
            label: "Long distance date ideas",
          },
          {
            href: "/guides/things-to-do-long-distance",
            label: "Things to do long distance",
          },
        ]}
      />
    </SeoPageLayout>
  );
}
