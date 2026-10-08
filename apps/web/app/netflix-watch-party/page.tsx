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
  title: "Netflix Watch Party — Watch the Same Title Together",
  description:
    "A Netflix watch party is the same movie or episode at the same moment, each person on their own Netflix account. AniDachi is adding Netflix in desktop Chrome. It is not on the public extension yet.",
  alternates: { canonical: "/netflix-watch-party" },
  openGraph: {
    title: "Netflix Watch Party",
    description: "Same Netflix title, own accounts, desktop Chrome. Coming to AniDachi.",
    url: "/netflix-watch-party",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Netflix Watch Party",
    description: "Watch Netflix together from your own account. AniDachi support is coming.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "What is a Netflix watch party?",
    answer:
      "People watch the same Netflix movie or episode at the same time and talk while it plays. Each person uses their own Netflix account. Netflix does not include a watch-party button.",
  },
  {
    question: "Does AniDachi run a Netflix watch party today?",
    answer:
      "Not yet. AniDachi is adding Netflix watchrooms for desktop Chrome. The public extension currently syncs Crunchyroll and YouTube.",
  },
  {
    question: "Is Netflix Party the same as a Netflix watch party?",
    answer:
      "People use both phrases for the same night. Netflix Party was also the old name of the Teleparty extension.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "need", label: "What the night needs", level: 2 },
  { id: "pages", label: "The rest of the cluster", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function NetflixWatchPartyPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Netflix watch party", url: "/netflix-watch-party" },
      ]}
      title="Netflix watch party"
      description="A Netflix watch party on your own account. AniDachi support is coming."
      url="/netflix-watch-party"
      datePublished="2026-10-08"
      dateModified="2026-10-08"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
      conversionTemplate="pillar"
      itemList={[
        { name: "Netflix Party", url: "/netflix-party", position: 1 },
        {
          name: "How to watch Netflix together",
          url: "/guides/how-to-watch-netflix-together",
          position: 2,
        },
        {
          name: "Watch Netflix together",
          url: "/guides/watch-netflix-together",
          position: 3,
        },
        {
          name: "How to watch Netflix with friends",
          url: "/guides/how-to-watch-netflix-with-friends",
          position: 4,
        },
        {
          name: "Does Netflix have a watch party?",
          url: "/guides/does-netflix-have-a-watch-party",
          position: 5,
        },
        { name: "Netflix group watch", url: "/guides/netflix-group-watch", position: 6 },
        {
          name: "Netflix Party extension",
          url: "/guides/netflix-party-extension",
          position: 7,
        },
        { name: "Teleparty Netflix", url: "/guides/teleparty-netflix", position: 8 },
        { name: "Netflix Teleparty", url: "/guides/netflix-teleparty", position: 9 },
        {
          name: "Screen share Netflix on Discord",
          url: "/guides/how-to-screen-share-netflix-on-discord",
          position: 10,
        },
        { name: "Netflix movie night", url: "/guides/netflix-movie-night", position: 11 },
      ]}
    >
      <SeoGuideTitle>Netflix watch party</SeoGuideTitle>
      <SeoGuideAnswer>
        <p>
          A Netflix watch party is the same movie or episode at the same
          moment, with each person signed into their own Netflix account.
          AniDachi is adding that for desktop Chrome. It is not on the public
          extension yet. Crunchyroll and YouTube watchrooms are available now
          from <Link href="/extension">/extension</Link>.
        </p>
      </SeoGuideAnswer>
      <h2 id="need" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        What the night needs
      </h2>
      <SeoGuideBulletList
        items={[
          {
            title: "Your own Netflix login",
            body: "A shared password is not the setup. Everyone opens the title on their own account.",
          },
          {
            title: "Desktop Chrome",
            body: "The watch page is a full Netflix title in the browser, not the phone app.",
          },
          {
            title: "A way to stay in sync",
            body: "Netflix does not include that control. Extensions fill the gap today. AniDachi’s Netflix rooms are the one coming next.",
          },
        ]}
      />
      <h2 id="pages" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Pages for the searches around this one
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        <Link href="/netflix-party" className="text-brand-orange hover:underline">
          Netflix Party
        </Link>{" "}
        is the old extension name. Start here for{" "}
        <Link
          href="/guides/does-netflix-have-a-watch-party"
          className="text-brand-orange hover:underline"
        >
          does Netflix have a watch party
        </Link>
        ,{" "}
        <Link
          href="/guides/how-to-watch-netflix-together"
          className="text-brand-orange hover:underline"
        >
          how to watch Netflix together
        </Link>
        ,{" "}
        <Link
          href="/guides/watch-netflix-together"
          className="text-brand-orange hover:underline"
        >
          watch Netflix together
        </Link>
        ,{" "}
        <Link
          href="/guides/how-to-watch-netflix-with-friends"
          className="text-brand-orange hover:underline"
        >
          how to watch Netflix with friends
        </Link>
        , and{" "}
        <Link
          href="/guides/netflix-group-watch"
          className="text-brand-orange hover:underline"
        >
          Netflix group watch
        </Link>
        . The extension names are{" "}
        <Link
          href="/guides/netflix-party-extension"
          className="text-brand-orange hover:underline"
        >
          Netflix Party extension
        </Link>
        ,{" "}
        <Link href="/guides/teleparty-netflix" className="text-brand-orange hover:underline">
          Teleparty Netflix
        </Link>
        , and{" "}
        <Link href="/guides/netflix-teleparty" className="text-brand-orange hover:underline">
          Netflix Teleparty
        </Link>
        . Discord is{" "}
        <Link
          href="/guides/how-to-screen-share-netflix-on-discord"
          className="text-brand-orange hover:underline"
        >
          how to screen share Netflix on Discord
        </Link>
        . A single evening is{" "}
        <Link href="/guides/netflix-movie-night" className="text-brand-orange hover:underline">
          Netflix movie night
        </Link>
        .
      </p>
      <SeoGuideRelated
        links={[
          { href: "/netflix-party", label: "Netflix Party" },
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
