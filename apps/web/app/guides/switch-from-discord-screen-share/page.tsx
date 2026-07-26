import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { HowToJsonLd } from "@/components/json-ld";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import {
  PRICING_DISCORD_COMPARE_FAQ,
  PRICING_HOST_MODEL,
} from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Switch From Discord Screen Share to AniDachi (2026 Playbook)",
  description:
    "Keep Discord for voice. Replace Go Live with an AniDachi Crunchyroll watchroom in under 10 minutes — step-by-step migration playbook.",
  alternates: { canonical: "/guides/switch-from-discord-screen-share" },
  openGraph: {
    title: "Switch From Discord Screen Share — Migration Playbook",
    description:
      "Keep Discord voice, ditch Go Live for anime. AniDachi watchroom setup steps.",
    url: "/guides/switch-from-discord-screen-share",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Switch From Discord Screen Share",
    description: "Migration playbook: Discord voice + AniDachi watchrooms.",
    images: [BRAND_OG_PATH],
  },
};

const howToSteps = [
  {
    name: "Keep the Discord voice channel",
    text: "Do not delete your server rituals — mute video Go Live and leave the voice channel open for banter.",
  },
  {
    name: "Install AniDachi on every machine",
    text: "Each person adds the Chrome extension and signs into their own Crunchyroll account before join night.",
  },
  {
    name: "Host creates a watchroom",
    text: "Open the episode on Crunchyroll, let AniDachi detect the series, and create a new watchroom.",
  },
  {
    name: "Paste the invite into Discord",
    text: "Drop the AniDachi room link in the text channel next to your voice lobby so late joiners can find it.",
  },
  {
    name: "Guests join and stream locally",
    text: "Friends click the invite, open the same episode, and confirm sync — Discord stays for voice only.",
  },
  {
    name: "Optional: enable async for stragglers",
    text: "If someone misses the live start, leave the room in async-friendly mode so they catch up without spoilers.",
  },
];

const faq = [
  {
    question: "Do we have to leave Discord entirely?",
    answer:
      "No. This playbook keeps Discord for voice and community. Only the video path changes: stop Go Live and use AniDachi so each person streams Crunchyroll locally.",
  },
  {
    question: "How long does the switch take?",
    answer:
      "Most groups finish the first migration in under 10 minutes once everyone has the extension installed. Budget one short practice clip before a finale episode.",
  },
  {
    question: "Who pays after we switch?",
    answer: `${PRICING_HOST_MODEL} Guests can stay Free. See AniDachi pricing for Plus and Pro host limits.`,
  },
  {
    question: "Is Discord screen share cheaper?",
    answer: PRICING_DISCORD_COMPARE_FAQ,
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "why-migrate", label: "Why migrate", level: 2 },
  { id: "steps", label: "Step-by-step playbook", level: 2 },
  { id: "house-rules", label: "House rules that help", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function SwitchFromDiscordScreenSharePage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["discord", "how-to-core", "watch-party"],
    excludeHref: "/guides/switch-from-discord-screen-share",
    limit: 4,
  });

  return (
    <>
      <HowToJsonLd
        name="Switch from Discord screen share to AniDachi"
        description="Keep Discord for voice and replace Go Live with a synced Crunchyroll watchroom."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Watch Anime Together", url: "/watch-anime-together" },
          {
            name: "Switch from Discord screen share",
            url: "/guides/switch-from-discord-screen-share",
          },
        ]}
        title="Switch from Discord screen share"
        description="Migration playbook: keep Discord voice, replace Go Live with AniDachi watchrooms."
        url="/guides/switch-from-discord-screen-share"
        datePublished="2026-07-19"
        dateModified="2026-07-19"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImageAbsolute}
        aboveFoldCta={true}
      >
        <h1 className="text-4xl font-bold text-foreground mb-6">
          Switch From Discord Screen Share to AniDachi
        </h1>

        <h2
          id="answer"
          className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
        >
          Short Answer
        </h2>
        <p className="text-xl text-foreground/80 leading-relaxed mb-6">
          <strong>
            Keep Discord for voice. Replace Go Live with an AniDachi watchroom so
            everyone streams Crunchyroll locally at full quality.
          </strong>{" "}
          You do not need a new social app — only a better video path. If Go Live
          is already failing, start with{" "}
          <Link
            href="/guides/can-you-screen-share-crunchyroll-on-discord"
            className="text-brand-orange hover:underline"
          >
            can you screen share Crunchyroll on Discord?
          </Link>
        </p>

        <h2
          id="why-migrate"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Why migrate
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-8">
          Screen share made sense for two-minute trailers. Full episodes expose
          black screens, soft resolution, and “pause!” shouting. Synced local
          tabs fix quality; Discord stays for the social glue. Compare tradeoffs
          on{" "}
          <Link
            href="/compare/anidachi-vs-discord-screen-share"
            className="text-brand-orange hover:underline"
          >
            AniDachi vs Discord screen share
          </Link>
          .
        </p>

        <h2
          id="steps"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Step-by-step playbook
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
          id="house-rules"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          House rules that help
        </h2>
        <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-4">
          <li>Pin the AniDachi invite next to the voice channel topic.</li>
          <li>Mute Discord video permissions so nobody restarts Go Live by habit.</li>
          <li>Agree on spoilers for past episodes before async catch-up starts.</li>
        </ul>
        <p className="text-foreground/80 leading-relaxed mb-8">
          When the host needs higher room limits, open{" "}
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
              href="/guides/can-you-screen-share-crunchyroll-on-discord"
              className="hover:underline"
            >
              Can you screen share Crunchyroll on Discord?
            </Link>
          </li>
          <li>
            <Link
              href="/guides/how-to-watch-anime-together-without-screen-share"
              className="hover:underline"
            >
              Watch anime together without screen share
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
            <Link href="/pricing" className="hover:underline">
              AniDachi pricing
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
