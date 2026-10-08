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
  title: "Netflix Party Extension — Now Called Teleparty",
  description:
    "The Netflix Party extension was renamed Teleparty. Install Teleparty from the Chrome Web Store if you want that tool. AniDachi’s Netflix support is a separate update and is not public yet.",
  alternates: { canonical: "/guides/netflix-party-extension" },
  openGraph: {
    title: "Netflix Party Extension",
    description: "The old extension name now points at Teleparty.",
    url: "/guides/netflix-party-extension",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Netflix Party Extension",
    description: "Netflix Party in the Chrome Web Store is Teleparty.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "Where is the Netflix Party extension?",
    answer:
      "Search the Chrome Web Store for Teleparty. Netflix Party was renamed. There is not a current listing under the old name.",
  },
  {
    question: "Is the Netflix Party Chrome extension different from Teleparty?",
    answer:
      "No. Netflix Party chrome extension, Netflix watch party extension, and Teleparty are the same product line. The store name is Teleparty.",
  },
  {
    question: "Is AniDachi the Netflix Party extension?",
    answer:
      "No. AniDachi is a different Chrome extension. It syncs Crunchyroll and YouTube now. Netflix rooms are being added and are not on the public build yet.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "names", label: "The names in the store", level: 2 },
  { id: "anidachi", label: "AniDachi", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function NetflixPartyExtensionPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Netflix watch party", url: "/netflix-watch-party" },
        {
          name: "Netflix Party extension",
          url: "/guides/netflix-party-extension",
        },
      ]}
      title="Netflix Party extension"
      description="The Netflix Party Chrome extension is now Teleparty."
      url="/guides/netflix-party-extension"
      datePublished="2026-10-08"
      dateModified="2026-10-08"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImage}
      aboveFoldCta
    >
      <SeoGuideTitle>Netflix Party extension</SeoGuideTitle>
      <SeoGuideAnswer>
        <p>
          The Netflix Party extension is the Chrome add-on that used to carry
          that name. The listing is now Teleparty. Searching “Netflix Party
          chrome extension” or “Netflix watch party extension” leads to that
          same tool. AniDachi is not that extension. The name history is on{" "}
          <Link href="/netflix-party">Netflix Party</Link>.
        </p>
      </SeoGuideAnswer>
      <h2 id="names" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        Which search is which install
      </h2>
      <SeoGuideBulletList
        items={[
          {
            title: "Netflix Party extension",
            body: "The old name. The Chrome Web Store entry to open is Teleparty.",
          },
          {
            title: "Netflix Party chrome extension",
            body: "Same install, with the browser named. Still Teleparty.",
          },
          {
            title: "Netflix watch party extension",
            body: "Same intent. People want an extension that syncs a Netflix title.",
          },
        ]}
      />
      <h2 id="anidachi" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
        AniDachi’s extension
      </h2>
      <p className="mb-6 leading-relaxed text-ani-muted">
        Install AniDachi from <Link href="/extension">/extension</Link> for
        Crunchyroll and YouTube. Netflix rooms are being added for desktop
        Chrome and are not in that public build yet. Using Teleparty on a
        Netflix title is{" "}
        <Link href="/guides/teleparty-netflix" className="text-brand-orange hover:underline">
          Teleparty Netflix
        </Link>
        . The comparison lives on{" "}
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
          { href: "/netflix-party", label: "Netflix Party" },
          { href: "/guides/teleparty-netflix", label: "Teleparty Netflix" },
          { href: "/compare/anidachi-vs-teleparty", label: "AniDachi vs Teleparty" },
        ]}
      />
    </SeoPageLayout>
  );
}
