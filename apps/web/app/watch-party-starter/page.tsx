import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout } from "@/components/seo-page-layout";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/opengraph-image.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

/** `home` template applies only to `/` in `inferPageTemplateFromPath`; this page overrides for the same CTA/analytics variant on a dedicated starter URL. */
export const metadata: Metadata = {
  title: "Watch Party App for Crunchyroll & YouTube — Start in 2 Minutes",
  description:
    "Create a Crunchyroll or YouTube watch party with friends. Add AniDachi from the Chrome Web Store, share a link, and watch in sync.",
  alternates: { canonical: "/watch-party-starter" },
  openGraph: {
    title: "Watch Party App for Crunchyroll & YouTube — AniDachi",
    description:
      "Add AniDachi from the Chrome Web Store, share a link, and watch Crunchyroll or YouTube in sync.",
    url: "/watch-party-starter",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi logo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Watch Party App for Crunchyroll & YouTube",
    description: "Add AniDachi from the Chrome Web Store and start a synced watch party.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Is this the same signup path as the homepage?",
    answer:
      "Yes. This page funnels the same Chrome extension install and Plus/Pro pricing flow as the main site, with less scrolling—useful when you share a direct link in chat before a premiere.",
  },
  {
    question: "Does AniDachi work without everyone being online at once?",
    answer:
      "Not yet. AniDachi supports live rooms today. Async catch-up is planned; personal history records your own progress separately.",
  },
  {
    question: "Is this a watch party app / watch together website?",
    answer:
      "AniDachi is a Chrome Web Store watch-party extension, not a new streaming site. Add it, open Crunchyroll or a full YouTube video, and share a room link. Platforms are Crunchyroll and YouTube only.",
  },
];

export default function WatchPartyStarterPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Watch party starter", url: "/watch-party-starter" },
      ]}
      title="Anime watch party starter"
      description="Minimal path from invite to Crunchyroll watchroom with AniDachi."
      url="/watch-party-starter"
      datePublished="2026-05-08"
      dateModified="2026-09-21"
      faq={faq}
      articleImage={articleImageAbsolute}
      aboveFoldCta
      conversionTemplate="home"
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        Start an anime watch party on Crunchyroll
      </h1>
      <p className="text-xl text-foreground/80 leading-relaxed mb-6">
        <strong>
          Grab your crew, confirm everyone can open the same series on Crunchyroll,
          then use AniDachi for live playback sync, chat, and reactions. Async catch-up is planned.
        </strong>
      </p>
      <p className="text-foreground/80 leading-relaxed mb-8">
        Prefer the full story first? Read the{" "}
        <Link href="/" className="text-brand-orange hover:underline">
          AniDachi homepage
        </Link>
        , browse the{" "}
        <Link href="/watch-anime-together" className="text-brand-orange hover:underline">
          complete watch-together guide
        </Link>
        , or jump to{" "}
        <Link href="/#pricing" className="text-brand-orange font-medium hover:underline">
          pricing
        </Link>{" "}
        if you are ready to checkout.
      </p>
    </SeoPageLayout>
  );
}
