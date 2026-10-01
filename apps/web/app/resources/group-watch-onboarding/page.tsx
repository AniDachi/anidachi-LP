import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout } from "@/components/seo-page-layout";
import { getGuideLinks } from "@/lib/guide-links";
import { PRICING_GROUP_ONBOARDING } from "@/lib/pricing-copy";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/opengraph-image.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Group Watch Onboarding — Accounts, Roles & First Session",
  description:
    "Onboard a Discord crew or IRL friend group to Crunchyroll watch parties: who pays for what, how to assign a host, and when to switch from screen share.",
  alternates: { canonical: "/resources/group-watch-onboarding" },
  openGraph: {
    title: "Group Watch Onboarding",
    description:
      "Operational checklist for admins bringing new people into anime watch parties.",
    url: "/resources/group-watch-onboarding",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Group Watch Onboarding",
    description: "Accounts, roles, and first-session tips for anime groups.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Who should be the billing owner for watch party tools?",
    answer: PRICING_GROUP_ONBOARDING,
  },
  {
    question: "Should new groups start with Discord or per-user streams?",
    answer:
      "With AniDachi, everyone plays the video in their own browser instead of watching a shared screen. Each person needs the extension and access to the episode; only the host needs Plus or Pro, including during a trial.",
  },
];

export default function GroupWatchOnboardingPage() {
  const guides = getGuideLinks({
    includeTags: ["how-to-core", "watch-party"],
    limit: 8,
  });

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Watch Anime Together", url: "/watch-anime-together" },
        {
          name: "Group watch onboarding",
          url: "/resources/group-watch-onboarding",
        },
      ]}
      title="Group watch onboarding"
      description="Operational playbook for onboarding friends to anime watch parties."
      url="/resources/group-watch-onboarding"
      datePublished="2026-05-08"
      dateModified="2026-10-01"
      faq={faq}
      articleImage={articleImageAbsolute}
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        Group watch onboarding
      </h1>
      <p className="text-xl text-foreground/80 leading-relaxed mb-8">
        <strong>
          Bring your group together: choose a host, check that everyone can play
          the episode, and share the room invite.
        </strong>
      </p>
      <p className="text-foreground/80 leading-relaxed mb-6">
        {PRICING_GROUP_ONBOARDING} Everyone installs AniDachi in desktop Chrome
        and signs in. The host opens the episode, creates the room, and sends
        its invite link. Choose a time when everyone can join for live playback.
      </p>
      <p className="text-foreground/80 leading-relaxed mb-10">
        Before your first session,{" "}
        <Link href="/#pricing" className="text-brand-orange font-medium hover:underline">
          review AniDachi pricing
        </Link>{" "}
        and use the{" "}
        <Link href="/anime-watch-party-toolkit" className="text-brand-orange hover:underline">
          anime watch party toolkit
        </Link>
        .
      </p>
      <h2 className="text-2xl font-bold text-foreground mt-10 mb-4">
        Suggested follow-up guides
      </h2>
      <ul className="space-y-2 text-brand-orange">
        {guides.map((g) => (
          <li key={g.href}>
            <Link href={g.href} className="hover:underline">
              {g.label}
            </Link>
          </li>
        ))}
      </ul>
    </SeoPageLayout>
  );
}
