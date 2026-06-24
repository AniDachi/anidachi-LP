import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { HowToJsonLd } from "@/components/json-ld";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "How to Run an Online Anime Club (2026) — Discord & Watchroom Guide",
  description:
    "Start and run an online anime club: pick a schedule, set up Discord + AniDachi watchrooms, manage members across time zones, and keep a seasonal lineup fresh.",
  alternates: { canonical: "/guides/how-to-run-an-online-anime-club" },
  openGraph: {
    title: "How to Run an Online Anime Club",
    description:
      "College clubs, Discord communities, and friend groups — build a recurring anime watch club with synced Crunchyroll playback.",
    url: "/guides/how-to-run-an-online-anime-club",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Run an Online Anime Club",
    description: "Setup guide for recurring anime clubs with watchrooms and Discord.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "How do I start an online anime club?",
    answer:
      "Pick a communication platform (Discord works best), choose 1–2 shows to start, create an AniDachi watchroom on Crunchyroll, and schedule a recurring weekly sync. Post the watchroom link and calendar invite in your club channel. Start small — 5–10 active members beats 50 lurkers.",
  },
  {
    question: "How many members can an online anime club have?",
    answer:
      "AniDachi watchrooms work well for 2–10 active watchers per session. Larger clubs can split into sub-groups by timezone or genre preference, or rotate who picks the weekly show. Async mode lets bigger clubs stay connected without requiring everyone online simultaneously.",
  },
  {
    question: "What shows should an anime club watch first?",
    answer:
      "Start with accessible, completed series under 26 episodes — Spy x Family, KonoSuba, or Death Note give quick wins. Once the club has rhythm, move to seasonal simulcasts or longer marathons. See our best anime listicles for curated picks by genre.",
  },
  {
    question: "How do anime clubs handle spoilers?",
    answer:
      "Set a pinned safe episode number in your AniDachi watchroom after each sync. Use episode-scoped chat threads so early watchers can't spoil late members. Establish a club rule: react to feelings, not plot outcomes, until everyone has caught up.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "setup", label: "Club setup checklist", level: 2 },
  { id: "howto", label: "HowTo: launch your club", level: 2 },
  { id: "schedule", label: "Scheduling across time zones", level: 2 },
  { id: "growth", label: "Keeping members engaged", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

const howToSteps = [
  {
    name: "Create your club space",
    text: "Set up a Discord server (or group chat) with channels for announcements, watchroom links, episode discussion, and off-topic chat. Pin your watch schedule and rules.",
  },
  {
    name: "Pick your first show",
    text: "Vote on 1–2 starter series that are accessible and under 26 episodes. Confirm every member can stream them on Crunchyroll in their region.",
  },
  {
    name: "Create a persistent watchroom",
    text: "Install AniDachi, open the first episode on Crunchyroll, and create a watchroom. Keep the same room all season — chat history and progress accumulate.",
  },
  {
    name: "Schedule recurring sync nights",
    text: "Block a weekly time slot and post calendar invites. Live sync for premiere reactions; async for members who miss the session.",
  },
  {
    name: "Rotate leadership",
    text: "Let a different member pick the next show each month. Shared ownership keeps the club from becoming one person's burden.",
  },
];

export default function HowToRunAnOnlineAnimeClubPage() {
  return (
    <>
      <HowToJsonLd
        name="How to run an online anime club"
        description="Launch a recurring anime watch club with Discord, AniDachi watchrooms, and seasonal scheduling."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Guides", url: "/watch-anime-together" },
          {
            name: "How to run an online anime club",
            url: "/guides/how-to-run-an-online-anime-club",
          },
        ]}
        title="How to run an online anime club"
        description="Setup guide for recurring anime clubs with watchrooms, Discord, and seasonal scheduling."
        url="/guides/how-to-run-an-online-anime-club"
        datePublished="2026-06-08"
        dateModified="2026-06-08"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImageAbsolute}
      >
        <h1 className="text-4xl font-bold text-foreground mb-6">
          How to run an online anime club
        </h1>
        <p className="text-xl text-foreground/80 leading-relaxed mb-8">
          <strong>
            An online anime club is a recurring watch group — college societies,
            Discord communities, or friend circles that meet weekly to watch and
            discuss anime together. AniDachi gives your club persistent watchrooms
            with sync, async catch-up, and spoiler controls on Crunchyroll.
          </strong>
        </p>

        <h2
          id="setup"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Club setup checklist
        </h2>
        <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-8">
          <li>Discord server or group chat with dedicated watch channels</li>
          <li>AniDachi installed on every active member&apos;s Chrome browser</li>
          <li>Each member has their own Crunchyroll subscription</li>
          <li>A pinned watch schedule with timezone noted</li>
          <li>Spoiler rules posted and enforced via watchroom episode pins</li>
          <li>A vote system for picking the next show (polls, reactions, or rotation)</li>
        </ul>

        <h2
          id="howto"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          HowTo: launch your club
        </h2>
        <ol className="list-decimal pl-6 space-y-3 text-foreground/80 mb-8">
          {howToSteps.map((step) => (
            <li key={step.name}>
              <span className="font-medium text-foreground">{step.name}.</span>{" "}
              {step.text}
            </li>
          ))}
        </ol>

        <h2
          id="schedule"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Scheduling across time zones
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-8">
          Clubs with international members need a hybrid approach. Schedule one
          live sync per week at a rotating time so no region is always stuck at
          3 AM. Between syncs, use AniDachi&apos;s async mode so members watch on
          their own schedule without spoiling the group. See our{" "}
          <Link
            href="/guides/how-to-watch-anime-with-friends-in-different-time-zones"
            className="text-brand-orange hover:underline"
          >
            time zone guide
          </Link>{" "}
          for detailed workflows.
        </p>

        <h2
          id="growth"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Keeping members engaged
        </h2>
        <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-8">
          <li>
            Mix genres each month — comedy after a heavy drama prevents burnout.
          </li>
          <li>
            Run seasonal simulcasts alongside a completed series so there&apos;s
            always something fresh. See{" "}
            <Link
              href="/guides/how-to-watch-seasonal-anime-together"
              className="text-brand-orange hover:underline"
            >
              how to watch seasonal anime together
            </Link>
            .
          </li>
          <li>
            Celebrate arc finales with themed watch nights — snacks, voice chat,
            or a post-episode discussion thread.
          </li>
          <li>
            Drop shows that lose momentum at mid-season rather than forcing
            completion. A club that finishes strong keeps members longer.
          </li>
        </ul>

        <h2
          id="related"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Related guides
        </h2>
        <ul className="space-y-2 text-brand-orange mb-8">
          <li>
            <Link href="/guides/first-anime-watch-party-checklist" className="hover:underline">
              First anime watch party checklist
            </Link>
          </li>
          <li>
            <Link href="/guides/how-to-watch-anime-with-a-group" className="hover:underline">
              How to watch anime with a group
            </Link>
          </li>
          <li>
            <Link href="/guides/how-to-watch-anime-with-friends-on-discord" className="hover:underline">
              How to watch anime with friends on Discord
            </Link>
          </li>
          <li>
            <Link href="/resources/group-watch-onboarding" className="hover:underline">
              Group watch onboarding resource
            </Link>
          </li>
        </ul>
      </SeoPageLayout>
    </>
  );
}
