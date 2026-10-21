import type { Metadata } from "next";
import Link from "next/link";
import { HowToJsonLd } from "@/components/json-ld";
import { InstallLink } from "@/components/install-link";
import { ResponsiveDataTable } from "@/components/responsive-data-table";
import {
  SeoGuideAnswer,
  SeoGuideBulletList,
  SeoGuideNote,
  SeoGuideOptions,
  SeoGuideRelated,
  SeoGuideSteps,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { PRICING_TRIAL_NOTE } from "@/lib/pricing-copy";

const PAGE_PATH = "/guides/how-to-watch-anime-for-free-with-friends";

const SOURCES = [
  { href: "https://www.youtube.com/@MuseAsia", label: "Muse Asia on YouTube" },
  { href: "https://www.youtube.com/@AniOneAsia", label: "Ani-One Asia on YouTube" },
  { href: "https://www.crunchyroll.com/premium", label: "Crunchyroll plans page" },
  { href: "https://www.crunchyroll.com/tos", label: "Crunchyroll Terms of Service" },
];

export const metadata: Metadata = {
  title: "How to Watch Anime Free With Friends (Legally)",
  description:
    "Free anime on YouTube from official channels like Muse Asia and Ani-One, their region limits, Crunchyroll's trial, and how to watch together long distance.",
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "AniDachi – watch anime together, in perfect sync",
      },
    ],

    title: "How to Watch Anime Free With Friends (Legally)",
    description:
      "Official free anime channels on YouTube, where they play, and the cheapest legal way to watch together long distance.",
    url: PAGE_PATH,
  },
};

const faq = [
  {
    question: "Where can I watch anime for free legally?",
    answer:
      "Official YouTube channels run by licensors, such as Muse Asia and Ani-One Asia, publish full episodes free. Both mainly serve Asian countries; in our 20 Oct 2026 check from Europe, sampled episodes showed Video unavailable. Crunchyroll's plans page lists paid plans with a free trial for new and eligible subscribers.",
  },
  {
    question: "Is there free anime on YouTube?",
    answer:
      "Yes, from official channels. Muse Asia posts English-subtitled simulcast playlists, and Ani-One Asia posts episodes mostly with Chinese subtitles, with sister channels for Thailand, the Philippines, Vietnam, Indonesia and India. Availability depends on your country, so check each episode.",
  },
  {
    question: "How can we watch anime together long distance for free?",
    answer:
      "The free route is an official YouTube episode that plays in both countries plus a voice call and a countdown. For synced players, AniDachi lets friends join free, but the host needs Plus or Pro, including a 3-day trial for eligible accounts.",
  },
  {
    question: "Is Crunchyroll free?",
    answer:
      "Not according to its plans page on 20 Oct 2026, which lists paid plans only (Fan and Mega Fan in our region) with a free trial for new and eligible subscribers. We could not confirm from Crunchyroll's own pages whether any episodes still play without a plan.",
  },
  {
    question: "Is AniDachi free?",
    answer:
      "Joining is free: a free AniDachi account can join a friend's room. Creating rooms needs Plus or Pro, including the trial. AniDachi does not provide any anime itself; each person plays the episode on YouTube, Crunchyroll or Netflix.",
  },
  {
    question: "Are anime streaming sites without a licence safe to use with friends?",
    answer:
      "We only cover licensed sources. Unlicensed sites are not supported by AniDachi, can carry intrusive ads and malware risks, and are not legal in most countries. Stick to official channels and services.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "sources-table", label: "Legal free and low-cost sources", level: 2 },
  { id: "youtube", label: "Free anime on YouTube", level: 2 },
  { id: "crunchyroll", label: "Crunchyroll: trial, not free", level: 2 },
  { id: "together", label: "Watching together for free", level: 2 },
  { id: "setup", label: "Step-by-step", level: 2 },
  { id: "limits", label: "Limits and honest caveats", level: 2 },
  { id: "sources", label: "Sources", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

const howToSteps = [
  {
    name: "Find an episode that plays for everyone",
    text: "Pick an episode on an official channel and have every friend open it in their own country. Drop any episode that shows Video unavailable for someone.",
  },
  {
    name: "Install AniDachi in desktop Chrome",
    text: "Everyone adds the extension from the official Chrome Web Store listing, starting at /extension. Joining needs only a free account.",
  },
  {
    name: "Choose a host with Plus, Pro or a trial",
    text: "One person hosts. Eligible accounts can start a 3-day trial of Plus or Pro once; friends never need a plan to join.",
  },
  {
    name: "Create the room on the episode",
    text: "The host opens the full youtube.com/watch page, clicks the AniDachi capsule on the player and chooses Create room.",
  },
  {
    name: "Share the link and watch",
    text: "Friends open the invite. AniDachi keeps play, pause and seek in sync, and you can chat, react or talk on voice and video.",
  },
];

const sourceRows = [
  {
    source: "Muse Asia (YouTube)",
    cost: "Free",
    subs: "English subtitles on simulcast playlists",
    region: "Asia; sampled episodes unavailable from Europe",
    anidachi: "Yes, on full youtube.com/watch pages",
  },
  {
    source: "Ani-One Asia (YouTube)",
    cost: "Free",
    subs: "Mostly Chinese subtitles; regional sister channels",
    region: "Asia; sampled episodes unavailable from Europe",
    anidachi: "Yes, on full youtube.com/watch pages",
  },
  {
    source: "Crunchyroll",
    cost: "Paid plans; free trial for new and eligible subscribers",
    subs: "Subtitles and dubs vary by title and region",
    region: "Varies by territory",
    anidachi: "Yes, each person on their own account",
  },
  {
    source: "Netflix",
    cost: "Paid",
    subs: "Varies by title",
    region: "Catalog varies by country",
    anidachi: "Yes, each person needs access to the title",
  },
];

export default function HowToWatchAnimeForFreeWithFriendsPage() {
  return (
    <>
      <HowToJsonLd
        name="How to watch anime for free with friends online"
        description="Use an official free episode that plays for everyone, then sync it in an AniDachi room where friends join free."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Watch Anime Together", url: "/watch-anime-together" },
          { name: "How to watch anime for free with friends", url: PAGE_PATH },
        ]}
        title="How to watch anime free with friends (legally)"
        description="Official free anime channels on YouTube, where they play, and the cheapest legal way to watch together."
        url={PAGE_PATH}
        datePublished="2026-06-21"
        dateModified="2026-10-20"
        faq={faq}
        headings={tocHeadings}
        aboveFoldCta
      >
        <SeoGuideTitle>How to Watch Anime Free With Friends (Legally)</SeoGuideTitle>

        <h2 id="answer" className="scroll-mt-24">
          Short answer
        </h2>
        <SeoGuideAnswer>
          <strong>
            The legal free option is anime that licensors publish on YouTube,
            such as Muse Asia and Ani-One Asia. Both mainly serve Asian
            countries, so check every friend can play the episode. Crunchyroll
            is paid, with a trial. To watch in sync, AniDachi lets friends join
            free; one host needs Plus, Pro or a trial.
          </strong>
        </SeoGuideAnswer>

        <p className="text-foreground/80 leading-relaxed mb-6">
          This page answers three searches at once: where to find free anime
          on YouTube, which anime sites are legal, and how to watch anime
          together long distance without paying. Everything third-party below
          was checked on 20 October 2026; links are in the sources section.
          Channel line-ups change every season, so treat the examples as a
          starting point and check before you invite people.
        </p>

        <h2
          id="sources-table"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Legal free and low-cost anime sources
        </h2>
        <ResponsiveDataTable
          titleKey="source"
          columns={[
            { key: "source", label: "Source" },
            { key: "cost", label: "Cost" },
            { key: "subs", label: "Subtitles" },
            { key: "region", label: "Where it plays" },
            { key: "anidachi", label: "Works with AniDachi" },
          ]}
          rows={sourceRows}
        />
        <p className="text-foreground/80 leading-relaxed mb-8">
          &quot;Sampled episodes unavailable from Europe&quot; means that on
          20 October 2026 we opened recent episodes from each channel from a
          European connection and YouTube showed Video unavailable. Teasers
          played. We could not test from the US or Asia, so check from your
          own country.
        </p>

        <h2
          id="youtube"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Free anime on YouTube: official channels
        </h2>
        <SeoGuideOptions
          options={[
            {
              title: "Muse Asia",
              body: "Run by Muse Communication, which describes itself as a licensing agent for anime rights holders across Asia. Its channel had playlists for the October 2026 season with English subtitles, such as Firefly Wedding and A Tale of the Secret Saint. Episodes are limited to the countries it licenses.",
              highlight: true,
            },
            {
              title: "Ani-One Asia",
              body: "Run by Medialink Group. The main channel posts new-season episodes, mostly with Traditional Chinese subtitles, and links sister channels for Thailand, the Philippines, Vietnam, Indonesia and India. Pick the channel for your country.",
            },
            {
              title: "How to tell an upload is official",
              body: "Check the channel name matches the licensor, the channel links to the company's own site, and episodes sit in season playlists. Re-uploads on random channels get removed and are not legal.",
            },
          ]}
        />
        <p className="text-foreground/80 leading-relaxed mb-8">
          AniDachi syncs full youtube.com/watch pages in desktop Chrome, which
          is how these episodes are published. Shorts, embedded players and
          the YouTube mobile app are not supported. If a YouTube ad plays for
          the host, the room pauses until it ends. More on YouTube rooms:{" "}
          <Link href="/watch-youtube-together" className="text-brand-orange hover:underline">
            watch YouTube together
          </Link>
          .
        </p>

        <h2
          id="crunchyroll"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Crunchyroll: trial, not free
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          Many lists still call Crunchyroll a free anime site. On 20 October
          2026 its plans page listed only paid plans, with a free trial for
          new and eligible subscribers that renews at the chosen price unless
          cancelled. We could not confirm from Crunchyroll&apos;s own pages
          whether any episodes still play without a plan, so we do not count
          it as free.
        </p>
        <p className="text-foreground/80 leading-relaxed mb-8">
          Crunchyroll&apos;s terms also limit one account to one household,
          so a free trial for one friend does not cover the group. Which plan
          each person needs is covered in{" "}
          <Link
            href="/guides/does-everyone-need-crunchyroll-premium-for-watch-party"
            className="text-brand-orange hover:underline"
          >
            does everyone need Crunchyroll Premium
          </Link>
          .
        </p>

        <h2
          id="together"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Watching together for free, including long distance
        </h2>
        <SeoGuideBulletList
          items={[
            {
              title: "Completely free",
              body: "An official YouTube episode that plays in every friend's country, a voice call, and a countdown to press play. It works on any device. The catch: players drift after pauses, and nobody stays in sync on their own.",
            },
            {
              title: "Free for friends, one host pays or trials",
              body: "AniDachi keeps every player in sync with chat, reactions, voice and video. Friends join on free accounts. Creating a room needs Plus or Pro, which eligible accounts can try for 3 days.",
            },
            {
              title: "Long distance across regions",
              body: "Free YouTube channels are region-locked, so two people in different countries may not see the same episode. Test the exact episode on both sides first; if it fails, pick another channel or a service you both have.",
            },
          ]}
        />
        <p className="text-foreground/80 leading-relaxed mb-8">
          {PRICING_TRIAL_NOTE} Ready to try a synced room?{" "}
          <InstallLink href="/extension" className="text-brand-orange hover:underline">
            Add AniDachi to Chrome
          </InstallLink>
          . For couples, our{" "}
          <Link
            href="/guides/how-to-watch-anime-long-distance"
            className="text-brand-orange hover:underline"
          >
            watch anime long distance guide
          </Link>{" "}
          covers time zones and calls.
        </p>

        <h2
          id="setup"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Step-by-step: free episode, synced room
        </h2>
        <SeoGuideSteps steps={howToSteps} />

        <h2
          id="limits"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Limits and honest caveats
        </h2>
        <SeoGuideBulletList
          items={[
            {
              title: "AniDachi has no catalog",
              body: "It syncs players on YouTube, Crunchyroll and Netflix. It never streams video to friends and cannot unlock an episode.",
            },
            {
              title: "Free accounts can't host",
              body: "A free AniDachi account joins rooms. Hosting needs Plus or Pro, including the trial.",
            },
            {
              title: "Desktop only",
              body: "Everyone needs desktop Chrome 121 or newer, or Chromium Edge. Phones and TV apps cannot run the extension.",
            },
            {
              title: "No VPN workarounds",
              body: "Crunchyroll's terms ask you to use it only where it is officially offered, and we do not suggest region tricks for any service.",
            },
          ]}
        />
        <SeoGuideNote>
          Want the YouTube side in more depth? See{" "}
          <Link href="/guides/youtube-watch-party-free">YouTube watch party free</Link>{" "}
          for what costs nothing when syncing YouTube.
        </SeoGuideNote>

        <h2
          id="sources"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Sources
        </h2>
        <p className="text-foreground/80 mb-8">
          Checked 20 Oct 2026:{" "}
          {SOURCES.map((source, index) => (
            <span key={source.href}>
              {index > 0 ? ", " : null}
              <a
                href={source.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-orange hover:underline"
              >
                {source.label}
              </a>
            </span>
          ))}
          . Region results come from a single check from Europe. AniDachi is
          not affiliated with any channel or service named here.
        </p>

        <h2 id="related" className="scroll-mt-24">
          Related guides
        </h2>
        <SeoGuideRelated
          links={[
            { href: "/watch-youtube-together", label: "Watch YouTube together" },
            { href: "/watch-anime-together", label: "Watch anime together online" },
            {
              href: "/guides/how-to-watch-anime-with-friends-online",
              label: "How to watch anime with friends online",
            },
            {
              href: "/guides/does-crunchyroll-have-watch-party",
              label: "Does Crunchyroll have a watch party?",
            },
            {
              href: "/guides/how-to-watch-anime-long-distance",
              label: "How to watch anime long distance",
            },
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
