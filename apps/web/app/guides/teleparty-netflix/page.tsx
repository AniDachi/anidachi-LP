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
  title: "Teleparty Netflix — Watch a Netflix Title with Teleparty",
  description:
    "Teleparty on Netflix is the Chrome extension, formerly Netflix Party, syncing a Netflix title. Each person needs Netflix. AniDachi’s own Netflix rooms are not public yet.",
  alternates: { canonical: "/guides/teleparty-netflix" },
  openGraph: {
    title: "Teleparty Netflix",
    description: "Teleparty running on a Netflix title.",
    url: "/guides/teleparty-netflix",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Teleparty Netflix",
    description: "How Teleparty fits a Netflix watch.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "Does Teleparty work on Netflix?",
    answer:
      "Yes. Teleparty is a Chrome extension that starts a session from a Netflix title. Everyone still needs their own Netflix account.",
  },
  {
    question: "Is Teleparty the same as Netflix Party?",
    answer:
      "Teleparty is the new name of the Netflix Party extension. Searching either name is the same product.",
  },
  {
    question: "Does AniDachi include Teleparty?",
    answer:
      "No. They are different extensions. AniDachi is adding Netflix watchrooms separately, and they are not on the public extension yet.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "session", label: "What the session is", level: 2 },
  { id: "order", label: "Netflix Teleparty", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function TelepartyNetflixPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Netflix watch party", url: "/netflix-watch-party" },
        { name: "Teleparty Netflix", url: "/guides/teleparty-netflix" },
      ]}
      title="Teleparty Netflix"
      description="Teleparty on a Netflix title."
      url="/guides/teleparty-netflix"
      datePublished="2026-10-08"
      dateModified="2026-10-08"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
    >
      <SeoGuideTitle>Teleparty Netflix</SeoGuideTitle>
      <SeoGuideAnswer id="answer">
        <p>
          Teleparty Netflix means Teleparty running on a Netflix title in
          Chrome. One person opens Netflix, starts a Teleparty session, and
          sends the link. Everyone else needs Netflix too. This is the tool
          that used to be called{" "}
          <Link href="/netflix-party">Netflix Party</Link>.
        </p>
      </SeoGuideAnswer>
      <h2 id="session" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        What you need open
      </h2>
      <SeoGuideBulletList
        items={[
          {
            title: "Chrome",
            body: "Teleparty is a desktop browser extension. The Netflix phone app is a different player.",
          },
          {
            title: "The title",
            body: "Start from the movie or episode, not from the Netflix homepage.",
          },
          {
            title: "The link",
            body: "Friends join that session. They still sign into their own Netflix account.",
          },
        ]}
      />
      <h2 id="order" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        If you searched the words the other way
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        “Netflix Teleparty” is the same pair of names in the other order. That
        page is{" "}
        <Link href="/guides/netflix-teleparty" className="text-brand-orange hover:underline">
          Netflix Teleparty
        </Link>
        . The install name is{" "}
        <Link
          href="/guides/netflix-party-extension"
          className="text-brand-orange hover:underline"
        >
          Netflix Party extension
        </Link>
        . AniDachi does not wrap Teleparty. Its own Netflix rooms are coming,
        and Crunchyroll plus YouTube are on{" "}
        <Link href="/extension">/extension</Link> now. The side-by-side page is{" "}
        <Link
          href="/compare/anidachi-vs-teleparty"
          className="text-brand-orange hover:underline"
        >
          AniDachi vs Teleparty
        </Link>
        .
      </p>
      <SeoGuideRelated
        links={[
          { href: "/guides/netflix-teleparty", label: "Netflix Teleparty" },
          { href: "/netflix-party", label: "Netflix Party" },
          { href: "/compare/anidachi-vs-teleparty", label: "AniDachi vs Teleparty" },
        ]}
      />
    </SeoPageLayout>
  );
}
