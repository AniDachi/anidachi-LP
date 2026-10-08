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
  title: "Does Netflix Have a Watch Party?",
  description:
    "Netflix does not include a watch party button. The old in-house party feature is gone. People use a Chrome extension, and AniDachi is adding Netflix rooms.",
  alternates: { canonical: "/guides/does-netflix-have-a-watch-party" },
  openGraph: {
    title: "Does Netflix Have a Watch Party?",
    description: "No built-in party mode. Extensions cover the gap.",
    url: "/guides/does-netflix-have-a-watch-party",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Does Netflix Have a Watch Party?",
    description: "Netflix has no watch party button.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "Does Netflix have a watch party?",
    answer:
      "No. Netflix does not currently include a button that syncs a title for other people. Watching together takes a third-party extension or a screen share.",
  },
  {
    question: "Did Netflix used to have one?",
    answer:
      "Netflix tested co-watching and later removed it. Netflix Party, the Chrome extension, was a separate product and is now named Teleparty.",
  },
  {
    question: "Will AniDachi add one?",
    answer:
      "AniDachi is adding Netflix watchrooms for desktop Chrome. That update is not on the public extension yet.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "instead", label: "What people use instead", level: 2 },
  { id: "coming", label: "What AniDachi is adding", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function DoesNetflixHaveAWatchPartyPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Netflix watch party", url: "/netflix-watch-party" },
        {
          name: "Does Netflix have a watch party?",
          url: "/guides/does-netflix-have-a-watch-party",
        },
      ]}
      title="Does Netflix have a watch party?"
      description="Netflix has no built-in watch party."
      url="/guides/does-netflix-have-a-watch-party"
      datePublished="2026-10-08"
      dateModified="2026-10-08"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
    >
      <SeoGuideTitle>Does Netflix have a watch party?</SeoGuideTitle>
      <SeoGuideAnswer>
        <p>
          Netflix does not have a watch party button. You can press play on
          your own account, and someone else can press play on theirs, but
          Netflix will not keep those two players together. A{" "}
          <Link href="/netflix-watch-party">Netflix watch party</Link> is a
          setup you add on top.
        </p>
      </SeoGuideAnswer>
      <h2 id="instead" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        What people use instead
      </h2>
      <SeoGuideBulletList
        items={[
          {
            title: "A Chrome extension",
            body: "Netflix Party was renamed Teleparty. That is the extension tied to this search.",
          },
          {
            title: "A Discord share",
            body: "One person shares the window. Netflix often shows a black screen to everyone else.",
          },
          {
            title: "Pressing play on a count",
            body: "It works for a minute, then someone buffers and the group drifts.",
          },
        ]}
      />
      <h2 id="coming" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        AniDachi
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        AniDachi is adding Netflix watchrooms in desktop Chrome, each person
        on their own account. That is not on the public extension yet.
        Crunchyroll and YouTube are, from{" "}
        <Link href="/extension">/extension</Link>. The old extension name is
        explained on <Link href="/netflix-party">Netflix Party</Link>. The
        Teleparty wording is on{" "}
        <Link href="/guides/netflix-teleparty" className="text-brand-orange hover:underline">
          Netflix Teleparty
        </Link>
        .
      </p>
      <SeoGuideRelated
        links={[
          { href: "/netflix-watch-party", label: "Netflix watch party" },
          { href: "/netflix-party", label: "Netflix Party" },
          {
            href: "/guides/how-to-screen-share-netflix-on-discord",
            label: "Screen share Netflix on Discord",
          },
        ]}
      />
    </SeoPageLayout>
  );
}
