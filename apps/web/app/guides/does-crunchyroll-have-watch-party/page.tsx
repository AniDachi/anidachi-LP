import type { Metadata } from "next";
import Link from "next/link";
import { HowToJsonLd } from "@/components/json-ld";
import { InstallLink } from "@/components/install-link";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import {
  SeoGuideAnswer,
  SeoGuideBulletList,
  SeoGuideRelated,
  SeoGuideSteps,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getGuideLinks } from "@/lib/guide-links";
import { PRICING_FREE_TIER_TABLE } from "@/lib/pricing-copy";

const PAGE_PATH = "/guides/does-crunchyroll-have-watch-party";

const SOURCES = [
  { href: "https://www.crunchyroll.com/premium", label: "Crunchyroll plans page" },
  { href: "https://www.crunchyroll.com/tos", label: "Crunchyroll Terms of Service" },
  { href: "https://www.funimation.com/", label: "funimation.com (redirects to Crunchyroll)" },
  { href: "https://www.teleparty.com/crunchyroll", label: "Teleparty Crunchyroll page" },
  { href: "https://www.teleparty.com/support", label: "Teleparty support FAQ" },
];

export const metadata: Metadata = {
  title: "Does Crunchyroll Have a Watch Party? (Oct 2026)",
  description:
    "No. As of 20 Oct 2026 Crunchyroll has no built-in watch party or group watch. What it offers instead, a short history, and how to watch Crunchyroll together.",
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

    title: "Does Crunchyroll Have a Watch Party Feature?",
    description:
      "Checked 20 Oct 2026: Crunchyroll has no native watch party. Here is how groups watch together instead.",
    url: PAGE_PATH,
  },
};

const faq = [
  {
    question: "Does Crunchyroll have a watch party feature?",
    answer:
      "No. As of 20 October 2026, Crunchyroll has no built-in watch party or synced group watch. Its plans page lists no such feature. To watch together in sync, each person opens the episode on their own account and a third-party extension such as AniDachi keeps the players aligned.",
  },
  {
    question: "Does Crunchyroll have group watch?",
    answer:
      "No. There is no way to start a shared, synced session inside Crunchyroll's website or apps. Groups use a browser extension, or a voice call with a countdown.",
  },
  {
    question: "Can you watch Crunchyroll together with friends online?",
    answer:
      "Yes, with a third-party tool. AniDachi syncs each viewer's own Crunchyroll player in desktop Chrome and adds live chat, voice and video. Everyone needs their own Crunchyroll access. Friends join AniDachi free; the host needs Plus, Pro or a trial.",
  },
  {
    question: "Does Teleparty work with Crunchyroll?",
    answer:
      "Yes. Teleparty's Crunchyroll page, checked 20 Oct 2026, says hosting a Crunchyroll party needs Teleparty Premium, which has a free trial, and that guests join free. Its support FAQ says voice and video chat also need Premium. AniDachi rooms include voice and video calls; only the host needs a paid plan.",
  },
  {
    question: "Did Funimation have its own watch party?",
    answer:
      "We could not confirm one from official sources, and it no longer matters for viewers: Funimation no longer runs as a separate service, and funimation.com now redirects to crunchyroll.com. Crunchyroll itself has no watch party.",
  },
  {
    question: "Can I use Discord to watch Crunchyroll with friends?",
    answer:
      "For voice, yes. Screen sharing the Crunchyroll player often shows a black screen because the video is protected, and only one person's stream reaches everyone. Keep Discord for talking and let each person play Crunchyroll on their own account in sync.",
  },
  {
    question: "Will Crunchyroll add a watch party feature?",
    answer:
      "Crunchyroll has not announced one on its plans page or in its terms as of 20 October 2026. We will update this page if that changes. Until then, extensions are the only way to sync playback.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "what-crunchyroll-offers", label: "What Crunchyroll offers", level: 2 },
  { id: "history", label: "A short history", level: 2 },
  { id: "alternatives", label: "Ways to watch together", level: 2 },
  { id: "setup", label: "Set up a watch party", level: 2 },
  { id: "sources", label: "Sources", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

const howToSteps = [
  {
    name: "Install AniDachi",
    text: "Everyone adds the extension in desktop Chrome from the official Chrome Web Store listing, starting at /extension.",
  },
  {
    name: "Open Crunchyroll on your own account",
    text: "Each person signs in to their own Crunchyroll account and checks that the episode plays in their region.",
  },
  {
    name: "Create a room",
    text: "The host, with Plus, Pro or a trial, clicks the AniDachi capsule on the player and chooses Create room.",
  },
  {
    name: "Share the invite",
    text: "Send the link in Discord, WhatsApp or wherever the group talks. Friends join on free accounts.",
  },
  {
    name: "Watch together",
    text: "AniDachi moves guests to the host's episode and keeps play, pause and seek in sync. Chat, react, or turn on voice and video.",
  },
];

export default function DoesCrunchyrollHaveWatchPartyPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["pillar-watch-crunchyroll"],
    excludeHref: PAGE_PATH,
    limit: 4,
  });

  return (
    <>
      <HowToJsonLd
        name="How to watch Crunchyroll together without a built-in watch party"
        description="Each person opens Crunchyroll on their own account while an AniDachi room keeps playback in sync."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Watch Crunchyroll Together", url: "/watch-crunchyroll-together" },
          { name: "Does Crunchyroll have watch party?", url: PAGE_PATH },
        ]}
        title="Does Crunchyroll have a watch party feature?"
        description="Checked 20 Oct 2026: Crunchyroll has no native watch party. What it offers and how to watch together with friends."
        url={PAGE_PATH}
        datePublished="2026-06-21"
        dateModified="2026-10-20"
        faq={faq}
        headings={tocHeadings}
        aboveFoldCta
      >
        <SeoGuideTitle>Does Crunchyroll Have a Watch Party Feature?</SeoGuideTitle>

        <h2 id="answer" className="scroll-mt-24">
          Short answer
        </h2>
        <SeoGuideAnswer>
          <strong>
            No. As of 20 October 2026, Crunchyroll has no built-in watch party,
            group watch or synced viewing. Its plans page and terms list no such
            feature. To watch Crunchyroll with friends in sync, each person
            opens the episode on their own account and a browser extension,
            such as AniDachi, keeps everyone&apos;s player on the same second.
          </strong>
        </SeoGuideAnswer>

        <p className="text-foreground/80 leading-relaxed mb-6">
          We re-check this answer when we update the page. The step-by-step
          setup and a comparison of every method are on the{" "}
          <Link href="/watch-crunchyroll-together" className="text-brand-orange hover:underline">
            Crunchyroll watch party guide
          </Link>
          ; this page sticks to the yes-or-no question and what sits around it.
        </p>

        <h2
          id="what-crunchyroll-offers"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          What Crunchyroll actually offers
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          Crunchyroll&apos;s paid plans, as listed on its plans page, cover
          watching on your own account. Nothing in them connects two
          people&apos;s players:
        </p>
        <SeoGuideBulletList
          items={[
            {
              title: "Streams on several devices",
              body: "Fan allows 1 device at a time and Mega Fan 4. Those streams are for one household; the terms forbid sharing a login with people outside it.",
            },
            {
              title: "Personal lists and progress",
              body: "Watchlists and Continue Watching belong to your account. Friends cannot see them or join you from them.",
            },
            {
              title: "No sync",
              body: "If you and a friend press play on the same episode at the same moment, the two players drift apart as soon as one buffers or pauses. There is no room, invite or shared play button.",
            },
          ]}
        />
        <p className="text-foreground/80 leading-relaxed mb-8">
          Crunchyroll&apos;s terms also prohibit stream capture and
          retransmitting its content, which is one more reason screen sharing
          one person&apos;s stream is a poor substitute.
        </p>

        <h2
          id="history"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          A short history
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          People often ask because other streaming brands have had built-in
          parties, and because anime fans used to split between Crunchyroll and
          Funimation. Funimation no longer runs as a separate service: on 20
          October 2026, funimation.com redirected straight to crunchyroll.com.
          That leaves Crunchyroll as the one place to check, and it has no
          watch party.
        </p>
        <p className="text-foreground/80 leading-relaxed mb-8">
          Because of that gap, third-party extensions filled it. Some have
          Crunchyroll in their name, which causes confusion; they are not made
          by Crunchyroll. If a tool calls itself a Crunchyroll watch party,
          check the publisher on its Chrome Web Store listing. Our{" "}
          <Link
            href="/guides/crunchyroll-watch-party-chrome-extension"
            className="text-brand-orange hover:underline"
          >
            Crunchyroll watch party extension guide
          </Link>{" "}
          walks through installing one and what its permissions mean.
        </p>

        <h2
          id="alternatives"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Ways to watch Crunchyroll together
        </h2>
        <ResponsiveCompareTable
          columns={[
            { id: "anidachi", label: "AniDachi", highlight: true },
            { id: "teleparty", label: "Teleparty" },
            { id: "discord", label: "Discord share" },
          ]}
          rows={[
            {
              feature: "Synced players",
              values: { anidachi: "yes", teleparty: "yes", discord: "no" },
            },
            {
              feature: "Each person on own account",
              values: { anidachi: "yes", teleparty: "yes", discord: "no" },
            },
            {
              feature: "Voice and video in the room",
              values: { anidachi: "yes", teleparty: "Premium only", discord: "Voice via Discord" },
            },
            {
              feature: "Cost to host on Crunchyroll",
              values: {
                anidachi: PRICING_FREE_TIER_TABLE,
                teleparty: "Teleparty Premium; guests free",
                discord: "Free, often black screen",
              },
            },
          ]}
        />
        <p className="text-foreground/80 leading-relaxed mb-4">
          AniDachi works in desktop Chrome on Crunchyroll, YouTube and Netflix.
          Guests join free; the host needs Plus, Pro or a trial.{" "}
          <InstallLink href="/extension" className="text-brand-orange hover:underline">
            Add AniDachi to Chrome
          </InstallLink>{" "}
          to try a room. For other tools, see{" "}
          <Link href="/compare/anidachi-vs-teleparty" className="text-brand-orange hover:underline">
            AniDachi vs Teleparty
          </Link>{" "}
          and{" "}
          <Link
            href="/guides/can-you-screen-share-crunchyroll-on-discord"
            className="text-brand-orange hover:underline"
          >
            why Discord screen share black-screens Crunchyroll
          </Link>
          .
        </p>
        <p className="text-foreground/80 leading-relaxed mb-8">
          Whatever tool you pick, each viewer still needs Crunchyroll access
          that can play the episode in their region; read{" "}
          <Link
            href="/guides/does-everyone-need-crunchyroll-premium-for-watch-party"
            className="text-brand-orange hover:underline"
          >
            does everyone need Crunchyroll Premium
          </Link>
          .
        </p>

        <h2
          id="setup"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Set up a Crunchyroll watch party with AniDachi
        </h2>
        <SeoGuideSteps steps={howToSteps} />
        <p className="text-foreground/80 leading-relaxed mb-8">
          The host controls play, pause and episode changes for the room.
          Plus rooms hold 6 people and Pro rooms 15, host included. If a friend
          cannot join or the room drifts, the{" "}
          <Link
            href="/guides/crunchyroll-watch-party-not-working"
            className="text-brand-orange hover:underline"
          >
            Crunchyroll watch party troubleshooting guide
          </Link>{" "}
          matches each on-screen message to a fix.
        </p>

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
          . AniDachi is not affiliated with
          Crunchyroll or Teleparty.
        </p>

        <h2 id="related" className="scroll-mt-24">
          Related guides
        </h2>
        <SeoGuideRelated
          links={[
            { href: "/watch-crunchyroll-together", label: "Crunchyroll watch party guide" },
            {
              href: "/guides/how-to-watch-crunchyroll-with-friends",
              label: "How to watch Crunchyroll with friends",
            },
            {
              href: "/guides/does-teleparty-work-with-crunchyroll",
              label: "Does Teleparty work with Crunchyroll?",
            },
            { href: "/guides/is-crunchyroll-party-worth-it", label: "Is Crunchyroll Party worth it?" },
            ...relatedGuideLinks
              .filter(
                (g) =>
                  ![
                    "/watch-crunchyroll-together",
                    "/guides/how-to-watch-crunchyroll-with-friends",
                    "/guides/does-teleparty-work-with-crunchyroll",
                    "/guides/is-crunchyroll-party-worth-it",
                  ].includes(g.href),
              )
              .map((g) => ({ href: g.href, label: g.label })),
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
