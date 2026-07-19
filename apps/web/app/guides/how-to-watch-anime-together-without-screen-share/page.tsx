import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { HowToJsonLd } from "@/components/json-ld";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Watch Anime Together Without Screen Share — AniDachi",
  description:
    "How to watch anime together without screen share: use synced Crunchyroll watchrooms so everyone streams locally in better quality.",
  alternates: {
    canonical: "/guides/how-to-watch-anime-together-without-screen-share",
  },
  openGraph: {
    title: "Watch Anime Together Without Screen Share",
    description:
      "Skip low-quality screen share and watch anime together with synced local Crunchyroll playback.",
    url: "/guides/how-to-watch-anime-together-without-screen-share",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Watch Anime Together Without Screen Share",
    description:
      "Skip low-quality screen share and watch anime together with synced local Crunchyroll playback.",
    images: [BRAND_OG_PATH],
  },
};

const howToSteps = [
  {
    name: "Install AniDachi",
    text: "Add the Chrome extension before opening your anime episode.",
  },
  {
    name: "Open Crunchyroll",
    text: "Go to the episode your group wants to watch.",
  },
  {
    name: "Create a watchroom",
    text: "Use AniDachi to detect the anime and create a room.",
  },
  { name: "Share the invite", text: "Send the room link to friends." },
  {
    name: "Stream locally",
    text: "Each person watches on their own Crunchyroll account while the room syncs playback.",
  },
];

const faq = [
  {
    question: "Can you watch anime together without screen sharing?",
    answer:
      "Yes. Use a watchroom tool such as AniDachi so everyone streams the episode locally while playback stays synced.",
  },
  {
    question: "Is synced playback better than Discord screen share?",
    answer:
      "For quality, yes. Synced playback avoids one host's stream becoming the bottleneck for every viewer. Discord Go Live of Crunchyroll is often blocked or soft — see our Discord screen-share guide.",
  },
  {
    question: "Do all viewers need Crunchyroll?",
    answer:
      "For Crunchyroll anime, each viewer needs their own Crunchyroll access. AniDachi does not replace the streaming service; it adds the room layer.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "why-not-screen-share", label: "Why avoid screen share?", level: 2 },
  { id: "best-for", label: "When synced rooms are better", level: 2 },
  { id: "discord", label: "Discord Go Live note", level: 2 },
  { id: "steps", label: "Step-by-step setup", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function HowToWatchAnimeTogetherWithoutScreenSharePage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["online", "crunchyroll", "watch-party", "discord"],
    excludeHref: "/guides/how-to-watch-anime-together-without-screen-share",
    limit: 4,
  });

  return (
    <>
      <HowToJsonLd
        name="How to watch anime together without screen share"
        description="Use AniDachi to create a synced anime watchroom where everyone streams locally."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Guides", url: "/watch-anime-together" },
          {
            name: "Watch anime together without screen share",
            url: "/guides/how-to-watch-anime-together-without-screen-share",
          },
        ]}
        title="How to Watch Anime Together Without Screen Share"
        description="How to watch anime together without screen share: use synced Crunchyroll watchrooms so everyone streams locally in better quality."
        url="/guides/how-to-watch-anime-together-without-screen-share"
        datePublished="2026-07-12"
        dateModified="2026-07-19"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImageAbsolute}
        aboveFoldCta={true}
      >
        <h1 className="text-4xl font-bold text-foreground mb-6">
          How to Watch Anime Together Without Screen Share
        </h1>
        <p className="text-xl text-foreground/80 leading-relaxed mb-8">
          <strong>
            To watch anime together without screen share, use a synced watchroom
            instead of broadcasting one person&apos;s browser. AniDachi lets
            everyone stream the Crunchyroll episode locally, while the room
            handles sync, chat, and async catch-up.
          </strong>
        </p>

        <h2
          id="why-not-screen-share"
          className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
        >
          Why avoid screen share?
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          Screen share makes one person&apos;s device and upload connection
          responsible for everyone else&apos;s viewing quality. It is quick, but
          it can introduce blur, lag, and audio delay.
        </p>
        <p className="text-foreground/80 leading-relaxed mb-8">
          Synced local playback is cleaner: each viewer uses their own stream,
          and the watchroom only coordinates timing and discussion.
        </p>

        <h2
          id="best-for"
          className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
        >
          When synced rooms are better
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          Use synced rooms for weekly anime nights, long-distance couples, big
          finale episodes, and any group where people care about full video
          quality.
        </p>
        <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-8">
          <li>Everyone gets their own stream quality.</li>
          <li>Pauses and seeks stay coordinated.</li>
          <li>Async catch-up is possible when someone misses the live time.</li>
        </ul>

        <h2
          id="discord"
          className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
        >
          Discord Go Live note
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-8">
          Trying to Go Live Crunchyroll on Discord? It is often blocked or soft —
          read{" "}
          <Link
            href="/guides/can-you-screen-share-crunchyroll-on-discord"
            className="text-brand-orange hover:underline"
          >
            can you screen share Crunchyroll on Discord?
          </Link>{" "}
          and migrate with{" "}
          <Link
            href="/guides/switch-from-discord-screen-share"
            className="text-brand-orange hover:underline"
          >
            switch from Discord screen share
          </Link>
          . Hosts can review{" "}
          <Link href="/pricing" className="text-brand-orange font-medium hover:underline">
            AniDachi pricing
          </Link>
          .
        </p>

        <h2
          id="steps"
          className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
        >
          Step-by-step setup
        </h2>
        <ol className="list-decimal pl-6 space-y-2 text-foreground/80 mb-8">
          {howToSteps.map((step) => (
            <li key={step.name}>
              <strong>{step.name}:</strong> {step.text}
            </li>
          ))}
        </ol>

        <h2
          id="related"
          className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
        >
          Related Guides
        </h2>
        <ul className="space-y-2 text-brand-orange mb-8">
          <li>
            <Link
              href="/guides/can-you-screen-share-crunchyroll-on-discord"
              className="hover:underline"
            >
              Can you screen share Crunchyroll on Discord?
            </Link>
          </li>
          <li>
            <Link
              href="/guides/switch-from-discord-screen-share"
              className="hover:underline"
            >
              Switch from Discord screen share
            </Link>
          </li>
          <li>
            <Link href="/watch-anime-together" className="hover:underline">
              Watch anime together online
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
