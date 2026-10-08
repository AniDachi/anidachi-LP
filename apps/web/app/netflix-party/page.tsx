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
  title: "Netflix Party — The Old Name for a Netflix Watch Party",
  description:
    "Netflix Party was a Chrome extension for watching Netflix together. It was renamed Teleparty. People still use the old name for a Netflix watch party. AniDachi Netflix rooms are coming.",
  alternates: { canonical: "/netflix-party" },
  openGraph: {
    title: "Netflix Party",
    description: "The extension was renamed Teleparty. The search still means watch together.",
    url: "/netflix-party",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Netflix Party",
    description: "Netflix Party is now Teleparty. AniDachi is adding Netflix separately.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "What happened to Netflix Party?",
    answer:
      "The Chrome extension called Netflix Party was renamed Teleparty. The Chrome Web Store listing people use today is Teleparty, not a separate Netflix Party install.",
  },
  {
    question: "Is Netflix Party built into Netflix?",
    answer:
      "No. Netflix does not include a party button. Netflix Party was a third-party extension.",
  },
  {
    question: "Is AniDachi Netflix Party?",
    answer:
      "No. AniDachi is a separate Chrome extension. Netflix watchrooms are being added and are not on the public extension yet.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "name", label: "The name change", level: 2 },
  { id: "today", label: "What to open", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function NetflixPartyPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Netflix watch party", url: "/netflix-watch-party" },
        { name: "Netflix Party", url: "/netflix-party" },
      ]}
      title="Netflix Party"
      description="Netflix Party was renamed Teleparty. The search still means a watch party."
      url="/netflix-party"
      datePublished="2026-10-08"
      dateModified="2026-10-08"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
      conversionTemplate="pillar"
    >
      <SeoGuideTitle>Netflix Party</SeoGuideTitle>
      <SeoGuideAnswer id="answer">
        <p>
          Netflix Party was the Chrome extension for watching Netflix
          together. That extension is now called Teleparty. People still
          search the old name when they want a{" "}
          <Link href="/netflix-watch-party">Netflix watch party</Link>.
          AniDachi is adding its own Netflix rooms. They are not on the public
          extension yet.
        </p>
      </SeoGuideAnswer>
      <h2 id="name" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Netflix Party and Teleparty
      </h2>
      <SeoGuideBulletList
        items={[
          {
            title: "One extension, two names",
            body: "Searching Netflix Party and installing Teleparty is the same product. There is not a second official Netflix Party build.",
          },
          {
            title: "Your own Netflix account",
            body: "The extension does not hand someone else your stream. Each person signs into Netflix.",
          },
          {
            title: "AniDachi is separate",
            body: "Crunchyroll and YouTube work in AniDachi today. Netflix is the platform being added.",
          },
        ]}
      />
      <h2 id="today" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Where to go next
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        The install search is{" "}
        <Link
          href="/guides/netflix-party-extension"
          className="text-brand-orange hover:underline"
        >
          Netflix Party extension
        </Link>
        . Teleparty on a Netflix title is{" "}
        <Link href="/guides/teleparty-netflix" className="text-brand-orange hover:underline">
          Teleparty Netflix
        </Link>{" "}
        and{" "}
        <Link href="/guides/netflix-teleparty" className="text-brand-orange hover:underline">
          Netflix Teleparty
        </Link>
        . Whether Netflix itself includes a party mode is{" "}
        <Link
          href="/guides/does-netflix-have-a-watch-party"
          className="text-brand-orange hover:underline"
        >
          does Netflix have a watch party
        </Link>
        .
      </p>
      <SeoGuideRelated
        links={[
          { href: "/netflix-watch-party", label: "Netflix watch party" },
          { href: "/guides/netflix-party-extension", label: "Netflix Party extension" },
          { href: "/compare/anidachi-vs-teleparty", label: "AniDachi vs Teleparty" },
        ]}
      />
    </SeoPageLayout>
  );
}
