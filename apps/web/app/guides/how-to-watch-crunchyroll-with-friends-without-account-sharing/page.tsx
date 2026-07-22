import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getGuideLinks } from "@/lib/guide-links";
import { getResolvedSiteOrigin } from "@/lib/site-url";
import {
  PRICING_FRIENDS_NEED_SUBSCRIPTION_ANSWER,
  PRICING_GROUP_ONBOARDING,
} from "@/lib/pricing-copy";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Watch Crunchyroll With Friends Without Account Sharing (2026) | AniDachi",
  description:
    "Legal per-user model for Crunchyroll group watch — no password sharing. Each friend uses their own login while AniDachi syncs playback.",
  alternates: {
    canonical:
      "/guides/how-to-watch-crunchyroll-with-friends-without-account-sharing",
  },
  openGraph: {
    title: "Watch Crunchyroll With Friends Without Account Sharing",
    description:
      "Per-user Crunchyroll logins + AniDachi sync — the legal alternative to sharing one account.",
    url: "/guides/how-to-watch-crunchyroll-with-friends-without-account-sharing",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Crunchyroll Without Account Sharing",
    description: "Legal group watch with per-user logins and synced playback.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Can you watch Crunchyroll with friends without sharing an account?",
    answer:
      "Yes — and you should. Each person signs into their own Crunchyroll account and opens the same episode. AniDachi (or another sync tool) aligns play/pause and chat across separate streams without anyone sharing passwords.",
  },
  {
    question: "Is sharing a Crunchyroll account for watch parties allowed?",
    answer:
      "Account sharing violates Crunchyroll's terms of service and creates concurrent-stream limits. The supported model is one login per viewer with a sync layer on top — not one subscription passed around the group.",
  },
  {
    question: "Do all friends need their own Crunchyroll subscription?",
    answer:
      "Each viewer needs access to the series — Fan, Mega Fan, or free tier depending on catalog rights in your region. AniDachi does not grant streaming access; it syncs playback across legal individual streams.",
  },
  {
    question: "Do friends need to pay for AniDachi too?",
    answer: PRICING_FRIENDS_NEED_SUBSCRIPTION_ANSWER,
  },
  {
    question: "What if someone in the group cannot afford Crunchyroll?",
    answer:
      "Crunchyroll offers a free ad-supported tier with a limited catalog. If the series is on free tier in your region, that member can join with their own free login — sync may drift slightly around ad breaks. There is no legal workaround that gives full premium access without a subscription.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "why-not-share", label: "Why not share accounts", level: 2 },
  { id: "legal-model", label: "Legal per-user model", level: 2 },
  { id: "setup", label: "Setup steps", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function WatchCrunchyrollWithoutAccountSharingPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["crunchyroll", "how-to-core", "watch-party"],
    excludeHref:
      "/guides/how-to-watch-crunchyroll-with-friends-without-account-sharing",
    limit: 4,
  });

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Guides", url: "/watch-anime-together" },
        {
          name: "Watch Crunchyroll without account sharing",
          url: "/guides/how-to-watch-crunchyroll-with-friends-without-account-sharing",
        },
      ]}
      title="Watch Crunchyroll with friends without account sharing"
      description="Legal per-user Crunchyroll group watch — no password sharing required."
      url="/guides/how-to-watch-crunchyroll-with-friends-without-account-sharing"
      datePublished="2026-07-22"
      dateModified="2026-07-22"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImageAbsolute}
      aboveFoldCta={true}
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        How to Watch Crunchyroll With Friends Without Account Sharing
      </h1>

      <h2
        id="answer"
        className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24"
      >
        Short Answer
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-6">
        <strong>
          Do not share one Crunchyroll login — give every friend their own
          account and sync playback with AniDachi watchrooms.
        </strong>{" "}
        Each person streams at full quality from their own subscription while
        the watchroom keeps everyone on the same episode with shared chat.
      </p>

      <h2
        id="why-not-share"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Why not share accounts
      </h2>
      <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-8">
        <li>
          <strong>Terms violation</strong> — Crunchyroll prohibits credential
          sharing outside your household.
        </li>
        <li>
          <strong>Stream limits</strong> — concurrent playback caps kick in
          when too many devices use one login.
        </li>
        <li>
          <strong>Single bottleneck</strong> — one person&apos;s connection and
          device become the group&apos;s video server.
        </li>
        <li>
          <strong>Security risk</strong> — sharing passwords exposes payment
          and profile data across the friend group.
        </li>
      </ul>

      <h2
        id="legal-model"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Legal per-user model
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-4">
        {PRICING_GROUP_ONBOARDING} Watch party tools sync separate Crunchyroll
        tabs — they do not replace individual streaming rights.
      </p>
      <p className="text-foreground/80 leading-relaxed mb-8">
        For tier requirements per friend, read{" "}
        <Link
          href="/guides/does-everyone-need-crunchyroll-premium-for-watch-party"
          className="text-brand-orange hover:underline"
        >
          does everyone need Crunchyroll Premium for watch parties?
        </Link>
      </p>

      <h2
        id="setup"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Setup steps
      </h2>
      <ol className="list-decimal pl-6 space-y-3 text-foreground/80 mb-8">
        <li>
          <span className="font-medium text-foreground">
            Each friend creates or uses their own Crunchyroll account.
          </span>{" "}
          Fan, Mega Fan, or free tier — whatever grants access to your series in
          your region.
        </li>
        <li>
          <span className="font-medium text-foreground">
            Host creates an AniDachi watchroom.
          </span>{" "}
          Open the same anime on Crunchyroll and start a room from the extension.
        </li>
        <li>
          <span className="font-medium text-foreground">
            Share the invite link.
          </span>{" "}
          Friends join from their own Crunchyroll tab — no passwords exchanged.
        </li>
        <li>
          <span className="font-medium text-foreground">
            Confirm the same episode and press play.
          </span>{" "}
          AniDachi syncs playback; chat stays in the watchroom thread.
        </li>
      </ol>
      <p className="text-foreground/80 leading-relaxed mb-8">
        See{" "}
        <Link href="/pricing" className="text-brand-orange font-medium hover:underline">
          AniDachi pricing
        </Link>{" "}
        — guests join on Free; hosts upgrade when they need higher room limits.
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
            href="/guides/does-everyone-need-crunchyroll-premium-for-watch-party"
            className="hover:underline"
          >
            Does everyone need Crunchyroll Premium?
          </Link>
        </li>
        <li>
          <Link
            href="/guides/how-to-watch-crunchyroll-with-friends"
            className="hover:underline"
          >
            How to watch Crunchyroll with friends
          </Link>
        </li>
        <li>
          <Link
            href="/guides/crunchyroll-watch-party-free"
            className="hover:underline"
          >
            Crunchyroll watch party free
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
  );
}
