import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getGuideLinks } from "@/lib/guide-links";

export const metadata: Metadata = {
  title: "Watch Anime Together Online — The Complete Guide (2026)",
  description:
    "Everything you need to watch anime together with friends online. Watchrooms, async watching, Chrome extensions, and anime marathon tips. Free and paid options compared.",
  alternates: { canonical: "/watch-anime-together" },
  openGraph: {
    title: "Watch Anime Together Online — The Complete Guide",
    description:
      "The definitive guide to watching anime with friends, whether live or asynchronously.",
    url: "/watch-anime-together",
  },
};

const faq = [
  {
    question: "What is the best way to watch anime together online?",
    answer:
      "The best method depends on your group. For Crunchyroll users, AniDachi offers watchrooms with sync, chat, and async support. For cross-platform groups, Teleparty works across Netflix, Disney+, and Crunchyroll. For a free option, Discord screen sharing works in a pinch.",
  },
  {
    question: "Can you watch anime together without being online at the same time?",
    answer:
      "Yes! AniDachi supports asynchronous watching. Create a watchroom, and each person watches episodes at their own pace. Mark episodes as watched, leave reactions, and read your friends' comments when you catch up.",
  },
  {
    question: "What anime are best to watch with friends?",
    answer:
      "Shonen series with cliffhangers (Attack on Titan, Jujutsu Kaisen, Demon Slayer) are great for group discussions. Comedy anime (Spy x Family, KonoSuba) are fun group watches. Mystery/thriller (Death Note, Steins;Gate) spark great theory discussions.",
  },
  {
    question: "How many people can join an anime watch party?",
    answer:
      "It depends on the tool. AniDachi watchrooms support group watching with no hard limit on members. Crunchyroll Party and Teleparty typically support 10-50+ users per room.",
  },
  {
    question: "Do I need a Crunchyroll account to use AniDachi?",
    answer:
      "Yes, each person needs their own Crunchyroll account to stream the anime. AniDachi provides the watchroom, sync, and chat layer on top.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "why-watch", label: "Why watch anime together?", level: 2 },
  { id: "methods-heading", label: "Methods", level: 2 },
  { id: "method-extensions", label: "Chrome extensions", level: 3 },
  { id: "method-discord", label: "Discord", level: 3 },
  { id: "method-in-person", label: "In-person", level: 3 },
  { id: "live-vs-async", label: "Live vs async", level: 2 },
  { id: "popular-anime", label: "Popular picks", level: 2 },
  { id: "all-guides", label: "All guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function WatchAnimeTogetherPage() {
  const allGuideLinks = getGuideLinks({
    includeTags: ["pillar-watch-anime", "how-to-core"],
    limit: 10,
  });

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Watch Anime Together", url: "/watch-anime-together" },
      ]}
      title="Watch Anime Together Online — The Complete Guide"
      description="Everything you need to watch anime with friends online."
      url="/watch-anime-together"
      datePublished="2026-04-23"
      dateModified="2026-05-07"
      faq={faq}
      headings={tocHeadings}
    >
      <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
        Watch Anime Together Online
      </h1>

      <p className="text-xl text-gray-700 leading-relaxed mb-8">
        <strong>
          The best way to watch anime together online is with a dedicated
          watchroom tool like AniDachi that syncs playback, adds real-time chat,
          and lets you watch asynchronously.
        </strong>{" "}
        Whether your friends are across the room or across the world, shared
        anime         experiences are better than watching alone. This guide covers
        every method, tool, and tip.
      </p>

      <p className="text-gray-700 mb-8">
        Ready to try the Crunchyroll-first option?{" "}
        <Link href="/#pricing" className="text-purple-600 font-medium hover:underline">
          Start a paid AniDachi plan
        </Link>{" "}
        — early-access pricing with a clear refund path, then create your first
        watchroom in minutes.
      </p>

      <h2
        id="why-watch"
        className="text-2xl font-bold text-gray-900 mt-12 mb-4 scroll-mt-24"
      >
        Why Watch Anime Together?
      </h2>
      <p className="text-gray-700 leading-relaxed mb-6">
        Anime is a social experience. Discussing plot twists, debating character
        arcs, and reacting to cliffhangers together is what makes it memorable.
        Whether it&apos;s your first time watching Attack on Titan or
        re-watching One Piece with a friend, shared viewing makes every episode
        better. The word &quot;AniDachi&quot; itself means &quot;anime
        friend&quot; — 友達 (tomodachi) + アニメ (anime).
      </p>

      <h2
        className="text-2xl font-bold text-gray-900 mt-12 mb-4 scroll-mt-24"
        id="methods-heading"
      >
        Methods for Watching Anime Together
      </h2>

      <h3
        id="method-extensions"
        className="text-xl font-semibold text-gray-900 mt-8 mb-3 scroll-mt-24"
      >
        1. Chrome Extensions (Best Quality &amp; Features)
      </h3>
      <p className="text-gray-700 leading-relaxed mb-4">
        Extensions like AniDachi, Crunchyroll Party, and Teleparty sync
        playback so everyone sees the same frame. Each person watches on their
        own account in full quality. AniDachi uniquely supports async watching
        — watch at different times and still share the experience.
      </p>

      <h3
        id="method-discord"
        className="text-xl font-semibold text-gray-900 mt-8 mb-3 scroll-mt-24"
      >
        2. Discord Screen Sharing (Free &amp; Easy)
      </h3>
      <p className="text-gray-700 leading-relaxed mb-4">
        Share your Crunchyroll tab via Discord&apos;s Go Live feature. Free and
        requires no extra tools, but quality is often capped at 720p and
        there&apos;s no automatic sync. Best for casual, impromptu sessions.
      </p>

      <h3
        id="method-in-person"
        className="text-xl font-semibold text-gray-900 mt-8 mb-3 scroll-mt-24"
      >
        3. In-Person Watch Parties
      </h3>
      <p className="text-gray-700 leading-relaxed mb-6">
        Nothing beats a TV, snacks, and friends on the couch. Cast Crunchyroll
        to a TV, grab some Japanese snacks, and binge away. Check our guide on{" "}
        <Link
          href="/guides/anime-watch-party-ideas"
          className="text-purple-600 hover:underline"
        >
          anime watch party ideas
        </Link>{" "}
        for inspiration.
      </p>

      <h2
        id="live-vs-async"
        className="text-2xl font-bold text-gray-900 mt-12 mb-4 scroll-mt-24"
      >
        Live vs Asynchronous Watch Parties
      </h2>
      <p className="text-gray-700 leading-relaxed mb-6">
        <strong>Live watch parties</strong> require everyone to be online at the
        same time. Great for premieres and season finales, but hard to schedule.{" "}
        <strong>Asynchronous watch parties</strong> let everyone watch at their
        own pace and share reactions afterwards. AniDachi is the only tool that
        fully supports async anime watching. Read our{" "}
        <Link
          href="/guides/asynchronous-vs-live-watch-party"
          className="text-purple-600 hover:underline"
        >
          full comparison
        </Link>
        .
      </p>

      <h2
        id="popular-anime"
        className="text-2xl font-bold text-gray-900 mt-12 mb-4 scroll-mt-24"
      >
        Popular Anime to Watch Together
      </h2>
      <p className="text-gray-700 leading-relaxed mb-4">
        Looking for something to watch? These are great group picks:
      </p>
      <ul className="grid grid-cols-2 gap-2 text-purple-600 mb-8">
        <li><Link href="/watch/attack-on-titan-with-friends" className="hover:underline">Attack on Titan</Link></li>
        <li><Link href="/watch/demon-slayer-with-friends" className="hover:underline">Demon Slayer</Link></li>
        <li><Link href="/watch/jujutsu-kaisen-with-friends" className="hover:underline">Jujutsu Kaisen</Link></li>
        <li><Link href="/watch/spy-x-family-with-friends" className="hover:underline">Spy x Family</Link></li>
        <li><Link href="/watch/one-piece-with-friends" className="hover:underline">One Piece</Link></li>
        <li><Link href="/watch/chainsaw-man-with-friends" className="hover:underline">Chainsaw Man</Link></li>
        <li><Link href="/watch/solo-leveling-with-friends" className="hover:underline">Solo Leveling</Link></li>
        <li><Link href="/watch/frieren-beyond-journeys-end-with-friends" className="hover:underline">Frieren</Link></li>
        <li><Link href="/watch/hells-paradise-with-friends" className="hover:underline">Hell&apos;s Paradise</Link></li>
        <li><Link href="/watch/jojos-bizarre-adventure-with-friends" className="hover:underline">JoJo&apos;s Bizarre Adventure</Link></li>
        <li><Link href="/watch/gurren-lagann-with-friends" className="hover:underline">Gurren Lagann</Link></li>
        <li><Link href="/watch/the-promised-neverland-with-friends" className="hover:underline">The Promised Neverland</Link></li>
        <li><Link href="/watch/blue-exorcist-with-friends" className="hover:underline">Blue Exorcist</Link></li>
        <li><Link href="/watch/no-game-no-life-with-friends" className="hover:underline">No Game, No Life</Link></li>
        <li><Link href="/watch/food-wars-shokugeki-no-soma-with-friends" className="hover:underline">Food Wars</Link></li>
        <li><Link href="/watch/classroom-of-the-elite-with-friends" className="hover:underline">Classroom of the Elite</Link></li>
        <li><Link href="/watch/toradora-with-friends" className="hover:underline">Toradora!</Link></li>
        <li><Link href="/watch/ranking-of-kings-with-friends" className="hover:underline">Ranking of Kings</Link></li>
        <li><Link href="/watch/dragon-ball-z-with-friends" className="hover:underline">Dragon Ball Z</Link></li>
        <li><Link href="/watch/my-dress-up-darling-with-friends" className="hover:underline">My Dress-Up Darling</Link></li>
        <li><Link href="/watch/eighty-six-with-friends" className="hover:underline">86: Eighty Six</Link></li>
        <li><Link href="/watch/gintama-with-friends" className="hover:underline">Gintama</Link></li>
        <li><Link href="/watch/great-teacher-onizuka-with-friends" className="hover:underline">Great Teacher Onizuka</Link></li>
        <li><Link href="/watch/inuyasha-with-friends" className="hover:underline">Inuyasha</Link></li>
        <li><Link href="/watch/kaiju-no-8-with-friends" className="hover:underline">Kaiju No. 8</Link></li>
        <li><Link href="/watch/lycoris-recoil-with-friends" className="hover:underline">Lycoris Recoil</Link></li>
        <li><Link href="/watch/mashle-with-friends" className="hover:underline">Mashle: Magic and Muscles</Link></li>
        <li><Link href="/watch/samurai-champloo-with-friends" className="hover:underline">Samurai Champloo</Link></li>
        <li><Link href="/watch/wind-breaker-with-friends" className="hover:underline">Wind Breaker</Link></li>
        <li><Link href="/watch/yu-yu-hakusho-with-friends" className="hover:underline">Yu Yu Hakusho</Link></li>
        <li><Link href="/watch/psycho-pass-with-friends" className="hover:underline">Psycho-Pass</Link></li>
        <li><Link href="/watch/monster-with-friends" className="hover:underline">Monster</Link></li>
        <li><Link href="/watch/hyouka-with-friends" className="hover:underline">Hyouka</Link></li>
        <li><Link href="/watch/march-comes-in-like-a-lion-with-friends" className="hover:underline">March Comes in Like a Lion</Link></li>
        <li><Link href="/watch/noragami-with-friends" className="hover:underline">Noragami</Link></li>
        <li><Link href="/watch/akame-ga-kill-with-friends" className="hover:underline">Akame ga Kill!</Link></li>
        <li><Link href="/watch/kill-la-kill-with-friends" className="hover:underline">Kill la Kill</Link></li>
        <li><Link href="/watch/angel-beats-with-friends" className="hover:underline">Angel Beats!</Link></li>
        <li><Link href="/watch/fairy-tail-with-friends" className="hover:underline">Fairy Tail</Link></li>
        <li><Link href="/watch/trigun-with-friends" className="hover:underline">Trigun</Link></li>
        <li><Link href="/watch/cyberpunk-edgerunners-with-friends" className="hover:underline">Cyberpunk: Edgerunners</Link></li>
        <li><Link href="/watch/horimiya-with-friends" className="hover:underline">Horimiya</Link></li>
        <li><Link href="/watch/assassination-classroom-with-friends" className="hover:underline">Assassination Classroom</Link></li>
        <li><Link href="/watch/beastars-with-friends" className="hover:underline">Beastars</Link></li>
        <li><Link href="/watch/your-lie-in-april-with-friends" className="hover:underline">Your Lie in April</Link></li>
        <li><Link href="/watch/golden-kamuy-with-friends" className="hover:underline">Golden Kamuy</Link></li>
        <li><Link href="/watch/great-pretender-with-friends" className="hover:underline">Great Pretender</Link></li>
        <li><Link href="/watch/zom-100-bucket-list-of-the-dead-with-friends" className="hover:underline">Zom 100</Link></li>
        <li><Link href="/watch/darling-in-the-franxx-with-friends" className="hover:underline">Darling in the Franxx</Link></li>
        <li><Link href="/watch/the-disastrous-life-of-saiki-k-with-friends" className="hover:underline">The Disastrous Life of Saiki K.</Link></li>
      </ul>

      <h2
        id="all-guides"
        className="text-2xl font-bold text-gray-900 mt-12 mb-4 scroll-mt-24"
      >
        All Guides
      </h2>
      <ul className="space-y-2 text-purple-600">
        <li><Link href="/watch-crunchyroll-together" className="hover:underline">Watch Crunchyroll Together</Link></li>
        <li>
          <Link href="/#pricing" className="hover:underline">
            Start paid plan — see early-access pricing
          </Link>
        </li>
        <li><Link href="/compare/anidachi-vs-teleparty" className="hover:underline">AniDachi vs Teleparty</Link></li>
        {allGuideLinks.map((guide) => (
          <li key={guide.href}>
            <Link href={guide.href} className="hover:underline">
              {guide.label}
            </Link>
          </li>
        ))}
      </ul>
    </SeoPageLayout>
  );
}
