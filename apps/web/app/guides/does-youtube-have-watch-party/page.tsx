import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import { PRICING_IS_ANIDACHI_FREE_ANSWER } from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Does YouTube Have a Watch Party? (2026 Answer) | AniDachi",
  description:
    "Does YouTube have a watch party or group watch feature? No native watch party — use AniDachi, Teleparty, or Watch2Gether for synced YouTube nights.",
  alternates: { canonical: "/guides/does-youtube-have-watch-party" },
  openGraph: {
    title: "Does YouTube Have a Watch Party Feature?",
    description:
      "YouTube has no native watch party in 2026. Here is how to watch YouTube together anyway.",
    url: "/guides/does-youtube-have-watch-party",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Does YouTube Have a Watch Party?",
    description: "No native feature — third-party watchrooms fill the gap.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Does YouTube have a watch party feature?",
    answer:
      "No. YouTube does not ship a built-in watch party or synchronized group-watch mode on full watch pages as of 2026. To watch the same video in sync, you need a third-party tool such as AniDachi, Teleparty, or Watch2Gether.",
  },
  {
    question: "Does YouTube have group watch?",
    answer:
      "Not natively. Social sharing and Premieres are not the same as a private synced room where friends control their own players together. AniDachi adds YouTube watchrooms with live sync and async catch-up on full youtube.com/watch pages.",
  },
  {
    question: "Can you watch YouTube together with friends online?",
    answer:
      "Yes — with a sync layer. Open the same full YouTube video on each device, join an AniDachi watchroom, and keep Discord (or another call) for voice. Soft-pedal Shorts, embeds, and the mobile app — provider-pinned rooms target the desktop watch page.",
  },
  {
    question: "Is AniDachi free for YouTube watch parties?",
    answer: PRICING_IS_ANIDACHI_FREE_ANSWER,
  },
  {
    question: "What is the best way to watch YouTube with friends?",
    answer:
      "Install the AniDachi Chrome extension, open a full YouTube watch page, create a watchroom, and share the invite. For a step-by-step, see how to watch YouTube with friends.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "what-youtube-offers", label: "What YouTube offers", level: 2 },
  { id: "alternatives", label: "How to watch together anyway", level: 2 },
  { id: "setup", label: "Quick AniDachi setup", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function DoesYoutubeHaveWatchPartyPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["pillar-watch-youtube"],
    excludeHref: "/guides/does-youtube-have-watch-party",
    limit: 4,
  });

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "YouTube Watch Party", url: "/watch-youtube-together" },
        {
          name: "Does YouTube have watch party?",
          url: "/guides/does-youtube-have-watch-party",
        },
      ]}
      title="Does YouTube have a watch party feature?"
      description="YouTube has no native watch party as of 2026. Here is how to watch YouTube together with friends."
      url="/guides/does-youtube-have-watch-party"
      datePublished="2026-07-26"
      dateModified="2026-07-26"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImageAbsolute}
      aboveFoldCta
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        Does YouTube Have a Watch Party Feature? (2026)
      </h1>

      <h2 id="answer" className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24">
        Short Answer
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-6">
        <strong>
          No — YouTube does not have a native watch party or group-watch feature as of
          2026.
        </strong>{" "}
        To run a YouTube watch party, add a third-party sync layer. AniDachi creates
        Chrome extension watchrooms on full YouTube watch pages with live sync or async
        catch-up — each person still streams from their own YouTube session at full
        quality.
      </p>

      <h2
        id="what-youtube-offers"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        What YouTube Actually Offers
      </h2>
      <ul className="space-y-3 text-foreground/80 mb-8">
        <li>
          <strong>Premieres:</strong> Scheduled livestream-style rollouts — public or
          unlisted, not a private synced hang for your friend group.
        </li>
        <li>
          <strong>Share links:</strong> Easy to send a video URL; does not keep playback
          aligned across devices.
        </li>
        <li>
          <strong>Shorts / embeds / mobile app:</strong> Not the target for AniDachi
          provider-pinned rooms — use a full <code>youtube.com/watch</code> page on
          desktop Chrome.
        </li>
      </ul>

      <h2
        id="alternatives"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        How to Watch YouTube Together Anyway
      </h2>
      <ul className="space-y-3 text-foreground/80 mb-8">
        <li>
          <strong>AniDachi:</strong> YouTube + Crunchyroll watchrooms, live sync, async
          reactions — start from{" "}
          <Link href="/pricing" className="text-brand-orange hover:underline">
            pricing / early access
          </Link>
          .
        </li>
        <li>
          <strong>Teleparty:</strong> Live sync on YouTube — see{" "}
          <Link
            href="/guides/does-teleparty-work-with-youtube"
            className="text-brand-orange hover:underline"
          >
            Does Teleparty work with YouTube?
          </Link>
          .
        </li>
        <li>
          <strong>Watch2Gether:</strong> Free browser rooms — compare via{" "}
          <Link
            href="/guides/watch2gether-alternatives-for-youtube"
            className="text-brand-orange hover:underline"
          >
            Watch2Gether alternatives for YouTube
          </Link>
          .
        </li>
      </ul>

      <h2 id="setup" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        Quick AniDachi Setup
      </h2>
      <ol className="list-decimal pl-6 space-y-2 text-foreground/80 mb-8">
        <li>Get early access and the Chrome extension from /pricing.</li>
        <li>Open the full YouTube video everyone agreed on.</li>
        <li>Create a watchroom and share the invite link.</li>
        <li>Keep Discord for voice; let AniDachi own playback sync.</li>
      </ol>
      <p className="text-foreground/80 mb-8">
        Full walkthrough:{" "}
        <Link
          href="/guides/how-to-watch-youtube-with-friends"
          className="text-brand-orange hover:underline"
        >
          How to watch YouTube with friends
        </Link>
        .
      </p>

      <h2 id="related" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        Related Guides
      </h2>
      <ul className="space-y-2 mb-8">
        {relatedGuideLinks.map((guide) => (
          <li key={guide.href}>
            <Link href={guide.href} className="text-brand-orange hover:underline">
              {guide.label}
            </Link>
          </li>
        ))}
      </ul>
    </SeoPageLayout>
  );
}
