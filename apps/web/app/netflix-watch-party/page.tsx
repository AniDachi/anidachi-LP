import { PRICING_FREE20_SUMMARY } from "@/lib/pricing-copy";
import type { Metadata } from "next";
import Link from "next/link";
import { getPlanPolicy } from "@anidachi/protocol";
import { HubCtaBand } from "@/components/hub-cta-band";
import {
  HUB_INSTALL_STEP,
  HubFeatureGrid,
  HubLandingLayout,
} from "@/components/hub-landing-layout";
import { HowToJsonLd } from "@/components/json-ld";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import {
  SeoGuideBulletList,
  SeoGuideNote,
  SeoGuideOptions,
  SeoGuideRelated,
} from "@/components/seo-guide-blocks";
import type { TocHeading } from "@/components/table-of-contents";
import { PRICING_PLUS_SHORT, PRICING_PRO_SHORT } from "@/lib/pricing-copy";
import { getSeoSiteOrigin } from "@/lib/site-url";

const articleImage = `${getSeoSiteOrigin()}/opengraph-image.png`;

const PAGE_PATH = "/netflix-watch-party";
const FREE_ROOM = getPlanPolicy("free").maxParticipants;
const PLUS_ROOM = getPlanPolicy("plus").maxParticipants;
const PRO_ROOM = getPlanPolicy("pro").maxParticipants;

const PAGE_TITLE = "Netflix Watch Party: Watch Together in Sync";
const PAGE_DESCRIPTION =
  "Netflix has no built-in watch party. Sync a Netflix movie or episode in desktop Chrome with AniDachi: own accounts, chat, voice and video, friends join free.";

export const metadata: Metadata = {
  title: "Netflix Watch Party: Watch Together in Sync",
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/netflix-watch-party" },
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: "/netflix-watch-party",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/opengraph-image.png"],
  },
};

/** Competitor and Netflix facts on this page, checked 20 Oct 2026. */
const SOURCES = [
  { href: "https://www.teleparty.com/support", label: "Teleparty support FAQ" },
  {
    href: "https://chromewebstore.google.com/detail/netflix-party-is-now-tele/oocalimimngaihdkbihfgmpkcpnmlaoa",
    label: "Teleparty Chrome Web Store listing",
  },
  { href: "https://help.netflix.com/en/node/123277", label: "Netflix Help: sharing your account" },
  { href: "https://help.netflix.com/en/node/24853", label: "Netflix Help: watching in another country" },
];

/** One step list for the visible "How it works" section and the HowTo JSON-LD, so they always match. */
const howToSteps = [
  HUB_INSTALL_STEP,
  {
    name: "Open the Netflix title",
    text: "Sign in to your own Netflix account and start the movie or episode. The address bar should read netflix.com/watch/ followed by a number; the browse row and the info page are not the player.",
  },
  {
    name: "Create the room",
    text: "Click the AniDachi capsule at the top-right of the player and choose Create room.",
  },
  {
    name: "Share the invite link",
    text: "Copy the room link into your group chat, or invite saved friends and groups. Friends join free and play the same title on their own Netflix, in sync.",
  },
];

const faq = [
  {
    question: "Does Netflix have a watch party feature?",
    answer:
      "No. When we checked Netflix's Help Center on October 20, 2026, it described no watch party, group watch or synced viewing feature. To watch Netflix together you add a tool on top, such as AniDachi or Teleparty, or share your screen on a call.",
  },
  {
    question: "How do I start a Netflix watch party?",
    answer:
      `Install AniDachi from the Chrome Web Store in desktop Chrome, open the Netflix movie or episode on your own account, click the AniDachi capsule on the player and choose Create room, then send the invite link. ${PRICING_FREE20_SUMMARY} Friends join free.`,
  },
  {
    question: "Does everyone need Netflix for a watch party?",
    answer:
      "Yes. Each person plays the title on a Netflix account they are allowed to use. AniDachi and Teleparty both sync separate players; neither streams one person's Netflix to the others. Netflix says an account may not be shared outside the household.",
  },
  {
    question: "Does everyone need Netflix for Teleparty?",
    answer:
      "Yes. Teleparty's own FAQ says each participant needs access to an account for the streaming service used in the party, plus the Teleparty extension or app. The same rule applies to AniDachi.",
  },
  {
    question: "Can you do a Netflix watch party on your phone?",
    answer:
      "Not with AniDachi. It runs in desktop Chrome only and has no mobile app. Teleparty lists Android and iOS apps on its support page if your group needs phones.",
  },
  {
    question: "How many people can join a Netflix watch party on AniDachi?",
    answer:
      `Up to ${FREE_ROOM} people including the host on Free, ${PLUS_ROOM} on Plus, or ${PRO_ROOM} on Pro. Friends join free. Up to four cameras can be on at once.`,
  },
  {
    question: "Why is my Netflix watch party not syncing?",
    answer:
      "The usual causes are a friend on a different title or episode, a browse or info page instead of the player, a title missing from someone's country catalog, or a page that loaded before AniDachi. Have everyone open the same netflix.com/watch page and refresh once.",
  },
  {
    question: "Is a Netflix watch party free?",
    answer:
      `Joining an AniDachi room is free. ${PRICING_FREE20_SUMMARY} Teleparty hosts Netflix parties on its free tier with sync and text chat; its voice and video chat need Premium. Everyone still needs Netflix.`,
  },
  {
    question: "Why is Netflix black when I share my screen?",
    answer:
      "Netflix protects its video from capture, so screen sharing in Discord, Zoom or similar apps often shows a black box to viewers. Syncing each person's own Netflix player avoids the problem.",
  },
  {
    question: "Is there a way to watch Netflix together with video chat?",
    answer:
      "Yes. AniDachi rooms include voice and video calls on top of synced Netflix playback, so everyone can see and hear each other while the film plays.",
  },
  {
    question: "Can my friends pause the movie?",
    answer:
      "In AniDachi, the host controls play, pause and seeking for the whole room. Friends can ask in chat or by voice, and the host pauses for everyone.",
  },
  {
    question: "Can a group share one Netflix account for a watch party?",
    answer:
      "Only within one household. Netflix's Help Center says an account may not be shared outside the household, and each plan limits how many screens play at once. In a group watch, friends in different homes each use their own Netflix.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "how-it-works", label: "How to watch Netflix together", level: 2 },
  { id: "what-works", label: "What works and the limits", level: 2 },
  { id: "everyone-needs-netflix", label: "Does everyone need Netflix?", level: 2 },
  { id: "not-working", label: "Watch party not working", level: 2 },
  { id: "vs-teleparty", label: "AniDachi vs Teleparty", level: 2 },
  { id: "plan", label: "Plan your night", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function NetflixWatchPartyPage() {
  return (
    <>
      <HowToJsonLd
        name="How to host a Netflix watch party"
        description="Sync a Netflix movie or episode across desktop Chrome with AniDachi, each person on their own Netflix account."
        steps={howToSteps}
      />
      <HubLandingLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Netflix Watch Party", url: "/netflix-watch-party" },
        ]}
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        url={PAGE_PATH}
        datePublished="2026-10-08"
        dateModified="2026-11-10"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImage}
        itemList={[
          { name: "Netflix Party", url: "/netflix-party", position: 1 },
          {
            name: "Does Netflix have a watch party?",
            url: "/guides/does-netflix-have-a-watch-party",
            position: 2,
          },
          { name: "Virtual movie night", url: "/virtual-movie-night", position: 3 },
          {
            name: "Stream Netflix on Discord",
            url: "/guides/how-to-screen-share-netflix-on-discord",
            position: 4,
          },
        ]}
        h1="Netflix Watch Party"
        heroLead="Netflix has no watch party button. AniDachi adds one."
        heroCtaLabel="Start a Netflix Watch Party"
        heroWorksOn={["Netflix", "Crunchyroll", "YouTube"]}
        heroFinePrint="20 free minutes a day. Friends join free."
        answer={
          <>
            <strong>
              Netflix has no built-in watch party. AniDachi syncs a Netflix movie
              or episode across desktop Chrome: everyone plays it on their own
              Netflix account, and friends join free.
            </strong>{" "}
            Rooms add chat, reactions, voice and video, with push-to-talk on the
            V key.
          </>
        }
        steps={{
          id: "how-it-works",
          heading: "How to Watch Netflix Together",
          intro:
            "To watch Netflix with friends online, each person runs Netflix in their own Chrome tab, on their own account, and AniDachi keeps the players at the same moment. Nobody watches a compressed copy of someone else's screen.",
          items: howToSteps,
        }}
      >
        <h2 id="what-works" className="scroll-mt-24">
          What works today, and the limits
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Netflix support went live in the AniDachi Chrome extension in October 2026.
          This is what a room can and cannot do right now.
        </p>
        <ResponsiveCompareTable
          columns={[{ id: "status", label: "AniDachi on Netflix", highlight: true }]}
          rows={[
            { feature: "Netflix movies and episodes", values: { status: "yes" } },
            { feature: "Desktop Chrome", values: { status: "yes" } },
            { feature: "Synced play, pause and seek", values: { status: "yes" } },
            { feature: "On-player chat and emoji reactions", values: { status: "yes" } },
            { feature: "Voice and video calls, push-to-talk", values: { status: "yes" } },
            { feature: "Phones, tablets, smart TVs, consoles", values: { status: "no" } },
            { feature: "Other browsers", values: { status: "Not supported" } },
            { feature: "Trailers and recap clips", values: { status: "Not synced" } },
            { feature: "Netflix plan with ads", values: { status: "Not yet confirmed" } },
          ]}
        />
        <HubFeatureGrid
          items={[
            {
              title: "Room size",
              body: `Free rooms hold up to ${FREE_ROOM} people, including the host. A Plus host (${PRICING_PLUS_SHORT}) can have up to ${PLUS_ROOM}, and a Pro host (${PRICING_PRO_SHORT}) up to ${PRO_ROOM}.`,
            },
            {
              title: "Voice and video",
              body: "The host decides who gets a microphone or camera seat in People. Up to four cameras can be on at once. Hold V to talk, or click the microphone to leave it open.",
            },
            {
              title: "Playback",
              body: "The host controls play, pause and seeking for the room. Guests can still chat and react, and talk once the host gives them a microphone seat.",
            },
            {
              title: "Your own Netflix",
              body: "Each person needs their own access to the same title in their country. AniDachi never shares a Netflix login or video stream.",
            },
          ]}
        />
        <SeoGuideNote>
          <strong>About the ad plan:</strong> we have not yet confirmed AniDachi with
          Netflix&apos;s plan with ads. If someone in your group is on it, run a short
          test room before movie night.
        </SeoGuideNote>

        <h2
          id="everyone-needs-netflix"
          className="scroll-mt-24"
        >
          Does everyone need Netflix?
        </h2>
        <p className="mb-6 leading-relaxed text-ani-muted">
          Yes. Every watch party tool that syncs Netflix works the same way: each
          person&apos;s browser plays the title from Netflix. That is true for
          AniDachi and for Teleparty. Teleparty&apos;s own FAQ says each participant
          needs access to an account for the service being used. So if you are
          asking whether everyone needs Netflix for Teleparty, the answer is also
          yes.
        </p>
        <p className="mb-6 leading-relaxed text-ani-muted">
          What about borrowing a login? Netflix&apos;s Help Center says an account may
          not be shared outside your household; people elsewhere need their own
          account or an extra member slot on certain plans. Two people in the same
          home can use separate profiles on one account if the plan allows enough
          streams at the same time. Friends in different homes each need their own.
        </p>
        <p className="mb-6 leading-relaxed text-ani-muted">
          AniDachi accounts are a separate question. Friends join an AniDachi room on
          a Free account. {PRICING_FREE20_SUMMARY} For a group of five, Free&apos;s four-person cap is too small: one person needs Plus or Pro to host.
          Everyone still pays for Netflix as usual.
        </p>

        <h2 id="not-working" className="scroll-mt-24">
          Netflix watch party not working?
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Most failed nights come down to one person being somewhere slightly
          different. Run through this list before anyone reinstalls anything.
        </p>
        <SeoGuideBulletList
          items={[
            {
              title: "Wrong page",
              body: "AniDachi only works on the player page, netflix.com/watch/. If a friend is on the home row or the title's info page, have them press play first.",
            },
            {
              title: "Different episode or version",
              body: "Check the season and episode number out loud. A sync tool cannot line up Episode 3 with Episode 4.",
            },
            {
              title: "Region catalogs",
              body: "Netflix titles can differ by country. If one friend cannot find the title at all, it may not be licensed where they live. Pick something everyone can open.",
            },
            {
              title: "Profiles",
              body: "A Kids profile or a profile with maturity limits can hide a title. Switch to a profile that shows it.",
            },
            {
              title: "Browser",
              body: "Use desktop Chrome. AniDachi does not run in Safari, Firefox or the Netflix apps.",
            },
            {
              title: "Extension not ready",
              body: "Pin AniDachi from Chrome's puzzle-piece menu, then refresh the Netflix tab once so the extension loads on the page.",
            },
            {
              title: "Trailer or recap playing",
              body: "Trailers and recap clips do not sync. Skip to the main movie or episode.",
            },
          ]}
        />

        <h2 id="discord" className="scroll-mt-24">
          Netflix on Discord
        </h2>
        <p className="mb-6 leading-relaxed text-ani-muted">
          Sharing Netflix in a Discord call often shows friends a black screen,
          because Netflix protects its video from screen capture. A cleaner setup is
          to keep Discord for voice and let AniDachi sync the video; the full fix and
          the trade-offs are in{" "}
          <Link
            href="/guides/how-to-screen-share-netflix-on-discord"
            className="text-brand-orange hover:underline"
          >
            how to stream Netflix on Discord
          </Link>
          .
        </p>

        <h2 id="vs-teleparty" className="scroll-mt-24">
          AniDachi vs Teleparty on Netflix
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Teleparty, which started life as Netflix Party, is the best-known Netflix
          sync extension. Here is how the two compare for a Netflix night. Teleparty
          details come from its support FAQ and Chrome Web Store listing, checked
          October 20, 2026.
        </p>
        <ResponsiveCompareTable
          columns={[
            { id: "anidachi", label: "AniDachi", highlight: true },
            { id: "teleparty", label: "Teleparty" },
          ]}
          rows={[
            {
              feature: "Cost to host a Netflix party",
              values: {
                anidachi: PRICING_FREE20_SUMMARY,
                teleparty: "Free tier",
              },
            },
            {
              feature: "Voice and video chat",
              values: {
                anidachi: "Included in rooms",
                teleparty: "Premium only ($6.59/mo, or $47.88/yr)",
              },
            },
            {
              feature: "People per party",
              values: {
                anidachi: `Up to ${FREE_ROOM} (Free), ${PLUS_ROOM} (Plus) or ${PRO_ROOM} (Pro)`,
                teleparty: "Up to 1,000+",
              },
            },
            {
              feature: "Where it runs",
              values: {
                anidachi: "Desktop Chrome",
                teleparty: "Chrome, Edge, Safari, Opera; Android and iOS apps",
              },
            },
            {
              feature: "Other services",
              values: {
                anidachi: "Crunchyroll, YouTube",
                teleparty: "Disney+, Hulu, HBO Max, Prime Video and more",
              },
            },
          ]}
        />
        <p className="mb-6 leading-relaxed text-ani-muted">
          Pick Teleparty if your group needs phones, a browser other than Chrome, a
          very large party, or services like Disney+ and Hulu. Pick AniDachi if you
          want to see and hear each other while you watch without everyone paying for
          voice, and if your group also watches anime on Crunchyroll or videos on
          YouTube. Full breakdown:{" "}
          <Link href="/compare/anidachi-vs-teleparty" className="text-brand-orange hover:underline">
            AniDachi vs Teleparty
          </Link>
          . For Teleparty&apos;s tiers on their own, read{" "}
          <Link href="/guides/is-teleparty-free" className="text-brand-orange hover:underline">
            is Teleparty free
          </Link>
          .
        </p>

        <HubCtaBand
          pagePath={PAGE_PATH}
          ctaLabel="Start a Netflix Watch Party"
          heading="Start your Netflix watch party"
          body="Install AniDachi, open a movie or episode and send the invite. 20 free minutes a day, and friends join free."
        />

        <h2 id="plan" className="scroll-mt-24">
          Plan your night
        </h2>
        <SeoGuideOptions
          options={[
            {
              title: "One film with friends or a partner",
              body: (
                <>
                  Pick by mood and runtime, set one start time across time zones, and
                  run the checklist in{" "}
                  <Link href="/virtual-movie-night">Netflix movie night</Link>.
                </>
              ),
              highlight: true,
            },
            {
              title: "A bigger group, three to fifteen people",
              body: (
                <>
                  Free rooms hold up to 4 people including the host, Plus 6 and
                  Pro 15. The host controls play, pause and seeking for everyone,
                  and friends ask in chat or by voice when they need a break.
                </>
              ),
            },
            {
              title: "Two people in different cities",
              body: (
                <>
                  Couples planning a regular night can start with{" "}
                  <Link href="/watch-netflix-together-long-distance">
                    watch Netflix together long distance
                  </Link>
                  .
                </>
              ),
            },
          ]}
        />

        <h2 id="more" className="scroll-mt-24">
          More Netflix guides
        </h2>
        <p className="mb-6 leading-relaxed text-ani-muted">
          Still choosing a method? The <a href="#vs-teleparty" className="text-brand-orange hover:underline">AniDachi vs Teleparty</a>{" "}
          table above and the <a href="#discord" className="text-brand-orange hover:underline">Discord section</a>{" "}
          cover the other ways to watch Netflix together. If you searched the old extension name,{" "}
          <Link href="/netflix-party" className="text-brand-orange hover:underline">
            Netflix Party
          </Link>{" "}
          explains what it became. The dated answer to whether Netflix will add its
          own button is on{" "}
          <Link
            href="/guides/does-netflix-have-a-watch-party"
            className="text-brand-orange hover:underline"
          >
            does Netflix have a watch party
          </Link>
          .
        </p>
        <SeoGuideRelated
          links={[
            { href: "/virtual-movie-night", label: "Virtual movie night" },
            { href: "/netflix-party", label: "Netflix Party is now Teleparty" },
            { href: "/watch-crunchyroll-together", label: "Crunchyroll watch party" },
            { href: "/watch-youtube-together", label: "YouTube watch party" },
          ]}
        />
        <p className="mt-6 text-sm leading-relaxed text-ani-muted">
          Sources, checked October 20, 2026:{" "}
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
          . AniDachi is not affiliated with Netflix or Teleparty.
        </p>
      </HubLandingLayout>
    </>
  );
}
