import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "AniDachi vs Crunchyroll Party — Which Is Better for Anime Nights?",
  description:
    "AniDachi vs Crunchyroll Party for Crunchyroll watch parties: async catch-up, progress, detection, and when free live sync is enough.",
  alternates: { canonical: "/compare/anidachi-vs-crunchyroll-party" },
  openGraph: {
    title: "AniDachi vs Crunchyroll Party",
    description:
      "Side-by-side comparison for Crunchyroll-first anime groups: live sync vs async watchrooms.",
    url: "/compare/anidachi-vs-crunchyroll-party",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AniDachi vs Crunchyroll Party",
    description: "When live sync is enough—and when groups need async watchrooms.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Is Crunchyroll Party free compared to AniDachi?",
    answer:
      "Crunchyroll Party is a free Chrome extension for live, synchronized watching. AniDachi is a paid product during early access and focuses on Crunchyroll-first watchrooms with async catch-up, auto anime detection, and per-person progress tracking.",
  },
  {
    question: "Do we still need Crunchyroll accounts for both tools?",
    answer:
      "Yes. Each viewer needs their own Crunchyroll access to stream legally. AniDachi adds the watchroom, sync layer, chat, and progress on top of each person’s own stream.",
  },
  {
    question: "Which is better for friends in different time zones?",
    answer:
      "If you can’t reliably watch at the same time, AniDachi is usually the better fit because reactions and progress stay tied to episodes even when people watch on different schedules.",
  },
];

const headings: TocHeading[] = [
  { id: "tldr", label: "At a glance", level: 2 },
  { id: "feature-comparison", label: "Feature comparison", level: 2 },
  { id: "when-crunchyroll-party", label: "When Crunchyroll Party is enough", level: 2 },
  { id: "when-anidachi", label: "When AniDachi wins", level: 2 },
  { id: "migration", label: "Migration path", level: 2 },
  { id: "related", label: "Related", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function AniDachiVsCrunchyrollPartyPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Compare", url: "/watch-crunchyroll-together" },
        {
          name: "AniDachi vs Crunchyroll Party",
          url: "/compare/anidachi-vs-crunchyroll-party",
        },
      ]}
      title="AniDachi vs Crunchyroll Party"
      description="Side-by-side comparison for Crunchyroll watch parties."
      url="/compare/anidachi-vs-crunchyroll-party"
      datePublished="2026-05-11"
      dateModified="2026-05-11"
      faq={faq}
      headings={headings}
      articleImage={articleImageAbsolute}
      aboveFoldCta
    >
      <h1 className="text-4xl font-bold text-gray-900 mb-6">
        AniDachi vs Crunchyroll Party for anime watch parties
      </h1>

      <p className="text-xl text-gray-700 leading-relaxed mb-8">
        <strong>
          Crunchyroll Party is great when everyone can watch live. AniDachi is built
          for real friend groups: mixed schedules, time zones, and long-running
          shows where progress and spoiler boundaries matter.
        </strong>
      </p>

      <h2 id="tldr" className="text-2xl font-bold text-gray-900 mt-10 mb-3 scroll-mt-24">
        At a glance
      </h2>
      <p className="text-gray-700 mb-8">
        <strong>TL;DR:</strong> Use <strong>Crunchyroll Party</strong> for free, live
        synchronized watching. Use <strong>AniDachi</strong> if your group wants one
        persistent watchroom, per-person progress, and async catch-up without losing
        where everyone is.
      </p>

      <h2
        id="feature-comparison"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        Feature comparison
      </h2>
      <div className="overflow-x-auto mb-8">
        <table className="w-full text-sm border-collapse border border-gray-200">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-200 px-4 py-2 text-left">Feature</th>
              <th className="border border-gray-200 px-4 py-2 text-left text-purple-700">
                AniDachi
              </th>
              <th className="border border-gray-200 px-4 py-2 text-left">
                Crunchyroll Party
              </th>
            </tr>
          </thead>
          <tbody className="text-gray-700">
            <tr>
              <td className="border border-gray-200 px-4 py-2">Live sync</td>
              <td className="border border-gray-200 px-4 py-2">Yes</td>
              <td className="border border-gray-200 px-4 py-2">Yes</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-200 px-4 py-2">Asynchronous catch-up</td>
              <td className="border border-gray-200 px-4 py-2 font-medium text-green-700">
                Yes
              </td>
              <td className="border border-gray-200 px-4 py-2">No</td>
            </tr>
            <tr>
              <td className="border border-gray-200 px-4 py-2">Auto anime detection</td>
              <td className="border border-gray-200 px-4 py-2 font-medium text-green-700">
                Yes
              </td>
              <td className="border border-gray-200 px-4 py-2">No / manual</td>
            </tr>
            <tr className="bg-gray-50">
              <td className="border border-gray-200 px-4 py-2">Per-person progress</td>
              <td className="border border-gray-200 px-4 py-2 font-medium text-green-700">
                Yes
              </td>
              <td className="border border-gray-200 px-4 py-2">No</td>
            </tr>
            <tr>
              <td className="border border-gray-200 px-4 py-2">Pricing</td>
              <td className="border border-gray-200 px-4 py-2">$8/mo (early access)</td>
              <td className="border border-gray-200 px-4 py-2">Free</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2
        id="when-crunchyroll-party"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        When Crunchyroll Party is enough
      </h2>
      <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-8">
        <li>Your whole group can watch at the same time every week.</li>
        <li>You mainly need basic live sync and a lightweight chat.</li>
        <li>You want a free option and can accept fewer “anime-specific” workflows.</li>
      </ul>

      <h2
        id="when-anidachi"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        When AniDachi wins
      </h2>
      <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-8">
        <li>You want async watching without losing the shared room context.</li>
        <li>You want per-person progress and spoiler boundaries that stick.</li>
        <li>You host long shows (or simulcasts) and need consistent pacing.</li>
      </ul>

      <h2
        id="migration"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        Migration path
      </h2>
      <p className="text-gray-700 leading-relaxed mb-8">
        If your crew started on a free live-sync tool and it keeps breaking due to
        scheduling, switch to a workflow where everyone streams locally and the
        room tracks progress. Start with{" "}
        <Link href="/watch-crunchyroll-together" className="text-purple-600 hover:underline">
          Watch Crunchyroll Together
        </Link>{" "}
        and then review{" "}
        <Link href="/#pricing" className="text-purple-600 font-medium hover:underline">
          AniDachi pricing
        </Link>
        .
      </p>

      <h2
        id="related"
        className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
      >
        Related
      </h2>
      <ul className="space-y-2 text-purple-600 mb-8">
        <li>
          <Link href="/compare/anidachi-vs-teleparty" className="hover:underline">
            AniDachi vs Teleparty
          </Link>
        </li>
        <li>
          <Link href="/compare/anidachi-vs-discord-screen-share" className="hover:underline">
            AniDachi vs Discord screen share
          </Link>
        </li>
        <li>
          <Link href="/guides/crunchyroll-watch-party-chrome-extension" className="hover:underline">
            Best Crunchyroll watch party Chrome extensions
          </Link>
        </li>
      </ul>
    </SeoPageLayout>
  );
}

