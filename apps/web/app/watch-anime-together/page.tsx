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
import { SeoGuideOptions, SeoGuideRelated } from "@/components/seo-guide-blocks";
import type { TocHeading } from "@/components/table-of-contents";
import { animeList } from "@/lib/anime-data";
import { GENRE_HUB_LINKS, genreHubItemList } from "@/lib/genre-hub-links";
import { PRICING_FREE20_SUMMARY, PRICING_STARTING_AT } from "@/lib/pricing-copy";

const PAGE_PATH = "/watch-anime-together";

const FREE_ROOM = getPlanPolicy("free").maxParticipants;
const PLUS_ROOM = getPlanPolicy("plus").maxParticipants;
const PRO_ROOM = getPlanPolicy("pro").maxParticipants;

export const metadata: Metadata = {
  title: "Watch Anime Together Online: Sync with Friends",
  description:
    "How to watch anime with friends online — websites and apps compared. Add AniDachi from the Chrome Web Store for Crunchyroll or YouTube rooms; Discord and Crunchyroll Party stay as free fallbacks.",
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

    title: "Watch Anime Together Online: Sync with Friends",
    description:
      "Watch anime with friends: sync tools, free website options, long-distance, and genre hubs.",
    url: PAGE_PATH,
  },
};

const faq = [
  {
    question: "What is the best way to watch anime together online?",
    answer:
      "It depends on your group. For Crunchyroll anime, AniDachi gives you a watchroom with live sync and chat, and it also works on YouTube and Netflix. Teleparty covers mixed-platform groups. For a free option, Discord screen sharing works in a pinch.",
  },
  {
    question: "How do you watch anime with friends online?",
    answer:
      "Pick the platform, usually Crunchyroll, then install a watchroom extension so everyone streams on their own account in sync. AniDachi and Crunchyroll Party cover that path. Discord Go Live is the free fallback, with lower quality and no automatic sync.",
  },
  {
    question: "Is there a website to watch anime together?",
    answer:
      "There is no single free website that replaces each person's streaming plan. Tools like AniDachi and Crunchyroll Party sit on top of streaming sites as a Chrome watchroom. Browser room sites such as Watch2Gether fit public YouTube links better than licensed Crunchyroll episodes.",
  },
  {
    question: "Is there a free anime watch party app?",
    answer: `Yes. Crunchyroll Party is a free Chrome extension for live anime watch parties, and Discord screen sharing is free too. On AniDachi, ${PRICING_FREE20_SUMMARY.charAt(0).toLowerCase()}${PRICING_FREE20_SUMMARY.slice(1)} Friends join free.`,
  },
  {
    question: "How do you host an anime watch party online?",
    answer:
      "Install AniDachi in desktop Chrome and open a Crunchyroll episode; the extension detects the player automatically. With Free, Plus or Pro access, choose Create room and share the invite. Friends join free on their own Crunchyroll accounts for synced playback and live chat.",
  },
  {
    question: "Can you watch anime together long distance for free?",
    answer:
      "Yes. Discord screen sharing works over any distance at no cost. Crunchyroll Party or AniDachi's Free plan give everyone playback on their own accounts with live sync. Live rooms need a shared start time; AniDachi's async catch-up is planned.",
  },
  {
    question: "Can you watch anime together without being online at the same time?",
    answer:
      "Not yet. AniDachi rooms run live. Each viewer can record their own progress with Plus or Pro; replaying friends' reactions through async catch-up is planned.",
  },
  {
    question: "What anime are best to watch with friends?",
    answer:
      "Shonen series with cliffhangers (Attack on Titan, Jujutsu Kaisen, Demon Slayer) are great for group discussions. Comedy anime (Spy x Family, KonoSuba) are fun group watches. Mystery and thriller series (Death Note, Steins;Gate) spark theory discussions.",
  },
  {
    question: "How many people can join an anime watch party?",
    answer: `It depends on the tool. AniDachi rooms hold up to ${FREE_ROOM} people on Free, ${PLUS_ROOM} on Plus and ${PRO_ROOM} on Pro, including the host. Check each other tool's current limits on its own site.`,
  },
  {
    question: "Do I need a Crunchyroll account to use AniDachi?",
    answer:
      "For anime on Crunchyroll, yes: each person needs their own Crunchyroll account to stream. For YouTube or Netflix rooms, each person uses their own YouTube session or Netflix account instead. AniDachi adds the watchroom, sync and chat on top.",
  },
];

/** One step list for the visible "How to watch" section and the HowTo JSON-LD, so they always match. */
const howToSteps = [
  HUB_INSTALL_STEP,
  {
    name: "Open an episode",
    text: "Open the episode on Crunchyroll, YouTube or Netflix in desktop Chrome. AniDachi detects the player automatically.",
  },
  {
    name: "Create a room and invite friends",
    text: "With Free, Plus or Pro access, choose Create room and share the invite link. Friends join free.",
  },
  {
    name: "Watch together",
    text: "Friends open the same episode on their own accounts. Playback stays in sync, with live chat and reactions.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "step-by-step", label: "How it works", level: 2 },
  { id: "platform-hubs", label: "Pick your platform", level: 2 },
  { id: "watch-party", label: "Watch party options", level: 2 },
  { id: "methods-heading", label: "Methods", level: 2 },
  { id: "long-distance", label: "Long distance", level: 2 },
  { id: "anidachi-difference", label: "What makes AniDachi different", level: 2 },
  { id: "genre-hubs", label: "Browse by genre", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

/** 12 fills complete rows in both the two- and three-column grid. */
const VISIBLE_ANIME_GUIDES = 12;

function AnimeGuideList({
  titles,
  className = "",
}: {
  titles: typeof animeList;
  className?: string;
}) {
  return (
    <ul className={`not-prose grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3 ${className}`.trim()}>
      {titles.map((anime) => (
        <li key={anime.slug}>
          <Link
            href={`/watch/${anime.slug}-with-friends`}
            className="text-ani-muted transition-colors hover:text-ani-text"
          >
            {anime.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function WatchAnimeTogetherPage() {
  return (
    <>
      <HowToJsonLd
        name="How to watch anime together online"
        description="Set up an AniDachi watchroom for synced anime viewing with friends."
        steps={howToSteps}
      />
      <HubLandingLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Watch Anime Together", url: PAGE_PATH },
        ]}
        title="Watch Anime Together Online: Sync with Friends"
        description="Compare every way to watch anime together online — AniDachi watchrooms, free options, long-distance tips, and genre hubs."
        url={PAGE_PATH}
        datePublished="2026-04-23"
        dateModified="2026-11-07"
        faq={faq}
        headings={tocHeadings}
        itemList={genreHubItemList(1)}
        h1="Watch Anime Together Online"
        heroLead="Anime is better with friends. AniDachi keeps you in sync."
        heroCtaLabel="Start an Anime Watch Party"
        heroWorksOn={["Crunchyroll", "YouTube", "Netflix"]}
        heroFinePrint="20 free minutes a day. Friends join free."
        answer={
          <>
            <strong>
              The easiest way to watch anime together online is a watchroom
              extension like AniDachi: each friend opens the episode on their
              own account, and playback stays in sync with live chat.
            </strong>{" "}
            Platform guides:{" "}
            <Link href="/watch-crunchyroll-together">Crunchyroll watch party</Link>{" "}
            and <Link href="/watch-youtube-together">YouTube watch party</Link>.
          </>
        }
        steps={{
          id: "step-by-step",
          heading: "How to Watch Anime Together",
          items: howToSteps,
        }}
      >
        <h2 id="platform-hubs" className="scroll-mt-24">
          Pick Your Platform
        </h2>
        <p>
          Most anime series nights happen on Crunchyroll. The same extension
          also runs YouTube and Netflix rooms.
        </p>
        <SeoGuideOptions
          options={[
            {
              title: "Crunchyroll watch party",
              highlight: true,
              body: (
                <>
                  The home of most anime catalog nights.{" "}
                  <Link href="/watch-crunchyroll-together">
                    Watch Crunchyroll together
                  </Link>
                  .
                </>
              ),
            },
            {
              title: "YouTube watch party",
              body: (
                <>
                  Official clips, essays, music and free uploads.{" "}
                  <Link href="/watch-youtube-together">Watch YouTube together</Link>.
                </>
              ),
            },
            {
              title: "Netflix watch party",
              body: (
                <>
                  Anime and everything else on Netflix.{" "}
                  <Link href="/netflix-watch-party">Netflix watch party</Link>.
                </>
              ),
            },
          ]}
        />
        <p>
          Prime Video isn&apos;t supported yet. What works today is in{" "}
          <Link href="/prime-video-watch-party">Prime Video watch party</Link>.
        </p>

        <h2 id="watch-party" className="scroll-mt-24">
          Host an Anime Watch Party Online — Free &amp; Paid Options
        </h2>
        <p>
          An <strong>anime watch party</strong> lets your group watch the same
          episode at the same time, with reactions and chat in real time. Here
          are the main options:
        </p>
        <ResponsiveCompareTable
          columns={[
            { id: "anidachi", label: "AniDachi", highlight: true },
            { id: "crunchyroll-party", label: "Crunchyroll Party" },
            { id: "teleparty", label: "Teleparty" },
            { id: "discord", label: "Discord screen share" },
          ]}
          rows={[
            {
              feature: "Price",
              values: {
                anidachi: `Free 20 min a day; Plus from ${PRICING_STARTING_AT}`,
                "crunchyroll-party": "Free",
                teleparty: "Freemium",
                discord: "Free",
              },
            },
            {
              feature: "Synced playback",
              values: {
                anidachi: "yes",
                "crunchyroll-party": "yes",
                teleparty: "yes",
                discord: "No",
              },
            },
            {
              feature: "Chat",
              values: {
                anidachi: "yes",
                "crunchyroll-party": "yes",
                teleparty: "yes",
                discord: "Voice/Text",
              },
            },
            {
              feature: "Picture quality",
              values: {
                anidachi: "Full, on each person's own account",
                "crunchyroll-party": "Full, on each person's own account",
                teleparty: "Full, on each person's own account",
                discord: "Capped, often 720p",
              },
            },
            {
              feature: "Platforms",
              values: {
                anidachi: "Crunchyroll, YouTube, Netflix",
                "crunchyroll-party": "Crunchyroll",
                teleparty: "Crunchyroll, Netflix, Disney+",
                discord: "Anything you can screen share",
              },
            },
          ]}
        />
        <p className="mt-4">
          AniDachi also records your own watch history on Plus or Pro.
          Crunchyroll Party has no progress tracking, and Discord is the
          quickest zero-setup option when nobody wants to install anything.
        </p>
        <p>
          Want a full walkthrough? Read{" "}
          <Link href="/guides/how-to-watch-crunchyroll-with-friends">
            how to watch Crunchyroll with friends
          </Link>
          , or browse <Link href="/guides">all watch party guides</Link>.
        </p>

        <HubCtaBand
          pagePath={PAGE_PATH}
          ctaLabel="Start an Anime Watch Party"
          heading="Start your anime watch party"
          body="Install AniDachi, open an episode and send the invite. 20 free minutes a day, and friends join free."
        />

        <h2 id="methods-heading" className="scroll-mt-24">
          Methods for Watching Anime Together
        </h2>
        <h3 id="method-extensions" className="scroll-mt-24">
          1. Chrome extensions (best quality and features)
        </h3>
        <p>
          Extensions like AniDachi, Crunchyroll Party and Teleparty sync
          playback so everyone sees the same frame. Each person watches on their
          own account in full quality. AniDachi supports live rooms and personal
          history; async catch-up is planned, not available today.
        </p>
        <h3 id="method-discord" className="scroll-mt-24">
          2. Discord screen sharing (free and easy)
        </h3>
        <p>
          Share your Crunchyroll tab with Discord&apos;s Go Live. It&apos;s
          free and needs no extra tools, but quality is often capped at 720p and
          there&apos;s no automatic sync. For other no-cost options, see how to{" "}
          <Link href="/guides/how-to-watch-anime-for-free-with-friends">
            watch anime free with friends
          </Link>
          . To keep Discord for voice while each person streams their own
          player, read the{" "}
          <Link href="/discord-watch-party">Discord watch party guide</Link>.
        </p>
        <h3 id="method-in-person" className="scroll-mt-24">
          3. In-person watch parties
        </h3>
        <p>
          Nothing beats a TV, snacks and friends on the couch. Cast Crunchyroll
          to a TV and binge away. For inspiration, see{" "}
          <Link href="/guides/anime-watch-party-ideas">anime watch party ideas</Link>.
        </p>

        <h2 id="long-distance" className="scroll-mt-24">
          Watch Anime Together Long Distance
        </h2>
        <p>
          Long distance is one of the most common reasons people look for
          watch-together tools. Whether you&apos;re in different cities, time
          zones or countries, these approaches work:
        </p>
        <HubFeatureGrid
          items={[
            {
              title: "Live sync across distance",
              body: "AniDachi, Crunchyroll Party and Teleparty work wherever you are. Each person needs a stable connection and their own Crunchyroll account; playback stays in sync automatically.",
            },
            {
              title: "Time-zone gaps",
              body: "If your friend is 8 hours ahead, find a shared window or catch up separately before you discuss. AniDachi's async catch-up is planned, not available today.",
            },
          ]}
        />
        <p>
          Go deeper:{" "}
          <Link href="/guides/how-to-watch-anime-long-distance">
            how to watch anime long distance
          </Link>
          ,{" "}
          <Link href="/guides/how-to-watch-anime-with-friends-in-different-time-zones">
            watching anime across time zones
          </Link>{" "}
          and the{" "}
          <Link href="/best-apps-watch-anime-together-long-distance">
            best apps to watch anime together long distance
          </Link>
          .
        </p>

        <h2 id="live-vs-async" className="scroll-mt-24">
          Live vs Asynchronous Watch Parties
        </h2>
        <p>
          <strong>Live watch parties</strong> need everyone online at the same
          time. They&apos;re great for premieres and finales, but hard to
          schedule. <strong>Asynchronous watch parties</strong> let everyone
          watch at their own pace and share reactions afterwards. AniDachi&apos;s
          async catch-up is planned, not available today. Read the{" "}
          <Link href="/guides/asynchronous-vs-live-watch-party">full comparison</Link>
          .
        </p>

        <h2 id="anidachi-difference" className="scroll-mt-24">
          What Makes AniDachi Different
        </h2>
        <HubFeatureGrid
          items={[
            {
              title: "One extension, three platforms",
              body: "The same watchroom works on Crunchyroll, YouTube and Netflix. Friends install it once.",
            },
            {
              title: "Chat, reactions, camera and mic",
              body: "Everything happens on top of the player, so nobody needs a second app open to talk.",
            },
            {
              title: "Rooms that fit your group",
              body: `Free rooms hold up to ${FREE_ROOM} people, including you. Plus holds ${PLUS_ROOM} and Pro holds ${PRO_ROOM}. Friends join free.`,
            },
            {
              title: "Built by anime fans",
              body: "AniDachi means anime friend: anime plus tomodachi (友達). It's made for weekly episodes, cliffhangers and group theory chats.",
            },
          ]}
        />
        <p>
          New episodes give your group a standing date. Here&apos;s how to follow{" "}
          <Link href="/guides/how-to-watch-seasonal-anime-together">
            seasonal anime with friends
          </Link>
          .
        </p>

        <h2 id="genre-hubs" className="scroll-mt-24">
          Browse Anime by Genre
        </h2>
        <p>Picks for group watchrooms, with setup and spoiler tips:</p>
        <SeoGuideRelated
          className="divide-y-0 sm:grid sm:grid-cols-2 sm:gap-x-10 [&>li]:border-b [&>li]:border-ani-line"
          links={[
            ...GENRE_HUB_LINKS.map(({ href, label }) => ({ href, label })),
            {
              href: "/guides/best-anime-to-watch-asynchronously",
              label: "Best anime to watch asynchronously",
            },
          ]}
        />

        <h2 id="tools" className="scroll-mt-24">
          Episode Counts, Filler Lists and Watch Orders
        </h2>
        <p>
          Check the length before you start a long show, pick a watch order, see
          what drops this week, or spin a random title.
        </p>
        <SeoGuideRelated
          className="divide-y-0 sm:grid sm:grid-cols-2 sm:gap-x-10 [&>li]:border-b [&>li]:border-ani-line"
          links={[
            { href: "/tools/one-piece-how-many-episodes", label: "How many episodes does One Piece have?" },
            { href: "/tools/one-piece-filler-list", label: "One Piece filler list" },
            { href: "/tools/naruto-filler-list", label: "Naruto filler list" },
            { href: "/tools/naruto-shippuden-filler-list", label: "Naruto Shippuden filler list" },
            { href: "/tools/bleach-filler-list", label: "Bleach filler list" },
            { href: "/tools/black-clover-filler-list", label: "Black Clover filler list" },
            { href: "/tools/fate-watch-order", label: "Fate watch order" },
            { href: "/tools/monogatari-watch-order", label: "Monogatari series watch order" },
            { href: "/tools/crunchyroll-schedule", label: "Crunchyroll release schedule" },
            { href: "/tools/random-anime-generator", label: "Random anime generator" },
          ]}
        />

        <h2 id="popular-anime" className="scroll-mt-24">
          All Anime Watch Guides ({animeList.length} titles)
        </h2>
        <p>
          Every title below has its own watchroom guide. The{" "}
          <Link href="/watch">anime A to Z index</Link> groups the same titles
          with genre picks and films.
        </p>
        <AnimeGuideList titles={animeList.slice(0, VISIBLE_ANIME_GUIDES)} />
        {/* The rest stays in the server HTML (inside a closed <details>) so crawlers still follow every link. */}
        <details className="group not-prose mt-2">
          <summary className="mx-auto mt-6 flex w-fit cursor-pointer list-none items-center gap-2 rounded-full border border-ani-line px-5 py-2 text-sm font-medium text-ani-text transition-colors hover:border-ani-control-border [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">View all {animeList.length} titles</span>
            <span className="hidden group-open:inline">Show fewer</span>
          </summary>
          <AnimeGuideList titles={animeList.slice(VISIBLE_ANIME_GUIDES)} className="mt-6" />
        </details>
      </HubLandingLayout>
    </>
  );
}
