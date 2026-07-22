import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { HowToJsonLd } from "@/components/json-ld";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import { PRICING_TELEPARTY_COMPARE_FAQ } from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Teleparty Not Working on Crunchyroll? Fixes (2026) | AniDachi",
  description:
    "Fix Teleparty not working on Crunchyroll: sync drift, extension updates, player detection failures, and when to switch to AniDachi watchrooms.",
  alternates: { canonical: "/guides/teleparty-not-working-crunchyroll" },
  openGraph: {
    title: "Teleparty Not Working on Crunchyroll — Troubleshooting",
    description:
      "Step-by-step fixes when Teleparty won't sync, detect Crunchyroll, or keeps drifting mid-episode.",
    url: "/guides/teleparty-not-working-crunchyroll",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Teleparty Not Working on Crunchyroll?",
    description: "Sync drift, extension updates, and when to switch tools.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Why is Teleparty not syncing on Crunchyroll?",
    answer:
      "The most common causes are playback drift after a Crunchyroll player update, one member on a different episode, conflicting browser extensions, or an outdated Teleparty build. Confirm the same series and episode first, pause on a title card, and resync manually before reinstalling.",
  },
  {
    question: "Does Teleparty still work with Crunchyroll in 2026?",
    answer:
      "Yes — Teleparty generally supports Crunchyroll for live sync, but compatibility can break temporarily after Crunchyroll or Chrome updates until Teleparty ships a fix. Always test with a short clip before a premiere night.",
  },
  {
    question: "How do I fix Teleparty sync drift on Crunchyroll?",
    answer:
      "Pause everyone on the same frame (ideally a black screen or title card), count down from three, and press play together. If drift returns within minutes, disable other streaming extensions and hard-refresh the Crunchyroll tab before rejoining the session.",
  },
  {
    question: "When should I switch from Teleparty to AniDachi?",
    answer:
      "Switch when sync breaks every session, your group spans time zones and needs async catch-up, or you want per-episode progress and spoiler controls on Crunchyroll. AniDachi is built for anime groups that outgrow live-only sync.",
  },
  {
    question: "Is AniDachi free compared to Teleparty?",
    answer: PRICING_TELEPARTY_COMPARE_FAQ,
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "symptoms", label: "Common symptoms", level: 2 },
  { id: "howto", label: "HowTo: fix Teleparty", level: 2 },
  { id: "updates", label: "Extension and player updates", level: 2 },
  { id: "when-to-switch", label: "When to switch tools", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

const howToSteps = [
  {
    name: "Confirm everyone is on the same Crunchyroll episode",
    text: "Season selectors and auto-play can silently put people on different episodes. Verify series name, season, and episode number before debugging sync.",
  },
  {
    name: "Update Teleparty and Chrome",
    text: "Open chrome://extensions, enable Developer mode, and confirm Teleparty is on the latest version. Update Chrome itself — outdated builds often break player hooks after Crunchyroll ships player changes.",
  },
  {
    name: "Pause and resync manually",
    text: "Pause on a black frame or title card, countdown from three, and press play together. This cheap resync fixes most minor drift without restarting the party.",
  },
  {
    name: "Disable conflicting extensions",
    text: "Turn off other watch-party, ad-blocking, or privacy extensions on Crunchyroll temporarily. Multiple extensions fighting for player control is a top cause of Teleparty not working.",
  },
  {
    name: "Hard-refresh and rejoin",
    text: "Close the Crunchyroll tab, reopen the episode on crunchyroll.com/watch/, and start a fresh Teleparty session rather than trying to recover a broken room.",
  },
  {
    name: "Switch to per-user Crunchyroll sync",
    text: "If Teleparty keeps failing every week, move to AniDachi so each person streams from their own Crunchyroll player with a shared watchroom layer — no single-host bottleneck and optional async catch-up.",
  },
];

export default function TelepartyNotWorkingCrunchyrollPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["crunchyroll", "watch-party", "how-to-core"],
    excludeHref: "/guides/teleparty-not-working-crunchyroll",
    limit: 4,
  });

  return (
    <>
      <HowToJsonLd
        name="Fix Teleparty not working on Crunchyroll"
        description="Troubleshoot Teleparty sync drift, extension detection failures, and migrate to reliable per-user Crunchyroll watchrooms."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Guides", url: "/watch-anime-together" },
          {
            name: "Teleparty not working on Crunchyroll",
            url: "/guides/teleparty-not-working-crunchyroll",
          },
        ]}
        title="Teleparty not working on Crunchyroll — troubleshooting"
        description="Fix Teleparty sync drift, extension updates, and detection failures on Crunchyroll."
        url="/guides/teleparty-not-working-crunchyroll"
        datePublished="2026-07-22"
        dateModified="2026-07-22"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImageAbsolute}
        aboveFoldCta={true}
      >
        <h1 className="text-4xl font-bold text-foreground mb-6">
          Teleparty Not Working on Crunchyroll? Here&apos;s How to Fix It
        </h1>

        <h2
          id="answer"
          className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
        >
          Short Answer
        </h2>
        <p className="text-xl text-foreground/80 leading-relaxed mb-6">
          <strong>
            When Teleparty stops syncing on Crunchyroll, the fix is usually
            confirm the episode, update the extension, resync manually, and
            eliminate extension conflicts — not switching browsers on a whim.
          </strong>{" "}
          If sync breaks every session after Crunchyroll player updates, it is
          time to evaluate a Crunchyroll-first watchroom instead of fighting
          live-only drift.
        </p>

        <h2
          id="symptoms"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Common symptoms
        </h2>
        <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-8">
          <li>
            <strong>Sync drift</strong> — chat reactions land before the
            cliffhanger on someone&apos;s screen.
          </li>
          <li>
            <strong>Teleparty won&apos;t detect Crunchyroll</strong> — popup
            shows no video even with an episode playing.
          </li>
          <li>
            <strong>Party disconnects on tab switch</strong> — refreshing
            Crunchyroll kicks everyone out.
          </li>
          <li>
            <strong>Works on Netflix but not CR</strong> — multi-platform
            extension updated for one service before the other.
          </li>
        </ul>

        <h2
          id="howto"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          HowTo: fix Teleparty on Crunchyroll
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
          id="updates"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Extension and player updates
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          Teleparty hooks into Crunchyroll&apos;s HTML5 player. When Crunchyroll
          ships a player refactor, sync can break until Teleparty releases a
          matching update — this is the main reason &quot;it worked last week&quot;
          failures happen. Check the Teleparty changelog or community threads
          after major Crunchyroll UI changes.
        </p>
        <p className="text-foreground/80 leading-relaxed mb-8">
          For a baseline compatibility check before your group commits to
          Teleparty long-term, read{" "}
          <Link
            href="/guides/does-teleparty-work-with-crunchyroll"
            className="text-brand-orange hover:underline"
          >
            does Teleparty work with Crunchyroll?
          </Link>
        </p>

        <h2
          id="when-to-switch"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          When to switch tools
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          Keep Teleparty if your crew only watches live and jumps across Netflix,
          Disney+, and Crunchyroll in the same week. Switch when Crunchyroll is
          home base and sync keeps failing — browse{" "}
          <Link
            href="/guides/best-teleparty-alternatives-for-anime"
            className="text-brand-orange hover:underline"
          >
            best Teleparty alternatives for anime
          </Link>{" "}
          or compare{" "}
          <Link
            href="/compare/anidachi-vs-teleparty"
            className="text-brand-orange hover:underline"
          >
            AniDachi vs Teleparty
          </Link>
          . See{" "}
          <Link href="/pricing" className="text-brand-orange font-medium hover:underline">
            AniDachi pricing
          </Link>{" "}
          when you are ready to host spoiler-safe watchrooms.
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
              href="/guides/does-teleparty-work-with-crunchyroll"
              className="hover:underline"
            >
              Does Teleparty work with Crunchyroll?
            </Link>
          </li>
          <li>
            <Link
              href="/guides/best-teleparty-alternatives-for-anime"
              className="hover:underline"
            >
              Best Teleparty alternatives for anime
            </Link>
          </li>
          <li>
            <Link href="/compare/anidachi-vs-teleparty" className="hover:underline">
              AniDachi vs Teleparty
            </Link>
          </li>
          <li>
            <Link
              href="/guides/crunchyroll-watch-party-not-working"
              className="hover:underline"
            >
              Crunchyroll watch party not working
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
