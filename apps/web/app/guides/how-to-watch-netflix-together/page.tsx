import type { Metadata } from "next";
import Link from "next/link";
import {
  SeoGuideAnswer,
  SeoGuideRelated,
  SeoGuideSteps,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { HowToJsonLd } from "@/components/json-ld";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const articleImage = `${getResolvedSiteOrigin()}/opengraph-image.png`;

const howToSteps = [
  {
    name: "Sign into Netflix on each computer",
    text: "Each person uses their own Netflix account in desktop Chrome. A shared login is not the setup.",
  },
  {
    name: "Open the same title",
    text: "Agree on the movie or episode, including the audio and subtitle track, before anyone presses play.",
  },
  {
    name: "Connect the players",
    text: "Netflix has no built-in party button. A Chrome extension is what keeps play and pause together. Teleparty is the one people use today. AniDachi’s Netflix rooms are not on the public extension yet.",
  },
  {
    name: "Keep a call open for voices",
    text: "Use Discord or a phone call for talking. The Netflix tab stays the picture.",
  },
];

export const metadata: Metadata = {
  title: "How to Watch Netflix Together",
  description:
    "How to watch Netflix together: each person opens the same title on their own account in desktop Chrome, then a Chrome extension keeps playback together. AniDachi Netflix rooms are coming.",
  alternates: { canonical: "/guides/how-to-watch-netflix-together" },
  openGraph: {
    title: "How to Watch Netflix Together",
    description: "Same title, own accounts, then a sync extension.",
    url: "/guides/how-to-watch-netflix-together",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Watch Netflix Together",
    description: "The steps for a Netflix watch party.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "How do you watch Netflix together?",
    answer:
      "Each person signs into Netflix, opens the same title, and uses a Chrome extension so play and pause match. Netflix does not include that button.",
  },
  {
    question: "Can AniDachi do this today?",
    answer:
      "Not yet. AniDachi syncs Crunchyroll and YouTube now. Netflix watchrooms are being added for desktop Chrome.",
  },
  {
    question: "Do we both need Netflix?",
    answer:
      "Yes. The other person cannot watch your stream through AniDachi. They need their own Netflix account.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "steps", label: "Steps", level: 2 },
  { id: "together", label: "Watch Netflix together", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function HowToWatchNetflixTogetherPage() {
  return (
    <>
      <HowToJsonLd
        name="How to watch Netflix together"
        description="Open the same Netflix title on each account, then keep playback together."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Netflix watch party", url: "/netflix-watch-party" },
          {
            name: "How to watch Netflix together",
            url: "/guides/how-to-watch-netflix-together",
          },
        ]}
        title="How to watch Netflix together"
        description="Same Netflix title on each account, then sync playback."
        url="/guides/how-to-watch-netflix-together"
        datePublished="2026-10-08"
        dateModified="2026-10-08"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImage}
        aboveFoldCta
      >
        <SeoGuideTitle>How to watch Netflix together</SeoGuideTitle>
        <SeoGuideAnswer>
          <p>
            To watch Netflix together, each person opens the same title on
            their own account in desktop Chrome, then a Chrome extension keeps
            play and pause aligned. That control is not inside Netflix. The
            cluster home is the{" "}
            <Link href="/netflix-watch-party">Netflix watch party</Link> page.
          </p>
        </SeoGuideAnswer>
        <h2 id="steps" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          Steps
        </h2>
        <SeoGuideSteps steps={howToSteps} />
        <h2 id="together" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          Watch Netflix together
        </h2>
        <p className="mb-6 leading-relaxed text-ani-muted">
          “Watch Netflix together” is the same night without the word how.
          The shorter page is{" "}
          <Link
            href="/guides/watch-netflix-together"
            className="text-brand-orange hover:underline"
          >
            watch Netflix together
          </Link>
          . A friend group is{" "}
          <Link
            href="/guides/how-to-watch-netflix-with-friends"
            className="text-brand-orange hover:underline"
          >
            how to watch Netflix with friends
          </Link>
          . The extension people already install is covered on{" "}
          <Link
            href="/guides/teleparty-netflix"
            className="text-brand-orange hover:underline"
          >
            Teleparty Netflix
          </Link>
          . AniDachi’s public extension still syncs Crunchyroll and YouTube
          from <Link href="/extension">/extension</Link>.
        </p>
        <SeoGuideRelated
          links={[
            { href: "/netflix-watch-party", label: "Netflix watch party" },
            { href: "/guides/watch-netflix-together", label: "Watch Netflix together" },
            {
              href: "/guides/how-to-watch-netflix-with-friends",
              label: "How to watch Netflix with friends",
            },
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
