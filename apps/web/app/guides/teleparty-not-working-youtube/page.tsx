import type { Metadata } from "next";
import Link from "next/link";
import { PrimaryCheckoutCta } from "@/components/primary-checkout-cta";
import {
  SeoGuideAnswer,
  SeoGuideBulletList,
  SeoGuideRelated,
  SeoGuideSteps,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { HowToJsonLd } from "@/components/json-ld";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import { PRICING_TELEPARTY_COMPARE_FAQ } from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/opengraph-image.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Teleparty Not Working on YouTube? Fixes (2026) | AniDachi",
  description:
    "Fix Teleparty not working on YouTube: sync drift, extension updates, player detection failures, and when to switch to AniDachi watchrooms.",
  alternates: { canonical: "/guides/teleparty-not-working-youtube" },
  openGraph: {
    title: "Teleparty Not Working on YouTube — Troubleshooting",
    description:
      "Step-by-step fixes when Teleparty won't sync, detect YouTube, or keeps drifting mid-video.",
    url: "/guides/teleparty-not-working-youtube",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Teleparty Not Working on YouTube?",
    description: "Sync drift, extension updates, and when to switch tools.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Why is Teleparty not syncing on YouTube?",
    answer:
      "Common causes are playback drift after a YouTube player update, one member on a Shorts URL or embed instead of a full watch page, conflicting extensions, or an outdated Teleparty build. Confirm the same youtube.com/watch URL first, pause, and resync before reinstalling.",
  },
  {
    question: "Does Teleparty still work with YouTube in 2026?",
    answer:
      "Yes — Teleparty generally supports YouTube for live sync, but compatibility can break temporarily after YouTube or Chrome updates until Teleparty ships a fix. Always test with a short clip before a premiere night.",
  },
  {
    question: "How do I fix Teleparty sync drift on YouTube?",
    answer:
      "Pause everyone on the same timestamp, count down from three, and press play together. If drift returns within minutes, disable other streaming extensions and hard-refresh the YouTube tab before rejoining.",
  },
  {
    question: "When should I switch from Teleparty to AniDachi?",
    answer:
      "Switch when sync breaks every session, your group spans time zones and needs async catch-up, or you also host Crunchyroll anime nights in one extension. AniDachi is built for groups that outgrow live-only sync.",
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
    name: "Confirm everyone is on the same youtube.com/watch URL",
    text: "Shorts, embeds, and homepage feeds are not reliable party targets. Share the full watch URL and verify every tab matches before debugging sync.",
  },
  {
    name: "Update Teleparty and Chrome",
    text: "Open chrome://extensions and confirm Teleparty is on the latest version. Update Chrome itself — outdated builds often break player hooks after YouTube ships player changes.",
  },
  {
    name: "Pause and resync manually",
    text: "Pause on the same second, countdown from three, and press play together. This cheap resync fixes most minor drift without restarting the party.",
  },
  {
    name: "Disable conflicting extensions",
    text: "Turn off other watch-party, ad-blocking, or privacy extensions on YouTube temporarily. Multiple extensions fighting for player control is a top cause of Teleparty not working.",
  },
  {
    name: "Hard-refresh and rejoin",
    text: "Close the YouTube tab, reopen the full watch page, and start a fresh Teleparty session rather than trying to recover a broken room.",
  },
  {
    name: "Switch to per-user YouTube sync",
    text: "If Teleparty keeps failing every week, move to AniDachi so each person streams from their own YouTube player with a shared watchroom layer — optional async catch-up included.",
  },
];

export default function TelepartyNotWorkingYoutubePage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["pillar-watch-youtube"],
    excludeHref: "/guides/teleparty-not-working-youtube",
    limit: 4,
  });

  return (
    <>
      <HowToJsonLd
        name="Fix Teleparty not working on YouTube"
        description="Troubleshoot Teleparty sync drift, extension detection failures, and migrate to reliable per-user YouTube watchrooms."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "YouTube Watch Party", url: "/watch-youtube-together" },
          {
            name: "Teleparty not working on YouTube",
            url: "/guides/teleparty-not-working-youtube",
          },
        ]}
        title="Teleparty not working on YouTube — troubleshooting"
        description="Fix Teleparty sync drift, extension updates, and detection failures on YouTube."
        url="/guides/teleparty-not-working-youtube"
        datePublished="2026-08-11"
        dateModified="2026-08-12"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImageAbsolute}
        aboveFoldCta
      >
        <SeoGuideTitle>
          Teleparty Not Working on YouTube? Here&apos;s How to Fix It
        </SeoGuideTitle>

        <h2 id="answer" className="scroll-mt-24">
          Short Answer
        </h2>
        <SeoGuideAnswer>
          <strong>
            When Teleparty stops syncing on YouTube, the fix is usually confirm
            the watch URL, update the extension, resync manually, and eliminate
            extension conflicts — not switching browsers on a whim.
          </strong>{" "}
          If sync breaks every session after YouTube player updates, evaluate a
          YouTube watchroom instead of fighting live-only drift. Capability
          overview:{" "}
          <Link href="/guides/does-teleparty-work-with-youtube">
            does Teleparty work with YouTube?
          </Link>
          .
        </SeoGuideAnswer>

        <h2 id="symptoms" className="scroll-mt-24">
          Common symptoms
        </h2>
        <SeoGuideBulletList
          items={[
            {
              title: "Sync drift",
              body: "chat reactions land before the punchline on someone's screen.",
            },
            {
              title: "Teleparty won't detect YouTube",
              body: "popup shows no video even with a watch page playing.",
            },
            {
              title: "Party disconnects on tab switch",
              body: "refreshing YouTube kicks everyone out.",
            },
            {
              title: "Works on Netflix but not YouTube",
              body: "multi-platform extension updated for one service before the other.",
            },
          ]}
        />

        <h2 id="howto" className="scroll-mt-24">
          HowTo: fix Teleparty on YouTube
        </h2>
        <SeoGuideSteps steps={howToSteps} />

        <PrimaryCheckoutCta
          pagePath="/guides/teleparty-not-working-youtube"
          pageTemplate="guide"
          placement="content_mid"
          className="my-10"
        />

        <h2 id="updates" className="scroll-mt-24">
          Extension and player updates
        </h2>
        <p>
          Teleparty hooks into YouTube&apos;s HTML5 player. When YouTube ships a
          player refactor, sync can break until Teleparty releases a matching
          update — the main reason &quot;it worked last week.&quot; Smoke-test
          before invite night.
        </p>

        <h2 id="when-to-switch" className="scroll-mt-24">
          When to switch tools
        </h2>
        <p>
          Stay on Teleparty if live multi-service nights already work. Switch to
          AniDachi when you need async YouTube catch-up or also host Crunchyroll
          anime nights in one extension. Ranked options:{" "}
          <Link
            href="/guides/best-teleparty-alternatives-for-youtube"
            className="text-brand-orange hover:underline"
          >
            best Teleparty alternatives for YouTube
          </Link>
          . Early access:{" "}
          <Link href="/pricing" className="text-brand-orange hover:underline">
            /pricing
          </Link>
          .
        </p>

        <h2 id="related" className="scroll-mt-24">
          Related guides
        </h2>
        <SeoGuideRelated
          links={[
            {
              href: "/watch-youtube-together",
              label: "YouTube watch party hub",
            },
            ...relatedGuideLinks.map((g) => ({
              href: g.href,
              label: g.label,
            })),
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
