import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { HowToJsonLd } from "@/components/json-ld";
import { getGuideLinks } from "@/lib/guide-links";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://anidachi.app";
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "First Anime Watch Party Checklist — Before You Press Play (2026)",
  description:
    "A practical prep list for your first Crunchyroll watch party: accounts, pacing, etiquette, and how to start a watchroom without awkward spoilers.",
  alternates: { canonical: "/guides/first-anime-watch-party-checklist" },
  openGraph: {
    title: "First Anime Watch Party Checklist — Before You Press Play",
    description:
      "Prep your crew, pick a pacing model, and start a Crunchyroll watchroom without last-minute scrambling.",
    url: "/guides/first-anime-watch-party-checklist",
    images: [
      {
        url: BRAND_OG_PATH,
        alt: "AniDachi — anime watch parties on Crunchyroll",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "First Anime Watch Party Checklist — 2026",
    description:
      "Accounts, pacing, etiquette, and how to launch a Crunchyroll watchroom before episode one.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Does everyone need their own Crunchyroll account for a watch party?",
    answer:
      "Yes, for per-person streaming in full quality. Each viewer signs in with their own account (free or paid per Crunchyroll’s rules). Watch party tools like AniDachi add sync and chat on top— they don’t replace individual access to the catalog.",
  },
  {
    question: "Do we have to start the anime at the same time?",
    answer:
      "No. Live sync is great for premiers, but async-friendly watchrooms let people catch up on their own schedule while keeping chat anchored to episodes. Decide up front whether you are locking a start time or using flexible pacing.",
  },
  {
    question: "What if one person is one episode ahead?",
    answer:
      "Pause public chat reactions until everyone passes the same episode marker, use thread labels for late viewers, or split into spoiler-safe and caught-up channels. Async watchrooms make it easier to see who finished which episode before you post twists.",
  },
  {
    question: "Is AniDachi free or paid?",
    answer:
      "AniDachi is a paid Chrome extension with early-access pricing shown on the AniDachi homepage. You still need your own Crunchyroll subscription to stream episodes; AniDachi provides watchrooms, sync, and chat on top.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "prep-resources", label: "Prep resources", level: 2 },
  { id: "night-before", label: "Night-before checklist", level: 2 },
  { id: "howto-anidachi", label: "Start a room with AniDachi", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

const prepItemList = [
  {
    name: "Learn what a watchroom is",
    url: "/glossary/watchroom",
    position: 1,
  },
  {
    name: "Pick a Crunchyroll workflow everyone can follow",
    url: "/guides/how-to-watch-crunchyroll-with-friends",
    position: 2,
  },
  {
    name: "Decide between live sync and async watching",
    url: "/guides/asynchronous-vs-live-watch-party",
    position: 3,
  },
  {
    name: "Create the party with clear ground rules",
    url: "/guides/how-to-create-an-anime-watch-party",
    position: 4,
  },
];

const howToSteps = [
  {
    name: "Confirm access",
    text: "Make sure every guest can open the same series on Crunchyroll with their own account before you send invites.",
  },
  {
    name: "Choose pacing",
    text: "Agree on live premiere times or async catch-up windows so chat stays spoiler-safe.",
  },
  {
    name: "Install AniDachi",
    text: "Each participant adds the AniDachi Chrome extension so watchrooms, sync, and chat stay in one place.",
  },
  {
    name: "Open episode one",
    text: "Start the agreed episode signed into Crunchyroll, then let AniDachi detect the correct title metadata.",
  },
  {
    name: "Create and share the watchroom",
    text: "Generate the room link, drop it into your group chat, and recap etiquette (mute vs. spoiler threads) before reactions begin.",
  },
];

export default function FirstAnimeWatchPartyChecklistPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["how-to-core", "watch-party"],
    excludeHref: "/guides/first-anime-watch-party-checklist",
    limit: 6,
  });

  return (
    <>
      <HowToJsonLd
        name="Start your first anime watch party with AniDachi"
        description="Prep accounts and pacing on Crunchyroll, then create a synced or async-friendly watchroom for your crew."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Guides", url: "/watch-anime-together" },
          {
            name: "First Anime Watch Party Checklist",
            url: "/guides/first-anime-watch-party-checklist",
          },
        ]}
        title="First Anime Watch Party Checklist"
        description="Prep accounts, pacing, and etiquette before your crew presses play on Crunchyroll."
        url="/guides/first-anime-watch-party-checklist"
        datePublished="2026-05-08"
        dateModified="2026-05-08"
        faq={faq}
        headings={tocHeadings}
        itemList={prepItemList}
        articleImage={articleImageAbsolute}
        aboveFoldCta
      >
        <h1 className="text-4xl font-bold text-gray-900 mb-6">
          First Anime Watch Party Checklist
        </h1>

        <p className="text-xl text-gray-700 leading-relaxed mb-8">
          <strong>
            A smooth first watch party comes down to three things: everyone can
            open the same show legally, you agree on live vs.&nbsp;async pacing,
            and chat rules protect people who finish episodes later.
          </strong>{" "}
          Use this checklist before you ping the group invite so nobody scrambles for
          logins—or accidentally spoils episode three in general chat.
        </p>

        <h2
          id="prep-resources"
          className="text-2xl font-bold text-gray-900 mt-12 mb-4 scroll-mt-24"
        >
          Prep resources (read these once)
        </h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          Skim the four links below in order. They mirror the same flow we surface
          to search engines via structured data—plain language first, tooling second.
        </p>
        <ol className="list-decimal pl-6 space-y-3 text-gray-700 mb-8">
          {prepItemList.map((item) => (
            <li key={item.url}>
              <Link href={item.url} className="text-purple-600 hover:underline">
                {item.name}
              </Link>
            </li>
          ))}
        </ol>

        <h2
          id="night-before"
          className="text-2xl font-bold text-gray-900 mt-12 mb-4 scroll-mt-24"
        >
          Night-before checklist
        </h2>
        <ul className="list-disc pl-6 space-y-2 text-gray-700 mb-8">
          <li>
            <strong>Show + episode boundary:</strong> pick the series and whether
            you are stopping after one episode or a mini-marathon block.
          </li>
          <li>
            <strong>Regional catalog overlap:</strong> if friends are in different
            regions, verify the title is streamable on both sides of the border—or
            pick a fallback series.
          </li>
          <li>
            <strong>Voice channel fallback:</strong> if someone&apos;s bandwidth
            tanks, confirm whether Discord voice is backup while everyone still plays
            their own Crunchyroll tab.
          </li>
          <li>
            <strong>Emoji shorthand:</strong> agree on spoiler tags or threads so
            reactions feel fun instead of risky.
          </li>
        </ul>
        <p className="text-gray-700 leading-relaxed mb-4">
          Need language for slower schedules? Pair this list with our{" "}
          <Link
            href="/glossary/asynchronous-watching"
            className="text-purple-600 hover:underline"
          >
            asynchronous watching glossary entry
          </Link>{" "}
          before you promise a same-night finish.
        </p>

        <h2
          id="howto-anidachi"
          className="text-2xl font-bold text-gray-900 mt-12 mb-4 scroll-mt-24"
        >
          Step-by-step: launch an AniDachi watchroom
        </h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          These steps intentionally match the structured HowTo markup on this
          page—if you edit the content, update both places so Google and readers see
          the same flow.
        </p>
        <ol className="list-decimal pl-6 space-y-2 text-gray-700 mb-8">
          {howToSteps.map((step) => (
            <li key={step.name}>
              <span className="font-medium text-gray-900">{step.name}. </span>
              {step.text}
            </li>
          ))}
        </ol>

        <p className="text-gray-700 leading-relaxed border-l-4 border-purple-200 pl-4 py-2 my-10">
          Once pacing and accounts are confirmed, you can{" "}
          <Link
            href="/#pricing"
            className="text-purple-600 font-medium hover:underline"
          >
            start an AniDachi plan
          </Link>{" "}
          and spin up a watchroom in a few minutes—then keep reactions inside the room
          so late viewers are not ambushed by spoilers.
        </p>

        <h2
          id="related"
          className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
        >
          Related guides
        </h2>
        <ul className="space-y-2 text-purple-600 mb-8">
          {relatedGuideLinks.map((g) => (
            <li key={g.href}>
              <Link href={g.href} className="hover:underline">
                {g.label}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/watch-crunchyroll-together"
              className="hover:underline"
            >
              Watch Crunchyroll Together hub
            </Link>
          </li>
          <li>
            <Link href="/compare/anidachi-vs-teleparty" className="hover:underline">
              AniDachi vs Teleparty comparison
            </Link>
          </li>
        </ul>
      </SeoPageLayout>
    </>
  );
}
