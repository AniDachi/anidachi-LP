import type { Metadata } from "next";
import Link from "next/link";
import { HowToJsonLd } from "@/components/json-ld";
import { InstallLink } from "@/components/install-link";
import { ResponsiveDataTable } from "@/components/responsive-data-table";
import {
  SeoGuideAnswer,
  SeoGuideBulletList,
  SeoGuideNote,
  SeoGuideRelated,
  SeoGuideSteps,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getGuideLinks } from "@/lib/guide-links";
import { getSeoSiteOrigin } from "@/lib/site-url";
import { PRICING_FRIENDS_NEED_SUBSCRIPTION_ANSWER } from "@/lib/pricing-copy";

const SITE_URL = getSeoSiteOrigin();
const BRAND_OG_PATH = "/opengraph-image.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;
const PAGE_PATH =
  "/guides/how-to-watch-crunchyroll-with-friends-without-account-sharing";

const SOURCES = [
  { href: "https://www.crunchyroll.com/tos", label: "Crunchyroll Terms of Service" },
  { href: "https://www.crunchyroll.com/premium", label: "Crunchyroll plans page" },
];

export const metadata: Metadata = {
  title: "Crunchyroll Account Sharing: Rules & a Better Way",
  description:
    "Can you share a Crunchyroll account? The terms limit it to your household and cap streams per plan (1 on Fan, 4 on Mega Fan). How friends can watch together.",
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    title: "Crunchyroll Account Sharing: Rules and a Better Way",
    description:
      "What Crunchyroll's terms say about password sharing, how many streams each plan allows, and how friends watch together on their own accounts.",
    url: PAGE_PATH,
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Crunchyroll Account Sharing: Rules and a Better Way",
    description: "Household rules, streams per plan, and the separate-accounts setup.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "Can you share a Crunchyroll account?",
    answer:
      "Only within your household. Crunchyroll's Terms of Service, checked 20 Oct 2026, limit an account to the holder's immediate household, meaning people at the same home address, and prohibit sharing login details with anyone outside it. Friends in other homes need their own accounts.",
  },
  {
    question: "How many people can use one Crunchyroll account at the same time?",
    answer:
      "It depends on the plan. On Crunchyroll's plans page, checked 20 Oct 2026, Fan allows 1 device at a time and Mega Fan 4. The page also mentions up to 6 devices on the top tier where it is offered. Benefits vary by region.",
  },
  {
    question: "Does Crunchyroll have a family plan?",
    answer:
      "Not under that name. The plans page we checked lists Fan and Mega Fan, with no plan called family. Mega Fan's 4 streams at a time is the closest option for one household. The terms still limit any plan to people living at the same address.",
  },
  {
    question: "Does Crunchyroll stop password sharing?",
    answer:
      "Its terms allow it to. Crunchyroll says it may limit simultaneous streams and registered devices, enforce limits with technical measures, and block devices or end access where it believes they are used for password sharing.",
  },
  {
    question: "How do I watch Crunchyroll with friends without sharing an account?",
    answer:
      "Each friend signs in to their own Crunchyroll account in desktop Chrome and opens the same episode. One person hosts an AniDachi room and shares the link; AniDachi keeps everyone's player in sync and adds chat, voice and video. Nobody hands over a password.",
  },
  {
    question: "Do friends need to pay for AniDachi too?",
    answer: PRICING_FRIENDS_NEED_SUBSCRIPTION_ANSWER,
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "terms", label: "What Crunchyroll's terms say", level: 2 },
  { id: "streams", label: "Streams per plan", level: 2 },
  { id: "options", label: "Your options compared", level: 2 },
  { id: "setup", label: "Separate accounts, one room", level: 2 },
  { id: "objections", label: "Common objections", level: 2 },
  { id: "sources", label: "Sources", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

const howToSteps = [
  {
    name: "Everyone uses their own Crunchyroll account",
    text: "Each friend signs in on their own computer and checks that the chosen episode plays in their region.",
  },
  {
    name: "Install AniDachi in desktop Chrome",
    text: "Everyone adds the extension from the official Chrome Web Store listing, starting at /extension.",
  },
  {
    name: "The host creates a room",
    text: "With Plus, Pro or a trial, the host opens the episode, clicks the AniDachi capsule on the player and chooses Create room.",
  },
  {
    name: "Share the invite, not the password",
    text: "The host sends the room link in Discord or a group chat. Friends join on free AniDachi accounts.",
  },
  {
    name: "Watch in sync",
    text: "AniDachi moves each guest to the host's episode and keeps play, pause and seek aligned. Chat, voice and video run on top.",
  },
];

const optionRows = [
  {
    option: "Give your password to a friend in another home",
    terms: "Not allowed: outside the household",
    streams: "Uses one of your plan's streams",
    party: "Risky: Crunchyroll may block devices",
  },
  {
    option: "Share within your household",
    terms: "Allowed for people at the same address",
    streams: "1 on Fan, 4 on Mega Fan",
    party: "Fine on one couch; no help for friends elsewhere",
  },
  {
    option: "Discord screen share of one stream",
    terms: "Terms prohibit stream capture and retransmission",
    streams: "One stream, re-broadcast",
    party: "Often a black screen; one picture for everyone",
  },
  {
    option: "Each friend on their own account + AniDachi",
    terms: "Each person uses their own plan",
    streams: "Each account uses its own stream",
    party: "Synced players, chat, voice and video",
  },
];

export default function WatchCrunchyrollWithoutAccountSharingPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["pillar-watch-crunchyroll"],
    excludeHref: PAGE_PATH,
    limit: 4,
  });

  return (
    <>
      <HowToJsonLd
        name="How to watch Crunchyroll with friends without account sharing"
        description="Each friend uses their own Crunchyroll account while one AniDachi room keeps the players in sync."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Watch Crunchyroll Together", url: "/watch-crunchyroll-together" },
          {
            name: "Crunchyroll account sharing",
            url: PAGE_PATH,
          },
        ]}
        title="Crunchyroll account sharing: rules and a better way"
        description="What Crunchyroll's terms allow, how many streams each plan has, and how friends watch together on their own accounts."
        url={PAGE_PATH}
        datePublished="2026-07-22"
        dateModified="2026-10-20"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImageAbsolute}
        aboveFoldCta
      >
        <SeoGuideTitle>
          Crunchyroll Account Sharing: Rules and a Better Way
        </SeoGuideTitle>

        <h2 id="answer" className="scroll-mt-24">
          Short answer
        </h2>
        <SeoGuideAnswer>
          <strong>
            Crunchyroll lets you share an account only with your immediate
            household, the people at your home address, and it caps how many
            devices stream at once: 1 on Fan, 4 on Mega Fan. Friends elsewhere
            need their own accounts. To watch together, each person streams on
            their own login and a sync extension lines the players up.
          </strong>
        </SeoGuideAnswer>

        <p className="text-foreground/80 leading-relaxed mb-6">
          Rules and plan limits below come from Crunchyroll&apos;s own Terms
          of Service and plans page, checked on 20 October 2026. Links are in
          the sources section. We are not Crunchyroll and this is not legal
          advice; it is a plain reading of what the pages say, plus the setup
          we built for groups who live apart.
        </p>

        <h2
          id="terms"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          What Crunchyroll&apos;s terms say about sharing
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          The Terms of Service have a section called Account Sharing. In short:
        </p>
        <SeoGuideBulletList
          items={[
            {
              title: "Household only",
              body: "Access is limited to the account holder's immediate household, defined as people living at the same residential address. Profiles exist for those household members.",
            },
            {
              title: "No password sharing outside it",
              body: "Sharing your login details, transferring your profile, or letting anyone outside the household use the account is prohibited. The terms call unauthorized sharing a material breach.",
            },
            {
              title: "Limits can be enforced",
              body: "Crunchyroll may limit simultaneous streams and registered devices, enforce those limits with technical measures, and block devices or cut access where it believes password sharing is happening.",
            },
            {
              title: "You are responsible",
              body: "The subscriber is responsible for all use of the account, including by household members and anyone else using it.",
            },
          ]}
        />
        <p className="text-foreground/80 leading-relaxed mb-8">
          The terms also say content is licensed for personal, non-commercial
          use and prohibit stream capture and retransmitting content unless
          your plan allows it. That matters for the screen-share option in the
          table below.
        </p>

        <h2
          id="streams"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          How many streams each plan allows
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          The plans page shows the number of devices that can stream at the
          same time on each plan:
        </p>
        <SeoGuideBulletList
          items={[
            { title: "Fan", body: "1 device at a time." },
            { title: "Mega Fan", body: "4 devices at a time." },
            {
              title: "Top tier",
              body: "The page's summary mentions up to 6 devices at a time. Our check showed Fan and Mega Fan cards; the top tier is not offered in every region.",
            },
          ]}
        />
        <p className="text-foreground/80 leading-relaxed mb-8">
          Prices and benefits change by country, and the page itself says so.
          People searching for a Crunchyroll family plan usually mean this:
          there is no plan with that name, and Mega Fan&apos;s 4 streams is
          the household option. Even 4 streams do not stretch the household
          rule to friends in other cities. For which plan each friend needs,
          read{" "}
          <Link
            href="/guides/does-everyone-need-crunchyroll-premium-for-watch-party"
            className="text-brand-orange hover:underline"
          >
            does everyone need Crunchyroll Premium for a watch party
          </Link>
          .
        </p>

        <h2
          id="options"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Your options compared
        </h2>
        <ResponsiveDataTable
          titleKey="option"
          columns={[
            { key: "option", label: "Option" },
            { key: "terms", label: "Crunchyroll's terms" },
            { key: "streams", label: "Streams used" },
            { key: "party", label: "As a watch party" },
          ]}
          rows={optionRows}
        />
        <p className="text-foreground/80 leading-relaxed mb-8">
          The last row is the only one that works for friends in different
          homes without breaking a rule. Each person&apos;s player loads from
          Crunchyroll under their own plan, so nobody shares a stream and
          nobody re-broadcasts one. A sync tool only tells each player when to
          play, pause and seek. Why screen share often fails anyway is covered
          in{" "}
          <Link
            href="/guides/can-you-screen-share-crunchyroll-on-discord"
            className="text-brand-orange hover:underline"
          >
            can you screen share Crunchyroll on Discord
          </Link>
          .
        </p>

        <h2
          id="setup"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Separate accounts, one room
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          This is the setup with AniDachi in desktop Chrome. It takes about
          five minutes the first time.
        </p>
        <SeoGuideSteps steps={howToSteps} />
        <p className="text-foreground/80 leading-relaxed mb-8">
          <InstallLink href="/extension" className="text-brand-orange hover:underline">
            Add AniDachi to Chrome
          </InstallLink>{" "}
          to try it. Only the host needs AniDachi Plus or Pro, including a
          trial; friends join on free accounts. Rooms hold up to 6 people on
          Plus and 15 on Pro, host included. The full walkthrough is on the{" "}
          <Link href="/watch-crunchyroll-together" className="text-brand-orange hover:underline">
            Crunchyroll watch party guide
          </Link>
          .
        </p>

        <h2
          id="objections"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Common objections
        </h2>
        <SeoGuideBulletList
          items={[
            {
              title: "\"Everyone has to pay for Crunchyroll\"",
              body: "Yes, each viewer needs access that can play the episode. The plans page offers a free trial to new and eligible subscribers, which covers a first session. AniDachi does not unlock episodes or share a subscription.",
            },
            {
              title: "\"My friend lives in another country\"",
              body: "Crunchyroll's catalog differs by territory. Before the night, have each person open the episode on their own account. Pick a show that plays for everyone.",
            },
            {
              title: "\"We share a flat\"",
              body: "Then you are one household under the terms. Share the account on separate devices within your plan's stream limit, and use AniDachi only for friends outside the flat.",
            },
            {
              title: "\"Isn't a sync extension just sharing with extra steps?\"",
              body: "No account or password changes hands, and no video is passed between people. Each player streams on its own login; the room sends play, pause and seek.",
            },
          ]}
        />
        <SeoGuideNote>
          Keep your Crunchyroll password to yourself even inside a friend
          group. A shared login exposes your payment details and watch
          history, and you carry responsibility for every device on it.
        </SeoGuideNote>

        <h2
          id="sources"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Sources
        </h2>
        <p className="text-foreground/80 mb-8">
          Crunchyroll terms and plan details checked 20 Oct 2026:{" "}
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
          . The plans page shows regional prices and notes that benefits vary
          by region. AniDachi is not affiliated with Crunchyroll.
        </p>

        <h2 id="related" className="scroll-mt-24">
          Related guides
        </h2>
        <SeoGuideRelated
          links={[
            {
              href: "/guides/does-everyone-need-crunchyroll-premium-for-watch-party",
              label: "Does everyone need Crunchyroll Premium?",
            },
            {
              href: "/guides/how-to-watch-crunchyroll-with-friends",
              label: "How to watch Crunchyroll with friends",
            },
            { href: "/guides/crunchyroll-watch-party-free", label: "Crunchyroll watch party free" },
            { href: "/watch-crunchyroll-together", label: "Crunchyroll watch party guide" },
            ...relatedGuideLinks
              .filter(
                (g) =>
                  ![
                    "/guides/does-everyone-need-crunchyroll-premium-for-watch-party",
                    "/guides/how-to-watch-crunchyroll-with-friends",
                    "/guides/crunchyroll-watch-party-free",
                    "/watch-crunchyroll-together",
                  ].includes(g.href),
              )
              .map((g) => ({ href: g.href, label: g.label })),
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
