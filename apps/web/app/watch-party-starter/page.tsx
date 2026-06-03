import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout } from "@/components/seo-page-layout";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

/** `home` template applies only to `/` in `inferPageTemplateFromPath`; this page overrides for the same CTA/analytics variant on a dedicated starter URL. */
export const metadata: Metadata = {
  title: "Anime Watch Party Starter — Create a Crunchyroll Room",
  description:
    "Short path from “we should watch together” to a synced or async Crunchyroll watchroom. Pricing, install, and hub links in one place.",
  alternates: { canonical: "/watch-party-starter" },
  openGraph: {
    title: "Anime Watch Party Starter — AniDachi",
    description:
      "Spin up a Crunchyroll-first watchroom with chat, sync, or async pacing.",
    url: "/watch-party-starter",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi logo" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Anime Watch Party Starter",
    description: "Create a Crunchyroll watch party with AniDachi in minutes.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Is this the same signup path as the homepage?",
    answer:
      "Yes. This page funnels the same early-access pricing and Chrome extension flow as the main site, with less scrolling—useful when you share a direct link in chat before a premiere.",
  },
  {
    question: "Does AniDachi work without everyone being online at once?",
    answer:
      "Yes. AniDachi watchrooms support asynchronous watching so friends can catch up on different schedules while keeping episode-scoped chat coherent.",
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
      dateModified="2026-05-08"
      faq={faq}
      articleImage={articleImageAbsolute}
      aboveFoldCta
      conversionTemplate="home"
    >
      <h1 className="text-4xl font-bold text-gray-900 mb-6">
        Start an anime watch party on Crunchyroll
      </h1>
      <p className="text-xl text-gray-700 leading-relaxed mb-6">
        <strong>
          Grab your crew, confirm everyone can open the same series on Crunchyroll,
          then use AniDachi for the watchroom layer—synced frames, chat, and async
          catch-up when schedules slip.
        </strong>
      </p>
      <p className="text-gray-700 leading-relaxed mb-8">
        Prefer the full story first? Read the{" "}
        <Link href="/" className="text-purple-600 hover:underline">
          AniDachi homepage
        </Link>
        , browse the{" "}
        <Link href="/watch-anime-together" className="text-purple-600 hover:underline">
          complete watch-together guide
        </Link>
        , or jump to{" "}
        <Link href="/#pricing" className="text-purple-600 font-medium hover:underline">
          pricing
        </Link>{" "}
        if you are ready to checkout.
      </p>
    </SeoPageLayout>
  );
}
