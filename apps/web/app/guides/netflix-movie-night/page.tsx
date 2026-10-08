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
  title: "Netflix Movie Night — One Film, One Start Time",
  description:
    "A Netflix movie night is one film, a start time, and everyone on their own Netflix account. AniDachi is adding Netflix movie rooms for desktop Chrome. They are not public yet.",
  alternates: { canonical: "/guides/netflix-movie-night" },
  openGraph: {
    title: "Netflix Movie Night",
    description: "One Netflix film and a time everyone can start.",
    url: "/guides/netflix-movie-night",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Netflix Movie Night",
    description: "Plan one Netflix film, then watch it together.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "How do you host a Netflix movie night?",
    answer:
      "Pick one film, send a start time, and have each person open that film on their own Netflix account in desktop Chrome. Use a call for voices and a sync extension so play matches.",
  },
  {
    question: "Is a Netflix movie night a watch party?",
    answer:
      "Yes. A movie night is a watch party with one film and a hard stop when the credits roll.",
  },
  {
    question: "Can AniDachi host it?",
    answer:
      "Not on Netflix yet. Those rooms are being added. The public extension hosts Crunchyroll and YouTube.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "plan", label: "Plan the night", level: 2 },
  { id: "far", label: "If you are in different cities", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function NetflixMovieNightPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Netflix watch party", url: "/netflix-watch-party" },
        { name: "Netflix movie night", url: "/guides/netflix-movie-night" },
      ]}
      title="Netflix movie night"
      description="One Netflix film and a start time."
      url="/guides/netflix-movie-night"
      datePublished="2026-10-08"
      dateModified="2026-10-08"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
    >
      <SeoGuideTitle>Netflix movie night</SeoGuideTitle>
      <SeoGuideAnswer id="answer">
        <p>
          A Netflix movie night is one film and a time everyone starts. It is
          a <Link href="/netflix-watch-party">Netflix watch party</Link> with
          an ending. Each person opens that film on their own Netflix account.
          AniDachi’s Netflix rooms are not on the public extension yet.
        </p>
      </SeoGuideAnswer>
      <h2 id="plan" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Plan it as one film
      </h2>
      <SeoGuideBulletList
        items={[
          {
            title: "Choose the film first",
            body: "Send the title before the call. Choosing during the cold open burns the first ten minutes.",
          },
          {
            title: "One start time",
            body: "Write it in both time zones if anyone is away. Late arrivals talk through the opening.",
          },
          {
            title: "Stop at the credits",
            body: "A second feature turns the night into a schedule nobody agreed to.",
          },
        ]}
      />
      <h2 id="far" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Different cities
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        The long-distance version of this page already exists:{" "}
        <Link
          href="/watch-netflix-together-long-distance"
          className="text-brand-orange hover:underline"
        >
          watch Netflix together long distance
        </Link>
        . A group that is not a couple should read{" "}
        <Link
          href="/guides/netflix-group-watch"
          className="text-brand-orange hover:underline"
        >
          Netflix group watch
        </Link>
        . The sync steps are{" "}
        <Link
          href="/guides/how-to-watch-netflix-together"
          className="text-brand-orange hover:underline"
        >
          how to watch Netflix together
        </Link>
        . Install AniDachi for Crunchyroll and YouTube from{" "}
        <Link href="/extension">/extension</Link>.
      </p>
      <SeoGuideRelated
        links={[
          { href: "/netflix-watch-party", label: "Netflix watch party" },
          {
            href: "/watch-netflix-together-long-distance",
            label: "Watch Netflix together long distance",
          },
          { href: "/guides/netflix-group-watch", label: "Netflix group watch" },
        ]}
      />
    </SeoPageLayout>
  );
}
