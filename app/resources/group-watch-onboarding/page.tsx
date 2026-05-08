import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout } from "@/components/seo-page-layout";
import { getGuideLinks } from "@/lib/guide-links";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://anidachi.app";
const BRAND_OG_PATH = "/Anidachi_logo.png";
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
    answer:
      "Each viewer still pays their own streaming provider. Watch party extensions like AniDachi bill per subscriber on the checkout page—you can rotate who researches pricing, but every participant keeps their Crunchyroll login private.",
  },
  {
    question: "Should new groups start with Discord or per-user streams?",
    answer:
      "Discord screen sharing is fastest for demos but strains upload bandwidth. Move to synchronized per-user playback when people want Blu-ray-tier clarity.",
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
        { name: "Guides", url: "/watch-anime-together" },
        {
          name: "Group watch onboarding",
          url: "/resources/group-watch-onboarding",
        },
      ]}
      title="Group watch onboarding"
      description="Operational playbook for onboarding friends to anime watch parties."
      url="/resources/group-watch-onboarding"
      datePublished="2026-05-08"
      dateModified="2026-05-08"
      faq={faq}
      articleImage={articleImageAbsolute}
    >
      <h1 className="text-4xl font-bold text-gray-900 mb-6">
        Group watch onboarding
      </h1>
      <p className="text-xl text-gray-700 leading-relaxed mb-8">
        <strong>
          This resource page lives outside `/guides/` on purpose—it is for club
          admins and Discord mods who already picked a stack but still need crisp
          talking points before night one.
        </strong>
      </p>
      <p className="text-gray-700 leading-relaxed mb-6">
        Route uses the{" "}
        <code className="text-sm bg-gray-100 px-1 rounded">default</code> funnel
        template automatically. Tie follow-up CTAs back to pricing after you clarify
        roles so nobody feels pressured before accounts are squared away.
      </p>
      <p className="text-gray-700 leading-relaxed mb-10">
        After the social contract is clear,{" "}
        <Link href="/#pricing" className="text-purple-600 font-medium hover:underline">
          review AniDachi pricing
        </Link>{" "}
        and route power users through the{" "}
        <Link href="/anime-watch-party-toolkit" className="text-purple-600 hover:underline">
          anime watch party toolkit
        </Link>
        .
      </p>
      <h2 className="text-2xl font-bold text-gray-900 mt-10 mb-4">
        Suggested follow-up guides
      </h2>
      <ul className="space-y-2 text-purple-600">
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
