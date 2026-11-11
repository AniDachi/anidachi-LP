import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import { getSeoSiteOrigin } from "@/lib/site-url";
import { PRICING_AMAZON_SUBSCRIPTION_ROW, PRICING_FREE20_SUMMARY } from "@/lib/pricing-copy";

const SITE_URL = getSeoSiteOrigin();
const BRAND_OG_PATH = "/opengraph-image.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

// Fact-checked 10 Nov 2026 (ANI-50): Amazon removed Watch Party from Prime Video in
// spring 2024 without a public announcement. Reports put the end date at 2 April 2024.
const SOURCES = [
  {
    href: "https://www.howtogeek.com/prime-video-watch-party-shutdown/",
    label: "How-To Geek: You can't use Watch Party in Prime Video anymore",
  },
  {
    href: "https://www.neowin.net/news/amazon-prime-quietly-got-rid-of-a-covid-19-era-feature-watch-party/",
    label: "Neowin: Amazon Prime quietly got rid of Watch Party",
  },
  {
    href: "https://www.techtimes.com/articles/306472/20240708/amazon-discontinued-prime-video-watch-party-feature-users-noticed.htm",
    label: "Tech Times: Amazon discontinued its Prime Video Watch Party feature",
  },
];

export const metadata: Metadata = {
  title: { absolute: "AniDachi vs Amazon Watch Party for Anime (2026)" },
  description:
    "Amazon removed Watch Party from Prime Video in 2024. What that means for anime groups, and how to watch Crunchyroll, Netflix and YouTube together instead.",
  alternates: { canonical: "/compare/anidachi-vs-amazon-watch-party" },
  openGraph: {
    title: "AniDachi vs Amazon Watch Party for Anime",
    description:
      "Prime Video's Watch Party was removed in 2024. What still works for anime watch parties.",
    url: "/compare/anidachi-vs-amazon-watch-party",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AniDachi vs Amazon Watch Party for Anime",
    description: "Amazon Watch Party is gone. What still works for anime groups.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Does Amazon Prime Video still have Watch Party?",
    answer:
      "No. Amazon removed Watch Party from Prime Video in spring 2024, without a public announcement. Reports put the end date at 2 April 2024. Prime Video has had no built-in way to watch together since then.",
  },
  {
    question: "Does Amazon Prime have a watch party for anime?",
    answer:
      "Not anymore. Some anime streams on Prime Video, depending on your region, but the built-in Watch Party feature is gone. Most popular anime and current simulcasts are on Crunchyroll, where you can watch together with an extension such as AniDachi.",
  },
  {
    question: "Does AniDachi work with Prime Video?",
    answer:
      "Not yet. AniDachi syncs Crunchyroll, Netflix and YouTube in desktop Chrome today. Prime Video is a planned platform; we'll only list it as supported once it works.",
  },
  {
    question: "How can we watch anime together now that Amazon Watch Party is gone?",
    answer: `If the anime is on Crunchyroll, Netflix or YouTube, each friend opens it on their own account in desktop Chrome and AniDachi keeps the players in sync, with chat, reactions, voice and video. ${PRICING_FREE20_SUMMARY} For titles that are only on Prime Video, groups use a third-party extension that lists Prime Video support.`,
  },
  {
    question: "What anime is on Amazon Prime Video vs Crunchyroll?",
    answer:
      "Prime Video carries some anime in some regions, such as Vinland Saga Season 2, Made in Abyss and The Rising of the Shield Hero, plus a few originals. Availability changes by country. Crunchyroll has the larger anime catalog, including Demon Slayer, Jujutsu Kaisen, Attack on Titan, One Piece and most current simulcasts.",
  },
];

const headings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "what-happened", label: "What happened to Amazon Watch Party", level: 2 },
  { id: "feature-comparison", label: "Then vs now", level: 2 },
  { id: "anime-catalog", label: "Anime catalog: Prime vs Crunchyroll", level: 2 },
  { id: "what-works", label: "What works for anime groups now", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "sources", label: "Sources", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function AniDachiVsAmazonWatchPartyPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Compare", url: "/compare" },
        { name: "AniDachi vs Amazon Watch Party", url: "/compare/anidachi-vs-amazon-watch-party" },
      ]}
      title="AniDachi vs Amazon Watch Party"
      description="Amazon removed Watch Party from Prime Video in 2024. What still works for anime groups."
      url="/compare/anidachi-vs-amazon-watch-party"
      datePublished="2026-06-21"
      dateModified="2026-11-11"
      faq={faq}
      headings={headings}
      articleImage={articleImageAbsolute}
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        AniDachi vs Amazon Watch Party for Anime (2026)
      </h1>
      <h2
        id="answer"
        className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
      >
        Short Answer
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-6">
        <strong>
          Amazon Watch Party no longer exists. Amazon removed it from Prime
          Video in spring 2024. For anime on Crunchyroll, Netflix or YouTube,
          AniDachi keeps everyone&apos;s player in sync in desktop Chrome.
          AniDachi doesn&apos;t support Prime Video yet.
        </strong>
      </p>

      <h2
        id="what-happened"
        className="text-2xl font-bold text-foreground mt-8 mb-3 scroll-mt-24"
      >
        What happened to Amazon Watch Party
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-6">
        Prime Video&apos;s Watch Party let Prime members watch the same title
        with a shared chat. Amazon dropped it in spring 2024 without an
        announcement; reports put the end date at 2 April 2024, and its help
        pages were taken down. It hasn&apos;t come back. Disney+ removed its
        own GroupWatch feature the year before, so most groups now rely on
        browser extensions.
      </p>

      <h2
        id="feature-comparison"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Then vs now
      </h2>
      <ResponsiveCompareTable
        columns={[
          { id: "anidachi", label: "AniDachi", highlight: true },
          { id: "amazon", label: "Amazon Watch Party" },
        ]}
        rows={[
          {
            feature: "Available today",
            values: { anidachi: "yes", amazon: "No (removed in 2024)" },
          },
          {
            feature: "Platforms",
            values: { anidachi: "Crunchyroll, Netflix, YouTube", amazon: "Prime Video only, before removal" },
          },
          {
            feature: "Live synchronized playback",
            values: { anidachi: "yes", amazon: "Before removal" },
          },
          {
            feature: "Chat and reactions",
            values: { anidachi: "yes", amazon: "Chat, before removal" },
          },
          {
            feature: "Voice and video calls",
            values: { anidachi: "yes", amazon: "no" },
          },
          {
            feature: "Prime Video support",
            values: { anidachi: "Planned, not yet", amazon: "Before removal" },
          },
          {
            feature: "Cost",
            values: { anidachi: PRICING_AMAZON_SUBSCRIPTION_ROW, amazon: "Was included with Prime" },
          },
        ]}
      />

      <h2
        id="anime-catalog"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Anime Catalog: Amazon Prime Video vs Crunchyroll
      </h2>
      <ul className="space-y-4 text-foreground/80 mb-8">
        <li>
          <strong>Prime Video (varies by region):</strong> Vinland Saga Season
          2, Made in Abyss, The Rising of the Shield Hero and a few originals
          such as Ninja Kamui. Check your country before you plan a night.
        </li>
        <li>
          <strong>Crunchyroll (much larger):</strong>{" "}
          <Link href="/watch/demon-slayer-with-friends" className="text-brand-orange hover:underline">Demon Slayer</Link>,{" "}
          <Link href="/watch/jujutsu-kaisen-with-friends" className="text-brand-orange hover:underline">Jujutsu Kaisen</Link>,{" "}
          <Link href="/watch/attack-on-titan-with-friends" className="text-brand-orange hover:underline">Attack on Titan</Link>,{" "}
          <Link href="/watch/haikyuu-with-friends" className="text-brand-orange hover:underline">Haikyuu!!</Link>,{" "}
          <Link href="/watch/one-piece-with-friends" className="text-brand-orange hover:underline">One Piece</Link>,{" "}
          <Link href="/watch/naruto-with-friends" className="text-brand-orange hover:underline">Naruto</Link>,{" "}
          <Link href="/watch/bleach-with-friends" className="text-brand-orange hover:underline">Bleach</Link>,{" "}
          <Link href="/watch/chainsaw-man-with-friends" className="text-brand-orange hover:underline">Chainsaw Man</Link>,{" "}
          <Link href="/watch/fullmetal-alchemist-brotherhood-with-friends" className="text-brand-orange hover:underline">Fullmetal Alchemist: Brotherhood</Link>, and
          most current simulcasts.
        </li>
      </ul>

      <h2
        id="what-works"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        What works for anime groups now
      </h2>
      <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-6">
        <li>
          <strong>Anime on Crunchyroll:</strong> start a{" "}
          <Link href="/watch-crunchyroll-together" className="text-brand-orange hover:underline">
            Crunchyroll watch party
          </Link>{" "}
          in AniDachi. Each friend uses their own Crunchyroll account.
        </li>
        <li>
          <strong>Anime or films on Netflix:</strong> the same room works for a{" "}
          <Link href="/netflix-watch-party" className="text-brand-orange hover:underline">
            Netflix watch party
          </Link>
          .
        </li>
        <li>
          <strong>Free official uploads on YouTube:</strong>{" "}
          <Link href="/watch-youtube-together" className="text-brand-orange hover:underline">
            watch YouTube together
          </Link>{" "}
          in sync.
        </li>
        <li>
          <strong>Titles only on Prime Video:</strong> use a third-party
          extension that lists Prime Video support, until AniDachi adds it.
          The options are in{" "}
          <Link href="/prime-video-watch-party" className="text-brand-orange hover:underline">
            Prime Video watch party
          </Link>
          .
        </li>
      </ul>

      <h2
        id="related"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Related
      </h2>
      <ul className="space-y-2 text-brand-orange">
        <li>
          <Link href="/prime-video-watch-party" className="hover:underline">
            Prime Video watch party
          </Link>
        </li>
        <li>
          <Link href="/guides/how-to-stream-prime-video-on-discord" className="hover:underline">
            How to stream Prime Video on Discord
          </Link>
        </li>
        <li>
          <Link href="/compare/anidachi-vs-teleparty" className="hover:underline">
            AniDachi vs Teleparty
          </Link>
        </li>
        <li>
          <Link href="/compare/anidachi-vs-rave" className="hover:underline">
            AniDachi vs Rave
          </Link>
        </li>
        <li>
          <Link href="/guides/how-to-watch-crunchyroll-with-friends" className="hover:underline">
            How to watch Crunchyroll with friends
          </Link>
        </li>
        <li>
          <Link href="/guides/does-netflix-have-a-watch-party" className="hover:underline">
            Does Netflix have a watch party?
          </Link>
        </li>
      </ul>

      <h2
        id="sources"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Sources
      </h2>
      <p className="text-foreground/80 mb-3">Checked 10 November 2026:</p>
      <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-6">
        {SOURCES.map((source) => (
          <li key={source.href}>
            <a href={source.href} className="text-brand-orange hover:underline" rel="noopener noreferrer" target="_blank">
              {source.label}
            </a>
          </li>
        ))}
      </ul>
    </SeoPageLayout>
  );
}
