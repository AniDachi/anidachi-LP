import type { Metadata } from "next";
import Link from "next/link";
import {
  SeoGuideAnswer,
  SeoGuideOptions,
  SeoGuideRelated,
  SeoGuideSteps,
  SeoGuideBulletList,
  SeoGuideNote,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { HowToJsonLd } from "@/components/json-ld";
import { PrimaryCheckoutCta } from "@/components/primary-checkout-cta";
import { getGuideLinks } from "@/lib/guide-links";
import {
  PRICING_CR_PRICING_SNIPPET,
  PRICING_CRUNCHYROLL_GUIDE_PAID_MENTION,
} from "@/lib/pricing-copy";

export const metadata: Metadata = {
  title: "How to Watch Crunchyroll with Friends (2026) — 2-Minute Watch Party",
  description:
    "How to watch Crunchyroll with friends: Add to Chrome, open your own tab, share a link. Two people or a group — Discord voice optional. No account sharing.",
  alternates: { canonical: "/guides/how-to-watch-crunchyroll-with-friends" },
  openGraph: {
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "AniDachi – watch anime together, in perfect sync",
      },
    ],

    title: "How to Watch Crunchyroll with Friends — 2-Minute Watch Party",
    description:
      "Add AniDachi from the Chrome Web Store, open your own Crunchyroll tab, share a link. Discord voice optional.",
    url: "/guides/how-to-watch-crunchyroll-with-friends",
  },
};

const faq = [
  {
    question: "Does Crunchyroll have a watch party feature in 2026?",
    answer:
      "No. As of 2026, Crunchyroll still does not have a built-in watch party or group watch feature. You need a third-party tool — AniDachi, Crunchyroll Party, or Discord screen sharing. Full hub: /watch-crunchyroll-together.",
  },
  {
    question: "How do I watch Crunchyroll with friends online?",
    answer:
      "Open /extension, then choose Add to Chrome from the official AniDachi Chrome Web Store listing. Open any anime on Crunchyroll, detect the show, and create a watchroom. Share the invite link so each friend joins on their own Crunchyroll account.",
  },
  {
    question: "How do two people watch Crunchyroll at the same time?",
    answer:
      "Both open the same episode on their own Crunchyroll accounts, then join one AniDachi (or Crunchyroll Party) watchroom so play/pause stays aligned. Keep Discord or FaceTime for voice if you want to talk — video stays on each person's Crunchyroll tab, not a shared screen.",
  },
  {
    question: "Can you watch Crunchyroll with friends on Discord?",
    answer:
      "Yes as a hybrid: Discord for voice, AniDachi for synced Crunchyroll playback. Pure Discord Go Live screen share works but compresses video and only the host controls the player. Prefer Discord voice + watchroom sync for quality. See /guides/how-to-watch-anime-with-friends-on-discord.",
  },
  {
    question: "Can you screen share Crunchyroll for a group watch?",
    answer:
      "You can screen-share a Crunchyroll tab on Discord, but quality and control suffer. For a real group watch, use a party extension so everyone streams on their own account. Dedicated guide: /guides/can-you-screen-share-crunchyroll-on-discord.",
  },
  {
    question: "Does Crunchyroll have a group watch or watch together option?",
    answer:
      `Crunchyroll does not have a native group watch feature. Third-party Chrome extensions fill this gap: ${PRICING_CRUNCHYROLL_GUIDE_PAID_MENTION}, Crunchyroll Party (sync + basic chat, free), and Teleparty (cross-platform sync, freemium).`,
  },
  {
    question: "Is AniDachi free for Crunchyroll watch parties?",
    answer: PRICING_CR_PRICING_SNIPPET,
  },
  {
    question: "Can two people watch Crunchyroll on one account?",
    answer:
      "No — not for a real watch party. Crunchyroll limits concurrent streams, so two people should each use their own login. AniDachi syncs the two tabs; it does not share one stream. Dedicated guide: /guides/how-to-watch-crunchyroll-with-friends-without-account-sharing.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "steps", label: "Step-by-step (AniDachi)", level: 2 },
  { id: "method-discord", label: "Discord alternative", level: 2 },
  { id: "two-accounts", label: "Two people, one account?", level: 2 },
  { id: "method-cr-party", label: "Crunchyroll Party", level: 2 },
  { id: "which-method", label: "Which method to choose", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

const howToSteps = [
  {
    name: "Get AniDachi",
    text: "Open /extension, then choose Add to Chrome from the official AniDachi Chrome Web Store listing.",
  },
  {
    name: "Open Crunchyroll",
    text: "Navigate to any anime episode on Crunchyroll in desktop Chrome.",
  },
  {
    name: "Detect and create a watchroom",
    text: "Click Detect Anime, then Create Room so the room is linked to the show and episode.",
  },
  {
    name: "Invite friends",
    text: "Share the invite link so each friend joins on their own Crunchyroll account.",
  },
  {
    name: "Watch live together",
    text: "Watch live with synced playback, chat, and reactions. Async catch-up is planned, not available today.",
  },
];

export default function HowToWatchWithFriendsPage() {
  const relatedGuideLinks = getGuideLinks({
    includeTags: ["pillar-watch-crunchyroll"],
    excludeHref: "/guides/how-to-watch-crunchyroll-with-friends",
    limit: 4,
  });

  return (
    <>
      <HowToJsonLd
        name="How to watch Crunchyroll with friends"
        description="Set up an AniDachi Crunchyroll watchroom for synced live co-watching."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Watch Crunchyroll Together", url: "/watch-crunchyroll-together" },
          {
            name: "How to Watch Crunchyroll with Friends",
            url: "/guides/how-to-watch-crunchyroll-with-friends",
          },
        ]}
        title="How to Watch Crunchyroll with Friends"
        description="Every method to watch Crunchyroll together, compared and explained."
        url="/guides/how-to-watch-crunchyroll-with-friends"
        datePublished="2026-04-23"
        dateModified="2026-09-21"
        faq={faq}
        headings={tocHeadings}
        aboveFoldCta
      >
        <SeoGuideTitle>How to Watch Crunchyroll with Friends — Crunchyroll Watch Party Guide (2026)</SeoGuideTitle>

        <h2 id="answer" className="scroll-mt-24">
        Short Answer
      </h2>
      <SeoGuideAnswer>

          <strong>
            How to watch Crunchyroll with friends: create an AniDachi watchroom,
            share the invite, and watch on each person&apos;s own Crunchyroll tab
            with live playback sync for two people or a group.
          </strong>{" "}
          Full hub for party nouns (does/can/is-there):{" "}
          <Link
            href="/watch-crunchyroll-together"
          >
            Watch Crunchyroll Together
          </Link>
          . Get the extension from{" "}
          <Link href="/extension">
            the AniDachi install page
          </Link>
          — Add to Chrome from the official listing.
        
      </SeoGuideAnswer>

        <PrimaryCheckoutCta
          pagePath="/guides/how-to-watch-crunchyroll-with-friends"
          pageTemplate="guide"
          placement="content_mid"
          className="my-10"
        />

        <h2
          id="steps"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Step-by-step (AniDachi)
        </h2>
        <SeoGuideSteps
          steps={howToSteps.map((step) =>
            step.name === "Get AniDachi"
              ? {
                  name: step.name,
                  text: (
                    <>
                      Open{" "}
                      <Link href="/extension">the AniDachi install page</Link>,
                      then choose Add to Chrome from the official listing.
                    </>
                  ),
                }
              : step,
          )}
        />

        <p className="text-foreground/80 leading-relaxed mb-8">
          Need pictures of the overlay? The install hub walks the same live
          controls with pointing mocks — bubble, Create room, Layout, Voice.{" "}
          <Link href="/extension#using" className="text-brand-orange hover:underline">
            Use it on the player
          </Link>
          .
        </p>

        <h2
          id="method-discord"
          className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
        >
          Discord screen sharing (free, lower quality)
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          Discord&apos;s Go Live can share a Crunchyroll tab, but quality is
          limited and capture often fails. Prefer Discord for voice only — see{" "}
          <Link
            href="/guides/can-you-screen-share-crunchyroll-on-discord"
            className="text-brand-orange hover:underline"
          >
            can you screen share Crunchyroll on Discord
          </Link>{" "}
          and the full hybrid setup in{" "}
          <Link
            href="/guides/how-to-watch-anime-with-friends-on-discord"
            className="text-brand-orange hover:underline"
          >
            how to watch anime with friends on Discord
          </Link>
          .
        </p>

        <h2
          id="two-accounts"
          className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
        >
          Two people, one Crunchyroll account?
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          Do not share one login for a watch party. Crunchyroll caps concurrent
          streams, so the second person gets kicked or a black screen. Each
          friend opens the same episode on their own account; AniDachi only
          keeps those tabs in sync. Full note:{" "}
          <Link
            href="/guides/how-to-watch-crunchyroll-with-friends-without-account-sharing"
            className="text-brand-orange hover:underline"
          >
            watch Crunchyroll without account sharing
          </Link>
          .
        </p>

        <h2
          id="method-cr-party"
          className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
        >
          Crunchyroll Party (free, live sync only)
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          Crunchyroll Party syncs live playback on each person&apos;s account
          with basic chat. AniDachi also supports live sync, plus cameras, microphones, and personal history on Plus or Pro. Async catch-up is planned.
        </p>

        <h2
          id="which-method"
          className="text-2xl font-bold text-foreground mt-12 mb-4 scroll-mt-24"
        >
          Which Method Should You Choose?
        </h2>
        <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-8">
          <li>
            <strong>For live rooms with personal history:</strong> AniDachi
          </li>
          <li>
            <strong>For free one-off sessions:</strong> Discord voice + free sync
            tool (not Go Live as the video pipe)
          </li>
          <li>
            <strong>For free live sync:</strong> Crunchyroll Party
          </li>
        </ul>

        <h2 id="related" className="scroll-mt-24">
        Related Guides
      </h2>
      <SeoGuideRelated
        links={[
          { href: "/watch-crunchyroll-together", label: "Crunchyroll watch party (start here)" },
                    { href: "/guides/can-you-screen-share-crunchyroll-on-discord", label: "Can you screen share Crunchyroll on Discord?" },
                    { href: "/guides/crunchyroll-watch-party-free", label: "Free Crunchyroll watch party options" },
                    { href: "/pricing", label: "AniDachi pricing" },
                    ...relatedGuideLinks.map((g) => ({ href: g.href, label: g.label }))
        ]}
      />
      </SeoPageLayout>
    </>
  );
}
