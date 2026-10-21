import type { Metadata } from "next";
import Link from "next/link";
import { InstallLink } from "@/components/install-link";
import { ResponsiveDataTable } from "@/components/responsive-data-table";
import {
  SeoGuideAnswer,
  SeoGuideBulletList,
  SeoGuideNote,
  SeoGuideOptions,
  SeoGuideRelated,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getGuideLinks } from "@/lib/guide-links";
import { getSeoSiteOrigin } from "@/lib/site-url";
import { PRICING_FRIENDS_NEED_SUBSCRIPTION_ANSWER } from "@/lib/pricing-copy";

const SITE_URL = getSeoSiteOrigin();
const BRAND_OG_PATH = "/opengraph-image.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;
const PAGE_PATH = "/guides/does-everyone-need-crunchyroll-premium-for-watch-party";

const SOURCES = [
  { href: "https://www.crunchyroll.com/premium", label: "Crunchyroll plans page" },
  { href: "https://www.crunchyroll.com/tos", label: "Crunchyroll Terms of Service" },
];

export const metadata: Metadata = {
  title: "Does Everyone Need Crunchyroll Premium? (2026)",
  description:
    "Yes, each viewer needs their own Crunchyroll plan that can play the episode. Fan is enough; Mega Fan adds streams. Plan table, region note and free options.",
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    title: "Does Everyone Need Crunchyroll Premium for a Watch Party?",
    description:
      "Which Crunchyroll plan each friend needs for a watch party, what the plans include, and why region matters.",
    url: PAGE_PATH,
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Does Everyone Need Crunchyroll Premium?",
    description: "Fan vs Mega Fan for a watch party, and the region catch.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Does everyone need Crunchyroll Premium for a watch party?",
    answer:
      "Yes, in practice. Every viewer streams from their own Crunchyroll account, and the plans page checked 20 Oct 2026 lists only paid plans, with a free trial for new and eligible subscribers. The cheapest plan, Fan, is enough; nobody needs Mega Fan just to join.",
  },
  {
    question: "Can I watch Crunchyroll with friends if they don't have Premium?",
    answer:
      "Only if Crunchyroll will play the episode on their account. A watch party extension syncs players; it does not give anyone access. If a friend has no plan, they can start Crunchyroll's free trial if eligible, or the group can pick a free official upload on YouTube instead.",
  },
  {
    question: "What is the difference between Fan and Mega Fan for a watch party?",
    answer:
      "For watching together, very little. Both are listed as ad-free with the complete library and new episodes shortly after Japan. Mega Fan allows 4 devices at a time instead of 1 and adds Game Vault and Store perks. That helps a household, not a group of friends in different homes.",
  },
  {
    question: "Is Crunchyroll Fan ad-free?",
    answer:
      "The plans page lists Fan and Mega Fan as No ads, with a footnote that plans may include trailers and promotional messages for Crunchyroll content. Plan details vary by region, so check your own plans page.",
  },
  {
    question: "Can one Premium account host the whole watch party?",
    answer:
      "No. Crunchyroll's terms limit an account to one household and prohibit sharing logins outside it, and Fan streams on 1 device at a time. Each friend in another home needs their own account.",
  },
  {
    question: "Do friends need to pay for AniDachi too?",
    answer: PRICING_FRIENDS_NEED_SUBSCRIPTION_ANSWER,
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "plans", label: "Crunchyroll plans compared", level: 2 },
  { id: "who-needs-what", label: "Who needs which plan", level: 2 },
  { id: "free", label: "What about free users?", level: 2 },
  { id: "region", label: "The region catch", level: 2 },
  { id: "anidachi", label: "Where AniDachi fits", level: 2 },
  { id: "sources", label: "Sources", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

const planRows = [
  {
    plan: "Fan",
    ads: "No ads*",
    library: "Complete library, new episodes shortly after Japan",
    streams: "1 device at a time",
    party: "Enough for one viewer in a watch party",
  },
  {
    plan: "Mega Fan",
    ads: "No ads*",
    library: "Complete library, new episodes shortly after Japan",
    streams: "4 devices at a time",
    party: "Enough; extra streams only help your own household",
  },
  {
    plan: "Ultimate Fan (where offered)",
    ads: "Ad-free (page summary)",
    library: "Complete library (page summary)",
    streams: "Up to 6 devices at a time",
    party: "Enough; not needed for a watch party",
  },
  {
    plan: "No plan",
    ads: "Not listed",
    library: "Not listed on the plans page",
    streams: "None",
    party: "Cannot rely on it; check before the night",
  },
];

export default function DoesEveryoneNeedCrunchyrollPremiumPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["pillar-watch-crunchyroll"],
    excludeHref: PAGE_PATH,
    limit: 4,
  });

  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Watch Crunchyroll Together", url: "/watch-crunchyroll-together" },
        {
          name: "Does everyone need Crunchyroll Premium?",
          url: PAGE_PATH,
        },
      ]}
      title="Does everyone need Crunchyroll Premium for a watch party?"
      description="Which Crunchyroll plan each friend needs, what the plans include, and why region matters."
      url={PAGE_PATH}
      datePublished="2026-07-22"
      dateModified="2026-10-20"
      faq={faq}
      headings={tocHeadings}
      articleImage={articleImageAbsolute}
      aboveFoldCta
    >
      <SeoGuideTitle>
        Does Everyone Need Crunchyroll Premium for a Watch Party?
      </SeoGuideTitle>

      <h2 id="answer" className="scroll-mt-24">
        Short answer
      </h2>
      <SeoGuideAnswer>
        <strong>
          Yes. Each person streams from their own Crunchyroll account, and
          Crunchyroll&apos;s plans page (checked 20 Oct 2026) lists only paid
          plans, with a free trial for new and eligible subscribers. The
          cheapest plan, Fan, is enough to join. Mega Fan adds streams for a
          household. Every friend must be able to play the episode in their own
          region.
        </strong>
      </SeoGuideAnswer>

      <p className="text-foreground/80 leading-relaxed mb-6">
        &quot;Premium&quot; is Crunchyroll&apos;s word for its paid plans as a
        group: Fan, Mega Fan and, in some regions, Ultimate Fan. So the real
        question is which of those each friend needs. The rest of this page
        answers that, says what we could and could not confirm about free
        viewing, and explains the region problem that catches most groups.
        The full watch-party setup lives on the{" "}
        <Link href="/watch-crunchyroll-together" className="text-brand-orange hover:underline">
          Crunchyroll watch party guide
        </Link>
        .
      </p>

      <h2
        id="plans"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Crunchyroll plans compared for a watch party
      </h2>
      <ResponsiveDataTable
        titleKey="plan"
        columns={[
          { key: "plan", label: "Plan" },
          { key: "ads", label: "Ads" },
          { key: "library", label: "Library" },
          { key: "streams", label: "Streams at once" },
          { key: "party", label: "For a watch party" },
        ]}
        rows={planRows}
      />
      <p className="text-foreground/80 leading-relaxed mb-8">
        *Crunchyroll&apos;s footnote says plans may include trailers and
        promotional messages for its own content. The plan cards we saw
        showed Fan and Mega Fan with local prices; the page&apos;s summary
        mentions up to 6 devices for the top tier where it is offered. We have
        left prices out because they differ by country. Check your own plans
        page, and see the{" "}
        <Link href="/glossary/crunchyroll-mega-fan" className="text-brand-orange hover:underline">
          Crunchyroll Mega Fan glossary entry
        </Link>{" "}
        for the tier name.
      </p>

      <h2
        id="who-needs-what"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Who needs which plan
      </h2>
      <SeoGuideOptions
        options={[
          {
            title: "Friends in different homes",
            body: "Each person needs their own account on any paid plan. Fan is enough. Upgrading one person to Mega Fan does not cover the others, because the terms limit an account to one household.",
            highlight: true,
          },
          {
            title: "People in the same home",
            body: "You can share one account within the plan's stream limit: 1 device on Fan, 4 on Mega Fan. If two of you watch on separate screens at once, Fan will not do.",
          },
          {
            title: "A friend trying it for one night",
            body: "Crunchyroll offers a free trial to new and eligible subscribers. Remind them that it renews at the selected price unless they cancel before it ends.",
          },
        ]}
      />
      <p className="text-foreground/80 leading-relaxed mb-8">
        Why not just share one login across the group? Crunchyroll&apos;s
        terms prohibit sharing credentials outside the household and allow it
        to block devices used for password sharing. The details are in{" "}
        <Link
          href="/guides/how-to-watch-crunchyroll-with-friends-without-account-sharing"
          className="text-brand-orange hover:underline"
        >
          Crunchyroll account sharing rules
        </Link>
        .
      </p>

      <h2
        id="free"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        What about free users?
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-4">
        Older guides describe a free, ad-supported way to watch some
        Crunchyroll episodes. On 20 October 2026 the plans page listed no free
        plan, only paid ones with a trial. We could not confirm from
        Crunchyroll&apos;s own pages whether any episodes still play without a
        plan, so we do not count on it. The safe rule: if a friend has no
        plan, assume the episode will not play for them, and test it on their
        account first.
      </p>
      <p className="text-foreground/80 leading-relaxed mb-8">
        If someone in the group cannot pay, switch the night to anime that
        rights holders publish free on YouTube. Our{" "}
        <Link
          href="/guides/how-to-watch-anime-for-free-with-friends"
          className="text-brand-orange hover:underline"
        >
          free anime with friends guide
        </Link>{" "}
        lists official channels and their region limits, and{" "}
        <Link href="/guides/crunchyroll-watch-party-free" className="text-brand-orange hover:underline">
          Crunchyroll watch party free
        </Link>{" "}
        covers what costs nothing on the sync side.
      </p>

      <h2
        id="region"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        The region catch
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-4">
        A paid plan does not mean every episode plays everywhere.
        Crunchyroll&apos;s terms say content and features vary by territory
        because of licensing, that it checks location to enforce this, and
        that you should use the service only where it is officially offered.
      </p>
      <SeoGuideBulletList
        items={[
          {
            title: "Check the exact episode",
            body: "Have every friend open the episode on their own account a day before. Season pages can differ between countries.",
          },
          {
            title: "Watch for dub differences",
            body: "Audio languages can differ by region too. Agree on sub or dub before you pick the show.",
          },
          {
            title: "Skip the VPN idea",
            body: "Crunchyroll's terms ask you to use it only where it is offered. Pick a show that plays for everyone instead.",
          },
        ]}
      />

      <h2
        id="anidachi"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Where AniDachi fits
      </h2>
      <p className="text-foreground/80 leading-relaxed mb-4">
        AniDachi is the room on top. Everyone opens the episode on their own
        Crunchyroll account in desktop Chrome, and AniDachi keeps play, pause
        and seek in line, with chat, reactions, voice and video. It never
        streams video between people and cannot unlock an episode a friend
        cannot play.
      </p>
      <p className="text-foreground/80 leading-relaxed mb-8">
        AniDachi has its own, separate plans: only the host needs Plus or Pro,
        including a trial, and friends join on free accounts.{" "}
        <InstallLink href="/extension" className="text-brand-orange hover:underline">
          Install AniDachi for Chrome
        </InstallLink>{" "}
        when everyone has confirmed the episode plays, or compare{" "}
        <Link href="/pricing" className="text-brand-orange font-medium hover:underline">
          AniDachi Plus and Pro
        </Link>
        .
      </p>
      <SeoGuideNote>
        Two subscriptions, two jobs: Crunchyroll decides who can watch the
        episode, and AniDachi decides who can host the room. A guest needs the
        first, not the second.
      </SeoGuideNote>

      <h2
        id="sources"
        className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
      >
        Sources
      </h2>
      <p className="text-foreground/80 mb-8">
        Crunchyroll plan and terms details checked 20 Oct 2026:{" "}
        {SOURCES.map((source, index) => (
          <span key={source.href}>
            {index > 0 ? ", " : null}
            <a
              href={source.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-orange hover:underline"
            >
              {source.label}
            </a>
          </span>
        ))}
        . The plans page notes that benefits vary by tier and region. AniDachi
        is not affiliated with Crunchyroll.
      </p>

      <h2 id="related" className="scroll-mt-24">
        Related guides
      </h2>
      <SeoGuideRelated
        links={[
          {
            href: "/guides/how-to-watch-crunchyroll-with-friends-without-account-sharing",
            label: "Crunchyroll account sharing rules",
          },
          { href: "/guides/crunchyroll-watch-party-free", label: "Crunchyroll watch party free" },
          { href: "/glossary/crunchyroll-mega-fan", label: "Crunchyroll Mega Fan glossary" },
          { href: "/pricing", label: "AniDachi pricing" },
          ...relatedGuideLinks
            .filter(
              (g) =>
                ![
                  "/guides/how-to-watch-crunchyroll-with-friends-without-account-sharing",
                  "/guides/crunchyroll-watch-party-free",
                  "/glossary/crunchyroll-mega-fan",
                  "/pricing",
                ].includes(g.href),
            )
            .map((g) => ({ href: g.href, label: g.label })),
        ]}
      />
    </SeoPageLayout>
  );
}
