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
  title: "Netflix Teleparty — Teleparty on a Netflix Title",
  description:
    "Netflix Teleparty means using Teleparty with Netflix. It is the renamed Netflix Party extension. Open Netflix in Chrome, start Teleparty, and share the link. AniDachi Netflix rooms are separate and not public yet.",
  alternates: { canonical: "/guides/netflix-teleparty" },
  openGraph: {
    title: "Netflix Teleparty",
    description: "Teleparty started from a Netflix title.",
    url: "/guides/netflix-teleparty",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Netflix Teleparty",
    description: "Netflix first, then Teleparty.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "What is Netflix Teleparty?",
    answer:
      "It is Teleparty used on Netflix. You open a Netflix movie or episode in Chrome and start a Teleparty session from that page.",
  },
  {
    question: "How is this different from Teleparty Netflix?",
    answer:
      "Same product, other word order. Teleparty Netflix starts from the extension. Netflix Teleparty starts from the Netflix title you already have open.",
  },
  {
    question: "Can I use AniDachi instead?",
    answer:
      "Not for Netflix yet. AniDachi is adding Netflix watchrooms. The public extension syncs Crunchyroll and YouTube.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "from-netflix", label: "Start from Netflix", level: 2 },
  { id: "other", label: "The other word order", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function NetflixTelepartyPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Netflix watch party", url: "/netflix-watch-party" },
        { name: "Netflix Teleparty", url: "/guides/netflix-teleparty" },
      ]}
      title="Netflix Teleparty"
      description="Start Teleparty from a Netflix title."
      url="/guides/netflix-teleparty"
      datePublished="2026-10-08"
      dateModified="2026-10-08"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
    >
      <SeoGuideTitle>Netflix Teleparty</SeoGuideTitle>
      <SeoGuideAnswer>
        <p>
          Netflix Teleparty means you are already on a Netflix title and you
          want Teleparty on that page. Teleparty is the Chrome extension
          formerly named Netflix Party. It syncs playback for people who each
          have Netflix. AniDachi does not run that session.
        </p>
      </SeoGuideAnswer>
      <h2 id="from-netflix" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Start from the Netflix title
      </h2>
      <SeoGuideBulletList
        items={[
          {
            title: "Open the movie or episode",
            body: "Use desktop Chrome and the actual title, not a trailer or the mobile app.",
          },
          {
            title: "Start Teleparty there",
            body: "The extension adds the session to that Netflix page. Copy the link it gives you.",
          },
          {
            title: "Friends sign into Netflix",
            body: "The link does not replace their login. They need their own Netflix account.",
          },
        ]}
      />
      <h2 id="other" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Teleparty Netflix is the other search
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        If the extension name came first, use{" "}
        <Link href="/guides/teleparty-netflix" className="text-brand-orange hover:underline">
          Teleparty Netflix
        </Link>
        . The store name is on{" "}
        <Link
          href="/guides/netflix-party-extension"
          className="text-brand-orange hover:underline"
        >
          Netflix Party extension
        </Link>
        . The cluster is{" "}
        <Link href="/netflix-watch-party" className="text-brand-orange hover:underline">
          Netflix watch party
        </Link>
        . AniDachi’s current install, for Crunchyroll and YouTube, is{" "}
        <Link href="/extension">/extension</Link>.
      </p>
      <SeoGuideRelated
        links={[
          { href: "/guides/teleparty-netflix", label: "Teleparty Netflix" },
          { href: "/guides/netflix-party-extension", label: "Netflix Party extension" },
          { href: "/netflix-watch-party", label: "Netflix watch party" },
        ]}
      />
    </SeoPageLayout>
  );
}
