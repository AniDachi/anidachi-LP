import type { Metadata } from "next";
import Link from "next/link";
import {
  SeoGuideAnswer,
  SeoGuideBulletList,
  SeoGuideNote,
  SeoGuideRelated,
  SeoGuideSteps,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { HowToJsonLd } from "@/components/json-ld";
import { InstallLink } from "@/components/install-link";
import { getGuideLinks } from "@/lib/guide-links";
import { getSeoSiteOrigin } from "@/lib/site-url";

const PAGE_PATH = "/guides/teleparty-not-working-youtube";
const PAGE_TITLE = "Teleparty Not Working or Syncing? Fixes for YouTube";
const PAGE_DESCRIPTION =
  "Teleparty not working on YouTube? It works there for free. If the TP button won't start or the party won't sync, here are Teleparty's own fixes.";
const BRAND_OG_PATH = "/opengraph-image.png";
const articleImageAbsolute = `${getSeoSiteOrigin()}${BRAND_OG_PATH}`;

/**
 * Teleparty facts on this page come from its support FAQ, read on 23 Nov 2026. The page
 * absorbed /guides/does-teleparty-work-with-youtube on 23 Nov 2026 (ANI-77). Re-check on
 * each review date.
 */
const TELEPARTY_SUPPORT = "https://www.teleparty.com/support";

const telepartyFixes = [
  {
    name: "Check the four basics Teleparty lists",
    text: "Be signed in to the streaming service, on your main profile, with a video actually playing. On YouTube that means a full youtube.com/watch page, not the homepage or a feed.",
  },
  {
    name: "Click the red TP button",
    text: "When Teleparty detects the video, its toolbar button turns red. Click it to turn the video into a party. If you can't see the button, open Chrome's extensions menu (the puzzle piece), where hidden extensions sit.",
  },
  {
    name: "Reinstall to get the latest version",
    text: "Right-click the TP button, remove Teleparty, and install it again from the Chrome Web Store or Edge Add-ons. Teleparty's FAQ says reinstalling gets you the newest version, which may include a fix.",
  },
  {
    name: "Email Teleparty if it still fails",
    text: "Teleparty's support address is team@teleparty.com.",
  },
];

const extraChecks = [
  {
    name: "Everyone opens the same watch page",
    text: "Share the full youtube.com/watch link. A Short, an embed or a playlist view on one screen is a common reason one person never syncs.",
  },
  {
    name: "Turn off other video extensions on YouTube",
    text: "Other watch-party, ad-blocking or video extensions can fight over the player. Disable them on YouTube, refresh the tab and rejoin.",
  },
  {
    name: "Check the browser",
    text: "Teleparty runs in Chrome, Edge, Safari and Opera on a computer. Its FAQ says it is not available for Firefox.",
  },
  {
    name: "Start a fresh party",
    text: "If the party broke after someone refreshed, close the tab, reopen the video and start a new party rather than trying to rescue the old link.",
  },
];

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    title: PAGE_TITLE,
    description:
      "Does Teleparty work with YouTube, and what to do when the TP button won't start or the party won't sync.",
    url: PAGE_PATH,
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: "Teleparty's own fixes for YouTube parties, plus what to check next.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Does Teleparty work with YouTube?",
    answer:
      "Yes. Teleparty's support FAQ lists YouTube among the services you can host for free, with synced playback and text chat, in Chrome, Edge, Safari or Opera on a computer. Everyone in the party needs the extension or the app.",
  },
  {
    question: "Why is Teleparty not working?",
    answer:
      "Usually because it can't see a playing video. Teleparty's FAQ says to check that you are signed in to the service, on your main profile, with a video playing, then click the red TP button. If that fails, remove and reinstall the extension to get the latest version.",
  },
  {
    question: "Why is my Teleparty not syncing?",
    answer:
      "Teleparty's FAQ doesn't cover sync drift directly. The usual causes are people on different pages (a Short or embed instead of the watch page), another video extension fighting over the player, or an old version. Get everyone on the same watch page, turn off other video extensions and start a fresh party.",
  },
  {
    question: "Does Teleparty work with YouTube on a phone?",
    answer:
      "Teleparty's FAQ gives two answers. Its Android answer lists YouTube among the app's free services, but its general mobile answer names only Netflix, Disney+, Hulu and HBO Max. Test it on your phone before a planned night.",
  },
  {
    question: "Does Teleparty work on Firefox?",
    answer:
      "No. Teleparty's FAQ says it is not available for Firefox. It runs in Chrome, Edge, Safari and Opera on a computer.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "does-it-work", label: "Does Teleparty work with YouTube?", level: 2 },
  { id: "fixes", label: "Teleparty's own fixes", level: 2 },
  { id: "still-not-syncing", label: "Still not syncing?", level: 2 },
  { id: "when-to-switch", label: "When to switch tools", level: 2 },
  { id: "sources", label: "Sources", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function TelepartyNotWorkingYoutubePage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["pillar-watch-youtube"],
    excludeHref: PAGE_PATH,
    limit: 3,
  });

  return (
    <>
      <HowToJsonLd
        name="Fix Teleparty not working on YouTube"
        description="Teleparty's own fixes for a party that won't start, from its support FAQ."
        steps={telepartyFixes}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "YouTube Watch Party", url: "/watch-youtube-together" },
          { name: "Teleparty not working", url: PAGE_PATH },
        ]}
        title="Teleparty not working or syncing?"
        description={PAGE_DESCRIPTION}
        url={PAGE_PATH}
        datePublished="2026-08-11"
        dateModified="2026-11-23"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImageAbsolute}
        aboveFoldCta
      >
        <SeoGuideTitle>Teleparty Not Working on YouTube? Fixes, and What Works</SeoGuideTitle>

        <h2 id="answer" className="scroll-mt-24">
          Short answer
        </h2>
        <SeoGuideAnswer>
          <p>
            <strong>
              Teleparty does work with YouTube, and it&apos;s free there. When
              Teleparty is not working and a party won&apos;t start, it&apos;s
              usually because Teleparty can&apos;t see a playing video: check that you&apos;re signed in,
              on your main profile, on a full youtube.com/watch page with the
              video playing, then click the red TP button.
            </strong>{" "}
            If that doesn&apos;t help, remove and reinstall the extension to get
            the latest version. Both fixes come from Teleparty&apos;s support
            FAQ, read on 23 Nov 2026.
          </p>
        </SeoGuideAnswer>

        <h2 id="does-it-work" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          Does Teleparty work with YouTube?
        </h2>
        <SeoGuideBulletList
          items={[
            {
              title: "Yes, for free",
              body: "Teleparty's FAQ lists YouTube with Netflix, Disney+, Hulu, Amazon and HBO Max as services the free version can host, with synced playback and text chat. Voice and video chat need Premium.",
            },
            {
              title: "On a computer",
              body: "The extension runs in Chrome, Edge, Safari and Opera. Teleparty says it is not available for Firefox, smart TVs or game consoles.",
            },
            {
              title: "On phones, unclear",
              body: "One FAQ answer lists YouTube among the Android app's free services; another says the mobile apps support Netflix, Disney+, Hulu and HBO Max. Test before you rely on it.",
            },
            {
              title: "Everyone installs it",
              body: "Each person needs the extension or the app, and opens the party link to join.",
            },
          ]}
        />
        <p className="mb-8 leading-relaxed text-ani-muted">
          What the free version covers on other services, what Premium costs and
          whether the extension is safe are in{" "}
          <Link href="/guides/is-teleparty-free">is Teleparty free and safe</Link>.
        </p>

        <h2 id="fixes" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          Teleparty&apos;s own fixes
        </h2>
        <SeoGuideSteps steps={telepartyFixes} />

        <h2 id="still-not-syncing" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          Still not syncing? What to check next
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Teleparty&apos;s FAQ doesn&apos;t cover drift once a party is running.
          These are our checks, not Teleparty&apos;s:
        </p>
        <SeoGuideSteps steps={extraChecks} />
        <SeoGuideNote>
          Run a two-minute test with one friend before a planned night. If the
          party only breaks on YouTube while Netflix works, a recent YouTube
          player change is the likely cause, and reinstalling once Teleparty
          ships an update is the fix.
        </SeoGuideNote>

        <h2 id="when-to-switch" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          When to switch tools
        </h2>
        <p className="mb-8 leading-relaxed text-ani-muted">
          If Teleparty works for your group, stay on it. We make AniDachi, a
          Chrome extension that syncs each person&apos;s own YouTube, Netflix or
          Crunchyroll player and puts voice and video calls on the player, so
          you don&apos;t need Discord open next to the video. It runs in desktop
          Chrome only, and friends join free.{" "}
          <InstallLink href="/extension">Try AniDachi on YouTube</InstallLink>, or
          see every option side by side in{" "}
          <Link
            href="/guides/best-teleparty-alternatives-for-anime#youtube"
            className="text-brand-orange hover:underline"
          >
            the best Teleparty alternatives for YouTube
          </Link>
          .
        </p>

        <h2 id="sources" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          Sources
        </h2>
        <p className="mb-8 leading-relaxed text-ani-muted">
          Teleparty details come from the{" "}
          <a href={TELEPARTY_SUPPORT} target="_blank" rel="noopener noreferrer">
            Teleparty support FAQ
          </a>
          , read on 23 Nov 2026. We re-check it on 21 Dec 2026. The &quot;still
          not syncing&quot; checks are our own advice. AniDachi is not
          affiliated with Teleparty.
        </p>

        <SeoGuideRelated
          links={[
            { href: "/watch-youtube-together", label: "YouTube watch party hub" },
            { href: "/guides/is-teleparty-free", label: "Is Teleparty free and safe?" },
            ...relatedGuideLinks.map((g) => ({ href: g.href, label: g.label })),
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
