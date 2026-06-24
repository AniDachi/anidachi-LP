import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Best Sports Anime to Watch With Friends (2026) — 9 Group Picks",
  description:
    "The best sports anime for group watches on Crunchyroll — Haikyuu!!, Blue Lock, Slam Dunk & more. Hype matchups, synced reactions, and async catch-up with AniDachi.",
  alternates: { canonical: "/guides/best-sports-anime-to-watch-with-friends" },
  openGraph: {
    title: "Best Sports Anime to Watch With Friends — 2026",
    description:
      "10 sports anime picks for group watchrooms — volleyball, soccer, basketball, boxing, and figure skating that demand a crowd.",
    url: "/guides/best-sports-anime-to-watch-with-friends",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Best Sports Anime to Watch With Friends — 2026",
    description:
      "Haikyuu!!, Blue Lock, Slam Dunk & more — sports anime built for group hype and synced watchrooms.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "What is the best sports anime to watch with friends?",
    answer:
      "Haikyuu!! is the top pick for most groups — universal underdog energy, clear match structure, and clutch moments that make everyone yell at the screen. Blue Lock suits competitive friend groups who love rivalry and ego clashes. Slam Dunk is the classic choice for groups who want a longer marathon with iconic training arcs.",
  },
  {
    question: "Is sports anime good for people who don't follow real sports?",
    answer:
      "Yes — sports anime is often more about character growth, teamwork, and dramatic tension than the sport itself. Haikyuu!! converts non-volleyball fans within three episodes. Yuri on Ice works even if you've never watched figure skating. The emotional stakes and visual storytelling carry the experience.",
  },
  {
    question: "Should we watch sports anime live or async?",
    answer:
      "Watch key matches live when possible — clutch points and final-set comebacks land hardest with synchronized reactions. Use async mode between tournament arcs so members who miss a week can catch up without spoiling the bracket for everyone else.",
  },
  {
    question: "Do all my friends need Crunchyroll for sports anime watch parties?",
    answer:
      "Yes — each person streams from their own Crunchyroll account. AniDachi adds the watchroom, sync, and episode-scoped chat on top. Most major sports anime on this list are widely available on Crunchyroll, but check regional availability before starting a long series.",
  },
];

const headings: TocHeading[] = [
  { id: "team-sports", label: "Team sports picks", level: 2 },
  { id: "individual-sports", label: "Individual & combat sports", level: 2 },
  { id: "tips", label: "Sports watch party tips", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

const itemList = [
  { name: "Team sports anime picks", url: "/guides/best-sports-anime-to-watch-with-friends#team-sports", position: 1 },
  { name: "Individual & combat sports", url: "/guides/best-sports-anime-to-watch-with-friends#individual-sports", position: 2 },
  { name: "Sports watch party tips", url: "/guides/best-sports-anime-to-watch-with-friends#tips", position: 3 },
];

export default function BestSportsAnimeToWatchWithFriendsPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Guides", url: "/watch-anime-together" },
        {
          name: "Best sports anime to watch with friends",
          url: "/guides/best-sports-anime-to-watch-with-friends",
        },
      ]}
      title="9 best sports anime to watch with friends in 2026"
      description="9 sports anime picks for group watchrooms — team hype, rivalry arcs, and match-day sync sessions."
      url="/guides/best-sports-anime-to-watch-with-friends"
      datePublished="2026-06-08"
      dateModified="2026-06-08"
      faq={faq}
      headings={headings}
      itemList={itemList}
      articleImage={articleImageAbsolute}
      conversionTemplate="listicle"
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        9 best sports anime to watch with friends in 2026
      </h1>
      <p className="text-xl text-foreground/80 leading-relaxed mb-10">
        <strong>
          Sports anime is built for group reactions — every match has sides to
          pick, clutch moments to scream at, and training montages to debate.
          These 10 picks turn your watchroom into a living-room stadium with
          synced Crunchyroll playback on AniDachi.
        </strong>
      </p>

      <h2
        id="team-sports"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Team sports picks
      </h2>
      <ul className="space-y-4 text-foreground/80 mb-10">
        <li>
          <strong>
            <Link href="/watch/haikyuu-with-friends" className="text-brand-orange hover:underline">
              Haikyuu!!
            </Link>
          </strong>{" "}
          — The gold standard for group sports watches. Short protagonist, genius
          setter rivalry, and tournament brackets that make every match feel like
          a finale. Your group will pick Karasuno vs. every opponent and argue MVP
          after each set.
        </li>
        <li>
          <strong>
            <Link href="/watch/blue-lock-with-friends" className="text-brand-orange hover:underline">
              Blue Lock
            </Link>
          </strong>{" "}
          — 300 strikers, one ego-driven facility, zero teamwork until it matters.
          Competitive friend groups love picking favorites and trash-talking through
          elimination rounds. Intense enough for live sync; short enough to finish
          in a few weeks.
        </li>
        <li>
          <strong>
            <Link href="/watch/kuroko-no-basket-with-friends" className="text-brand-orange hover:underline">
              Kuroko&apos;s Basketball
            </Link>
          </strong>{" "}
          — Superpowered basketball with the Generation of Miracles. Fast-paced
          comebacks and power-matchup debates make every game a group event. Pick
          your favorite ex-rival before the tip-off.
        </li>
        <li>
          <strong>
            <Link href="/watch/slam-dunk-with-friends" className="text-brand-orange hover:underline">
              Slam Dunk
            </Link>
          </strong>{" "}
          — The classic that defined sports anime for a generation. Delinquent-turned-basketball-obsessive
          Hanamichi Sakuragi delivers training arcs and rival matchups that reward
          a long-term watchroom marathon.
        </li>
      </ul>

      <h2
        id="individual-sports"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Individual &amp; combat sports
      </h2>
      <ul className="space-y-4 text-foreground/80 mb-10">
        <li>
          <strong>
            <Link href="/watch/hajime-no-ippo-with-friends" className="text-brand-orange hover:underline">
              Hajime no Ippo
            </Link>
          </strong>{" "}
          — Round-by-round boxing tension where every punch lands like a plot twist.
          Training arcs build investment; fight nights become mandatory live-sync
          events for your watchroom.
        </li>
        <li>
          <strong>
            <Link href="/watch/initial-d-with-friends" className="text-brand-orange hover:underline">
              Initial D: First Stage
            </Link>
          </strong>{" "}
          — Mountain drift races with eurobeat drops and underground rivalry.
          Your group picks teams before the downhill even starts — perfect for
          hype-heavy co-watch sessions.
        </li>
        <li>
          <strong>
            <Link href="/watch/yuri-on-ice-with-friends" className="text-brand-orange hover:underline">
              Yuri on Ice
            </Link>
          </strong>{" "}
          — Figure skating with emotional stakes that go beyond the rink. Competition
          arcs deliver clutch performance moments; character drama keeps async
          watchrooms active between episodes.
        </li>
        <li>
          <strong>
            <Link href="/watch/march-comes-in-like-a-lion-with-friends" className="text-brand-orange hover:underline">
              March Comes in Like a Lion
            </Link>
          </strong>{" "}
          —           Shogi as psychological sport. Quieter than Haikyuu!! but the tournament
          arcs generate the same clutch tension — ideal for groups who want sports
          structure with deeper emotional payoff.
        </li>
        <li>
          <strong>
            <Link href="/watch/sk8-the-infinity-with-friends" className="text-brand-orange hover:underline">
              SK8 the Infinity
            </Link>
          </strong>{" "}
          — Underground skate battles with rivalries and found-family energy.
          12 episodes of over-the-top race choreography — perfect for a short
          sports binge with maximum hype.
        </li>
      </ul>

      <h2
        id="tips"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Sports watch party tips
      </h2>
      <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-10">
        <li>
          Schedule live sync for tournament finals and elimination matches — the
          crowd energy is half the point.
        </li>
        <li>
          Let members pick sides before big matches; friendly rivalry keeps chat
          active even during training-arc episodes.
        </li>
        <li>
          Use AniDachi&apos;s async mode between arcs so nobody falls behind before
          the bracket resets.
        </li>
        <li>
          Pair snacks with the sport — volleyball night with convenience-store
          food, boxing night with protein shakes (optional but fun).
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
          <Link href="/watch-sports-anime-with-friends" className="hover:underline">
            Watch sports anime with friends — genre hub
          </Link>
        </li>
        <li>
          <Link href="/guides/best-shonen-anime-to-watch-with-friends" className="hover:underline">
            Best shonen anime to watch with friends
          </Link>
        </li>
        <li>
          <Link href="/guides/best-anime-to-watch-with-friends" className="hover:underline">
            Best anime to watch with friends — full list
          </Link>
        </li>
        <li>
          <Link href="/guides/how-to-plan-an-anime-marathon-with-friends" className="hover:underline">
            How to plan an anime marathon with friends
          </Link>
        </li>
      </ul>
    </SeoPageLayout>
  );
}
