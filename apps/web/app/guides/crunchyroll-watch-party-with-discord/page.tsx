import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { HowToJsonLd } from "@/components/json-ld";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import { PRICING_DISCORD_COMPARE_FAQ } from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Crunchyroll Watch Party With Discord — Voice + Sync Guide (2026) | AniDachi",
  description:
    "How to watch Crunchyroll with friends on Discord: use Discord voice for reactions and AniDachi for synced playback — not Go Live screen share.",
  alternates: { canonical: "/guides/crunchyroll-watch-party-with-discord" },
  openGraph: {
    title: "Crunchyroll Watch Party With Discord",
    description:
      "Hybrid setup: Discord voice + AniDachi per-user Crunchyroll sync for anime nights.",
    url: "/guides/crunchyroll-watch-party-with-discord",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Crunchyroll Watch Party With Discord",
    description: "Discord voice + AniDachi sync — skip Go Live for full episodes.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Can you watch Crunchyroll with friends on Discord?",
    answer:
      "Yes — but the best setup pairs Discord voice chat with per-user Crunchyroll playback synced via AniDachi. Discord Go Live screen share works for clips but degrades quality and gives only one person player controls for full episodes.",
  },
  {
    question: "Should I use Discord Go Live for Crunchyroll anime nights?",
    answer:
      "No for full episodes. Go Live caps quality, adds latency, and makes everyone except the streamer a passive viewer. Use Go Live for memes; use AniDachi for the actual episode sync.",
  },
  {
    question: "Do all friends need Crunchyroll for a Discord watch party?",
    answer:
      "Each person needs their own Crunchyroll access to stream legally at full quality. AniDachi syncs separate tabs — Discord handles voice only.",
  },
  {
    question: "Is this setup free?",
    answer: PRICING_DISCORD_COMPARE_FAQ,
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "why-not-golive", label: "Why not Go Live", level: 2 },
  { id: "howto", label: "HowTo: Discord + AniDachi", level: 2 },
  { id: "tips", label: "Voice and sync tips", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

const howToSteps = [
  {
    name: "Create or join your Discord voice channel",
    text: "Use the server and voice channel your group already hangs out in. Push-to-talk reduces background noise during quiet dialogue scenes.",
  },
  {
    name: "Each person opens Crunchyroll locally",
    text: "Everyone signs into their own Crunchyroll account and navigates to the same series and episode — no account sharing or screen share required.",
  },
  {
    name: "Start an AniDachi watchroom",
    text: "The host creates a watchroom in the AniDachi Chrome extension and shares the invite link in Discord text chat.",
  },
  {
    name: "Join the watchroom and confirm the episode",
    text: "Members join from their Crunchyroll tab. AniDachi auto-detects the anime and syncs play/pause across the group.",
  },
  {
    name: "Press play together on voice",
    text: "Count down in Discord voice, press play, and react live. For async nights, members watch on their own schedule and leave episode-tagged reactions in the watchroom.",
  },
];

export default function CrunchyrollWatchPartyWithDiscordPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["discord", "crunchyroll", "how-to-core"],
    excludeHref: "/guides/crunchyroll-watch-party-with-discord",
    limit: 4,
  });

  return (
    <>
      <HowToJsonLd
        name="Crunchyroll watch party with Discord voice and AniDachi sync"
        description="Set up Discord voice chat with per-user Crunchyroll playback synced through AniDachi watchrooms."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Watch Crunchyroll Together", url: "/watch-crunchyroll-together" },
          {
            name: "Crunchyroll watch party with Discord",
            url: "/guides/crunchyroll-watch-party-with-discord",
          },
        ]}
        title="Crunchyroll watch party with Discord"
        description="Discord voice + AniDachi sync — the hybrid setup anime groups prefer over Go Live."
        url="/guides/crunchyroll-watch-party-with-discord"
        datePublished="2026-07-22"
        dateModified="2026-07-22"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImageAbsolute}
        aboveFoldCta={true}
      >
        <h1 className="text-4xl font-bold text-foreground mb-6">
          Crunchyroll Watch Party With Discord (Voice + Sync)
        </h1>

        <h2
          id="answer"
          className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
        >
          Short Answer
        </h2>
        <p className="text-xl text-foreground/80 leading-relaxed mb-6">
          <strong>
            The best Crunchyroll watch party with Discord uses voice chat on
            Discord and synced playback via AniDachi — not Go Live screen share.
          </strong>{" "}
          Everyone streams from their own Crunchyroll tab at full quality while
          Discord carries reactions in real time.
        </p>

        <h2
          id="why-not-golive"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Why not Go Live
        </h2>
        <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-8">
          <li>
            <strong>One streamer bottleneck</strong> — only the host controls
            pause and seek.
          </li>
          <li>
            <strong>Lower video quality</strong> — Discord compresses the relay.
          </li>
          <li>
            <strong>Audio delay</strong> — voice and video drift apart on long episodes.
          </li>
          <li>
            <strong>No async catch-up</strong> — late members miss the shared room context.
          </li>
        </ul>
        <p className="text-foreground/80 leading-relaxed mb-8">
          For the full screen-share vs sync breakdown, read{" "}
          <Link
            href="/compare/anidachi-vs-discord-screen-share"
            className="text-brand-orange hover:underline"
          >
            AniDachi vs Discord screen share
          </Link>
          .
        </p>

        <h2
          id="howto"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          HowTo: Discord + AniDachi
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
          id="tips"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Voice and sync tips
        </h2>
        <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-8">
          <li>
            Mute Discord stream audio when using per-user Crunchyroll — avoid
            double audio.
          </li>
          <li>
            Fix reaction timing issues with{" "}
            <Link
              href="/guides/how-to-fix-watch-party-audio-delay"
              className="text-brand-orange hover:underline"
            >
              watch party audio delay fixes
            </Link>
            .
          </li>
          <li>
            For migration from Go Live, follow{" "}
            <Link
              href="/guides/switch-from-discord-screen-share"
              className="text-brand-orange hover:underline"
            >
              switch from Discord screen share
            </Link>
            .
          </li>
        </ul>
        <p className="text-foreground/80 leading-relaxed mb-8">
          Ready to host? See{" "}
          <Link href="/pricing" className="text-brand-orange font-medium hover:underline">
            AniDachi pricing
          </Link>
          .
        </p>

        <h2
          id="related"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Related guides
        </h2>
        <ul className="space-y-2 text-brand-orange mb-8">
          <li>
            <Link
              href="/guides/how-to-watch-anime-with-friends-on-discord"
              className="hover:underline"
            >
              How to watch anime with friends on Discord
            </Link>
          </li>
          <li>
            <Link
              href="/compare/anidachi-vs-discord-screen-share"
              className="hover:underline"
            >
              AniDachi vs Discord screen share
            </Link>
          </li>
          <li>
            <Link href="/watch-crunchyroll-together" className="hover:underline">
              Watch Crunchyroll together
            </Link>
          </li>
          {relatedGuideLinks.map((guide) => (
            <li key={guide.href}>
              <Link href={guide.href} className="hover:underline">
                {guide.label}
              </Link>
            </li>
          ))}
        </ul>
      </SeoPageLayout>
    </>
  );
}
