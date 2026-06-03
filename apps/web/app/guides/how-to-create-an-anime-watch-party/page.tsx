import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { HowToJsonLd } from "@/components/json-ld";

export const metadata: Metadata = {
  title: "How to Create an Anime Watch Party — 2026",
  description:
    "The easiest way is AniDachi: detect the show on Crunchyroll, create a watchroom, and share one link. Takes under 2 minutes for hosts.",
  alternates: { canonical: "/guides/how-to-create-an-anime-watch-party" },
  openGraph: {
    title: "How to Create an Anime Watch Party — 2026",
    description:
      "Host a Crunchyroll anime watch party with invites, chat, and optional async pacing.",
    url: "/guides/how-to-create-an-anime-watch-party",
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Create an Anime Watch Party — 2026",
    description:
      "Step through AniDachi to spin up a watchroom, or compare Discord and extension hosting.",
  },
};

const faq = [
  {
    question: "Does the host need the highest Crunchyroll tier for a watch party?",
    answer:
      "Each participant still streams under their own subscription rules. The host mainly needs a stable connection to coordinate invites and chat, not to broadcast video to everyone unless you choose screen sharing instead.",
  },
  {
    question: "How many people can join one anime watch party?",
    answer:
      "Practical limits come from chat readability and everyone maintaining their own playback. Start with six to ten active talkers; larger groups often split into two rooms for the same series.",
  },
  {
    question: "What should hosts put in the invite message besides the link?",
    answer:
      "Include the episode title, expected start window, whether spoilers are allowed for past episodes, and a reminder that each guest needs their own Crunchyroll login for synced extensions.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "method-anidachi", label: "Method 1: AniDachi", level: 2 },
  { id: "method-discord", label: "Method 2: Discord event", level: 2 },
  { id: "method-calendar", label: "Method 3: Calendar + manual sync", level: 2 },
  { id: "steps-anidachi", label: "Step-by-step with AniDachi", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

const howToSteps = [
  {
    name: "Pick the episode",
    text: "Open the exact Crunchyroll episode so guests know which file to load.",
  },
  {
    name: "Install AniDachi",
    text: "Download the extension from the Chrome Web Store on the host machine.",
  },
  {
    name: "Detect the anime",
    text: "Let AniDachi read the page metadata so the room title matches the series.",
  },
  {
    name: "Create the watchroom",
    text: "Generate a new room and confirm chat is enabled for guests.",
  },
  {
    name: "Copy the invite link",
    text: "Grab the URL AniDachi provides for one-click joins.",
  },
  {
    name: "Send instructions",
    text: "Tell friends to install the same extension and sign in to Crunchyroll before clicking join.",
  },
  {
    name: "Start when ready",
    text: "Count down in chat or use async mode if people arrive at different times.",
  },
];

export default function HowToCreateAnimeWatchPartyPage() {
  return (
    <>
      <HowToJsonLd
        name="How to create an anime watch party with AniDachi"
        description="Host a Crunchyroll watch party by detecting the anime, creating a room, and sharing invites."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Guides", url: "/watch-anime-together" },
          {
            name: "How to Create an Anime Watch Party",
            url: "/guides/how-to-create-an-anime-watch-party",
          },
        ]}
        title="How to Create an Anime Watch Party"
        description="Create an anime watch party on Crunchyroll with AniDachi, Discord, or calendar-backed sessions."
        url="/guides/how-to-create-an-anime-watch-party"
        datePublished="2026-04-27"
        dateModified="2026-04-27"
        faq={faq}
        headings={tocHeadings}
      >
        <h1 className="text-4xl font-bold text-gray-900 mb-6">
          How to Create an Anime Watch Party
        </h1>

        <p className="text-xl text-gray-700 leading-relaxed mb-8">
          <strong>
            Creating an anime watch party is possible by gathering everyone on
            the same episode with a shared chat layer. The easiest way is AniDachi
            because it auto-detects the series on Crunchyroll, spins up a
            watchroom, and hands you a single invite link new guests can follow in
            minutes.
          </strong>
        </p>

        <h2
          id="method-anidachi"
          className="text-2xl font-bold text-gray-900 mt-12 mb-4 scroll-mt-24"
        >
          Method 1: AniDachi (Crunchyroll-native hosting)
        </h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          Hosting should feel like starting a group text, not configuring a
          server. AniDachi focuses on the repetitive chores: recognizing which
          anime is playing, attaching chat to that context, and giving moderators
          a predictable invite flow. You still communicate house rules—no
          unmuted mics crunching chips—but the technical scaffolding stays short.
        </p>
        <p className="text-gray-700 leading-relaxed mb-4">
          Share{" "}
          <a
            href="https://www.crunchyroll.com/help"
            className="text-purple-600 hover:underline"
            rel="noopener noreferrer"
          >
            Crunchyroll Help
          </a>{" "}
          links with first-timers so they fix subscription issues before the
          countdown. Ask guests to install via the official{" "}
          <a
            href="https://chromewebstore.google.com/"
            className="text-purple-600 hover:underline"
            rel="noopener noreferrer"
          >
            Chrome Web Store
          </a>{" "}
          page so everyone runs compatible builds.
        </p>

        <h2
          id="method-discord"
          className="text-2xl font-bold text-gray-900 mt-12 mb-4 scroll-mt-24"
        >
          Method 2: Discord (scheduled stage or voice)
        </h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          Create a Discord event, pick a voice channel, and decide whether you
          will screen share or ask everyone to press play manually. Discord shines
          for banter; it is lighter on automated Crunchyroll sync unless you pair
          it with another tool.
        </p>

        <h2
          id="method-calendar"
          className="text-2xl font-bold text-gray-900 mt-12 mb-4 scroll-mt-24"
        >
          Method 3: Calendar invite + honor-system sync
        </h2>
        <p className="text-gray-700 leading-relaxed mb-4">
          Low-tech clubs sometimes email a calendar invite and trust everyone to
          press play at :00. That can survive for movies, yet anime episodes invite
          mid-credit scenes and post-credit stingers that desync casual countdowns.
        </p>

        <h2
          id="steps-anidachi"
          className="text-2xl font-bold text-gray-900 mt-12 mb-4 scroll-mt-24"
        >
          Step-by-step with AniDachi
        </h2>
        <ol className="list-decimal pl-6 space-y-2 text-gray-700 mb-8">
          <li>Decide the series and episode with your co-hosts.</li>
          <li>Open that episode on Crunchyroll while signed in.</li>
          <li>Launch AniDachi and run anime detection.</li>
          <li>Create a new watchroom from the extension panel.</li>
          <li>Copy the invite URL and paste it into your group chat.</li>
          <li>Remind guests to install AniDachi and log into Crunchyroll first.</li>
          <li>Start playback when the quorum is ready—or enable async pacing.</li>
        </ol>

        <h2
          id="related"
          className="text-2xl font-bold text-gray-900 mt-10 mb-4 scroll-mt-24"
        >
          Related guides
        </h2>
        <ul className="space-y-2 text-purple-600">
          <li>
            <Link href="/watch-crunchyroll-together" className="hover:underline">
              Watch Crunchyroll Together
            </Link>
          </li>
          <li>
            <Link
              href="/guides/how-to-watch-anime-with-a-group"
              className="hover:underline"
            >
              How to Watch Anime With a Group
            </Link>
          </li>
          <li>
            <Link href="/guides/anime-watch-party-ideas" className="hover:underline">
              Anime Watch Party Ideas
            </Link>
          </li>
          <li>
            <Link
              href="/guides/crunchyroll-watch-party-chrome-extension"
              className="hover:underline"
            >
              Crunchyroll Watch Party Chrome Extension
            </Link>
          </li>
          <li>
            <Link
              href="/guides/how-to-watch-anime-with-friends-online"
              className="hover:underline"
            >
              How to Watch Anime With Friends Online
            </Link>
          </li>
        </ul>
      </SeoPageLayout>
    </>
  );
}
