import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { HowToJsonLd } from "@/components/json-ld";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/opengraph-image.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "How to Watch Seasonal Anime Together (2026) — Weekly Simulcast Guide",
  description:
    "Watch seasonal anime with friends every simulcast week: schedule drop nights, sync Crunchyroll playback, and plan independent catch-up after missed sessions.",
  alternates: { canonical: "/guides/how-to-watch-seasonal-anime-together" },
  openGraph: {
    title: "How to Watch Seasonal Anime Together",
    description:
      "Weekly anime club workflow for simulcast seasons — live premiere nights, spoiler boundaries, and catch-up plans for missed sessions.",
    url: "/guides/how-to-watch-seasonal-anime-together",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Watch Seasonal Anime Together",
    description: "Simulcast watch party setup for friend groups on Crunchyroll.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "What is seasonal anime?",
    answer:
      "Seasonal anime refers to new series that premiere in quarterly batches — winter (January), spring (April), summer (July), and fall (October). Most simulcast on Crunchyroll within hours of the Japan broadcast, typically one episode per week for 12–24 weeks.",
  },
  {
    question: "How do friend groups watch seasonal anime together?",
    answer:
      "Pick 1–3 seasonal shows, schedule a weekly live room around the simulcast drop, and use AniDachi for synced playback and live chat. Members who miss the session can watch independently before the next episode, then discuss it in a separate labeled chat.",
  },
  {
    question: "Can we watch seasonal anime if we're in different time zones?",
    answer:
      "Schedule a live room at a time that works for the group and rotate the time fairly. Members who miss it can watch independently. Keep later-episode spoilers in a separate chat; AniDachi Async catch-up is coming soon.",
  },
  {
    question: "How many seasonal anime should a group commit to?",
    answer:
      "One primary show and one optional backup is the sweet spot for most friend groups. Three or more simultaneous seasonals usually means someone falls behind and spoilers become a problem by mid-season.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "why-seasonal", label: "Why watch seasonal together?", level: 2 },
  { id: "howto", label: "HowTo: weekly simulcast workflow", level: 2 },
  { id: "schedule", label: "Building your seasonal schedule", level: 2 },
  { id: "spoiler-rules", label: "Spoiler rules for weekly drops", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

const howToSteps = [
  {
    name: "Pick your seasonal lineup",
    text: "At the start of each cour (Jan/Apr/Jul/Oct), agree on 1–2 shows from the seasonal chart. Check that every member can stream them on Crunchyroll in their region.",
  },
  {
    name: "Create a live watchroom",
    text: "Install AniDachi from the Chrome Web Store, open the first episode, and create a live room with your own Plus or Pro access, including an active trial. Keep season plans and between-session notes in a separate group chat.",
  },
  {
    name: "Schedule weekly sync nights",
    text: "Block a recurring time after the simulcast drop. Use live sync for premiere reactions and leave time for anyone who misses the meeting to catch up independently.",
  },
  {
    name: "Pin your spoiler boundary",
    text: "After each weekly sync, update the safe episode number in your watchroom. Members who watch early stay behind the pin until the group catches up.",
  },
  {
    name: "Review at mid-season",
    text: "At episode 6, check if the group still wants to continue. Drop shows that lost momentum rather than forcing completion — seasonal anime is meant to be fun, not homework.",
  },
];

export default function HowToWatchSeasonalAnimeTogetherPage() {
  return (
    <>
      <HowToJsonLd
        name="How to watch seasonal anime together"
        description="Set up a weekly simulcast watch party on Crunchyroll with synced playback, live chat, and clear spoiler rules."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Watch Anime Together", url: "/watch-anime-together" },
          {
            name: "How to watch seasonal anime together",
            url: "/guides/how-to-watch-seasonal-anime-together",
          },
        ]}
        title="How to watch seasonal anime together"
        description="Weekly simulcast watch party guide for friend groups on Crunchyroll."
        url="/guides/how-to-watch-seasonal-anime-together"
        datePublished="2026-06-08"
        dateModified="2026-10-01"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImageAbsolute}
      >
        <h1 className="text-4xl font-bold text-foreground mb-6">
          How to watch seasonal anime together
        </h1>
        <p className="text-xl text-foreground/80 leading-relaxed mb-8">
          <strong>
            Seasonal anime drops one episode per week — perfect for a recurring
            watch party if you set a schedule and clear spoiler rules. AniDachi handles live sync on premiere night. Keep season plans and discussions between sessions in a separate group chat.
          </strong>
        </p>

        <h2
          id="why-seasonal"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Why watch seasonal anime together?
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-8">
          Seasonal anime creates a shared ritual — every week your group meets in a live room for a fresh episode, fresh theories, and fresh reactions. Unlike bingeing a completed series, simulcasts build
          anticipation between episodes and give your group something to look
          forward to all quarter. The rhythm also prevents burnout: one episode
          per week is sustainable for busy schedules.
        </p>

        <h2
          id="howto"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          HowTo: weekly simulcast workflow
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
          Building your seasonal schedule
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          Simulcast drops vary by show and region, but most Crunchyroll simulcasts
          go live within 1–2 hours of the Japan broadcast. Check the{" "}
          <Link href="/glossary/anime-simulcast" className="text-brand-orange hover:underline">
            anime simulcast glossary
          </Link>{" "}
          for timing basics, then block a recurring slot:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-8">
          <li>
            <strong>Saturday or Sunday evenings</strong> work for most groups in
            North America — many seasonals drop Friday/Saturday JST.
          </li>
          <li>
            Set a calendar invite with the watchroom link so nobody has to hunt
            for it each week.
          </li>
          <li>
            If your group spans time zones, rotate the sync time monthly so the
            same person isn&apos;t always watching at 3 AM.
          </li>
        </ul>

        <h2
          id="spoiler-rules"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Spoiler rules for weekly drops
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          Seasonal anime spoilers travel fast — episode 1 reactions hit social
          media within minutes of the drop. Inside your AniDachi watchroom:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-8">
          <li>
            No reactions past the pinned episode number until the weekly sync
            happens.
          </li>
          <li>
            Use separate, clearly labeled group chats for later episodes so mid-season joiners can avoid reading ahead.
          </li>
          <li>
            React to feelings (&quot;that ending destroyed me&quot;) not plot
            (&quot;the villain was his dad&quot;) until everyone has watched.
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
            <Link href="/guides/how-to-run-an-online-anime-club" className="hover:underline">
              How to run an online anime club
            </Link>
          </li>
          <li>
            <Link href="/guides/how-to-watch-anime-with-friends-in-different-time-zones" className="hover:underline">
              How to watch anime in different time zones
            </Link>
          </li>
          <li>
            <Link href="/guides/asynchronous-vs-live-watch-party" className="hover:underline">
              Async vs live watch parties
            </Link>
          </li>
          <li>
            <Link href="/guides/best-anime-to-watch-with-friends" className="hover:underline">
              Best anime to watch with friends
            </Link>
          </li>
        </ul>
      </SeoPageLayout>
    </>
  );
}
