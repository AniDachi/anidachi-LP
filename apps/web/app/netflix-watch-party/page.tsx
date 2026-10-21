import type { Metadata } from "next";
import Link from "next/link";
import { InstallLink } from "@/components/install-link";
import { HowToJsonLd } from "@/components/json-ld";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
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
import { INSTALL_HOWTO_STEP_TEXT } from "@/lib/install-cta";
import { PRICING_PLUS_SHORT, PRICING_PRO_SHORT } from "@/lib/pricing-copy";
import { getSeoSiteOrigin } from "@/lib/site-url";

const articleImage = `${getSeoSiteOrigin()}/opengraph-image.png`;

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

const howToSteps = [
  {
    name: "Install AniDachi in desktop Chrome",
    text: `${INSTALL_HOWTO_STEP_TEXT} Start from /extension and sign in to AniDachi.`,
  },
  {
    name: "Open the Netflix title",
    text: "Sign in to your own Netflix account and start the movie or episode, so the address bar shows netflix.com/watch/ and the player is on screen.",
  },
  {
    name: "Create the room",
    text: "Click the AniDachi capsule at the top-right of the player and choose Create room. Hosting needs Plus or Pro, including a 3-day trial for eligible accounts.",
  },
  {
    name: "Share the invite link",
    text: "Copy the room link or invite friends from Friends & groups. Friends join free with AniDachi and their own Netflix access, and playback stays in sync.",
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
      "Install AniDachi from /extension in desktop Chrome, open the Netflix movie or episode on your own account, click the AniDachi capsule on the player and choose Create room, then send the invite link. Hosting needs Plus or Pro, including a trial; friends join free.",
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
      "Up to 6 people including the host when the host has Plus, or up to 15 with Pro. Friends join free. Up to four cameras can be on at once.",
  },
  {
    question: "Why is my Netflix watch party not syncing?",
    answer:
      "The usual causes are a friend on a different title or episode, a browse or info page instead of the player, a title missing from someone's country catalog, or a page that loaded before AniDachi. Have everyone open the same netflix.com/watch page and refresh once.",
  },
  {
    question: "Is a Netflix watch party free?",
    answer:
      "Joining an AniDachi room is free. Hosting needs Plus or Pro, with a 3-day trial for eligible accounts. Teleparty hosts Netflix parties on its free tier with sync and text chat; its voice and video chat need Premium. Everyone still needs Netflix.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "how-it-works", label: "How it works", level: 2 },
  { id: "what-works", label: "What works and the limits", level: 2 },
  { id: "everyone-needs-netflix", label: "Does everyone need Netflix?", level: 2 },
  { id: "not-working", label: "Watch party not working", level: 2 },
  { id: "discord", label: "Netflix on Discord", level: 2 },
  { id: "vs-teleparty", label: "AniDachi vs Teleparty", level: 2 },
  { id: "plan", label: "Plan your night", level: 2 },
  { id: "more", label: "More Netflix guides", level: 2 },
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
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Netflix watch party", url: "/netflix-watch-party" },
        ]}
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        url="/netflix-watch-party"
        datePublished="2026-10-08"
        dateModified="2026-10-20"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImage}
        aboveFoldCta
        conversionTemplate="pillar"
        itemList={[
          { name: "Netflix Party", url: "/netflix-party", position: 1 },
          {
            name: "Watch Netflix together: the ways compared",
            url: "/guides/watch-netflix-together",
            position: 2,
          },
          {
            name: "How to watch Netflix with friends",
            url: "/guides/how-to-watch-netflix-with-friends",
            position: 3,
          },
          {
            name: "Does Netflix have a watch party?",
            url: "/guides/does-netflix-have-a-watch-party",
            position: 4,
          },
          { name: "Netflix group watch", url: "/guides/netflix-group-watch", position: 5 },
          { name: "Netflix movie night", url: "/guides/netflix-movie-night", position: 6 },
          {
            name: "Stream Netflix on Discord",
            url: "/guides/how-to-screen-share-netflix-on-discord",
            position: 7,
          },
          { name: "Teleparty Netflix", url: "/guides/teleparty-netflix", position: 8 },
          {
            name: "AniDachi vs screen share and countdown for Netflix",
            url: "/compare/anidachi-vs-netflix-watch-party",
            position: 9,
          },
        ]}
      >
        <SeoGuideTitle>Netflix Watch Party</SeoGuideTitle>
        <SeoGuideAnswer id="answer">
          <p>
            <strong>
              Netflix has no built-in watch party. AniDachi syncs a Netflix movie or
              episode across desktop Chrome: everyone plays it on their own Netflix
              account, and friends join free.
            </strong>{" "}
            The host needs Plus or Pro (a 3-day trial counts). Rooms add chat,
            reactions, voice and video, with push-to-talk on the V key.
          </p>
        </SeoGuideAnswer>

        <h2 id="how-it-works" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          How a Netflix watch party works
        </h2>
        <p className="mb-6 leading-relaxed text-ani-muted">
          A watch party is not one stream sent to everyone. Each person runs Netflix
          in their own Chrome tab, on their own account, and AniDachi keeps those
          players at the same moment. When the host presses pause, every player
          pauses. When the host skips back to rewatch a scene, everyone jumps with
          them. That is why the picture stays at full Netflix quality for each
          viewer: nobody is watching a compressed copy of someone else&apos;s screen.
        </p>
        <SeoGuideSteps
          steps={[
            {
              name: "Install AniDachi in desktop Chrome",
              text: (
                <>
                  Open the <Link href="/extension">AniDachi install page</Link>, choose
                  Add to Chrome on the official Chrome Web Store listing, and sign in.
                  Friends do the same before the night.
                </>
              ),
            },
            {
              name: "Open the Netflix title",
              text: "Sign in to your own Netflix account and start the movie or episode. The address bar should read netflix.com/watch/ followed by a number. The browse row and the title's info page are not the player.",
            },
            {
              name: "Create the room",
              text: "Click the AniDachi capsule at the top-right of the player and choose Create room. Creating rooms needs Plus or Pro, including a 3-day trial for eligible accounts.",
            },
            {
              name: "Share the invite link",
              text: "Copy the room link and paste it into your group chat, or use the person-plus button to invite saved friends and groups. Friends join free and play the same title on their own Netflix.",
            },
          ]}
        />
        <p className="mb-6 leading-relaxed text-ani-muted">
          Ready to try it?{" "}
          <InstallLink href="/extension" className="text-brand-orange hover:underline">
            Add AniDachi to Chrome and host your first Netflix room
          </InstallLink>
          . If you only want the click-by-click version for a friend group, the{" "}
          <Link
            href="/guides/how-to-watch-netflix-with-friends"
            className="text-brand-orange hover:underline"
          >
            how to watch Netflix with friends
          </Link>{" "}
          guide walks through it with a troubleshooting box.
        </p>

        <h2 id="what-works" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
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
        <SeoGuideBulletList
          items={[
            {
              title: "Room size",
              body: `A Plus host (${PRICING_PLUS_SHORT}) can have up to 6 people in the room, including themselves. A Pro host (${PRICING_PRO_SHORT}) can have up to 15.`,
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
          className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text"
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
          a Free account. Only the host needs Plus or Pro. So for a group of five, you
          pay for Netflix as usual, and one person pays for AniDachi hosting or uses a
          trial.
        </p>

        <h2 id="not-working" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
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

        <h2 id="discord" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
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

        <h2 id="vs-teleparty" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
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
                anidachi: "Plus or Pro (3-day trial); friends join free",
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
                anidachi: "Up to 6 (Plus) or 15 (Pro)",
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

        <h2 id="plan" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
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
                  <Link href="/guides/netflix-movie-night">Netflix movie night</Link>.
                </>
              ),
              highlight: true,
            },
            {
              title: "A bigger group, three to fifteen people",
              body: (
                <>
                  Room size, who controls playback, microphone etiquette and series
                  pacing are in <Link href="/guides/netflix-group-watch">Netflix group watch</Link>.
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

        <h2 id="more" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          More Netflix guides
        </h2>
        <p className="mb-6 leading-relaxed text-ani-muted">
          Still choosing a method? <Link href="/guides/watch-netflix-together" className="text-brand-orange hover:underline">Watch Netflix together</Link>{" "}
          compares a countdown on a call, Discord, Teleparty and AniDachi in one
          decision table. If you searched the old extension name,{" "}
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
            { href: "/guides/watch-netflix-together", label: "Watch Netflix together: 4 ways compared" },
            {
              href: "/guides/how-to-watch-netflix-with-friends",
              label: "How to watch Netflix with friends, step by step",
            },
            { href: "/guides/netflix-group-watch", label: "Netflix group watch for 3 to 15 people" },
            { href: "/guides/netflix-movie-night", label: "Plan a Netflix movie night" },
            { href: "/netflix-party", label: "Netflix Party is now Teleparty" },
            { href: "/guides/teleparty-netflix", label: "Teleparty on Netflix" },
            {
              href: "/compare/anidachi-vs-netflix-watch-party",
              label: "AniDachi vs screen share and countdown for Netflix",
            },
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
      </SeoPageLayout>
    </>
  );
}
