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
import { INSTALL_HOWTO_STEP_TEXT_VIA_HUB } from "@/lib/install-cta";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const articleImage = `${getResolvedSiteOrigin()}/opengraph-image.png`;

const howToSteps = [
  {
    name: "Open the episode on your account",
    text: "Use your own Crunchyroll login, or a full YouTube watch page, in desktop Chrome. A romance anime dubbed night fails if one person is on a trailer or a clip.",
  },
  {
    name: "Select English audio",
    text: "On Crunchyroll, English has to appear in the audio menu. On YouTube, open the upload that is the dub. No English row means that episode is not a dub watch.",
  },
  {
    name: "Match the group before play",
    text: "Everyone confirms the same episode and the same English track. A live room splits if one person is reading subtitles and the other is listening.",
  },
  {
    name: "Start the watchroom",
    text: `${INSTALL_HOWTO_STEP_TEXT_VIA_HUB} Create a room and share the link. Each person keeps their own streaming login.`,
  },
];

export const metadata: Metadata = {
  title: "Romance Anime Dubbed — English Audio Before You Press Play",
  description:
    "Romance anime dubbed means the English track is on for everyone. Confirm it on Crunchyroll or YouTube, then start an AniDachi room on that same version.",
  alternates: { canonical: "/guides/romance-anime-dubbed" },
  openGraph: {
    title: "Romance Anime Dubbed",
    description: "Same romance episode, English audio, then the room.",
    url: "/guides/romance-anime-dubbed",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Romance Anime Dubbed",
    description: "Check the English dub, then watch it together.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "What is romance anime dubbed?",
    answer:
      "A romance episode whose English voice track you can select. If the audio menu has no English option, that episode is sub only.",
  },
  {
    question: "What is the best dubbed romance anime?",
    answer:
      "This page is the audio check, not the ranking. Group title picks stay on best romance anime to watch with friends. A title only counts here when English is actually listed on the episode you opened.",
  },
  {
    question: "Can one person watch the sub?",
    answer:
      "The players allow different audio. The line then lands at different times. For a live romance episode, pick one track. Async catch-up is planned and is not available today.",
  },
  {
    question: "Do we all need Crunchyroll?",
    answer:
      "Each person needs their own access to that episode, on Crunchyroll or on a full YouTube watch page. AniDachi does not share one login.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "steps", label: "Check the dub", level: 2 },
  { id: "best", label: "Best dubbed romance", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function RomanceAnimeDubbedPage() {
  return (
    <>
      <HowToJsonLd
        name="How to watch romance anime dubbed together"
        description="Confirm the English audio on a romance episode, then start an AniDachi watchroom."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Sub vs dub", url: "/sub-vs-dub" },
          { name: "Romance anime dubbed", url: "/guides/romance-anime-dubbed" },
        ]}
        title="Romance anime dubbed"
        description="Confirm the English audio on a romance episode before the room starts."
        url="/guides/romance-anime-dubbed"
        datePublished="2026-10-08"
        dateModified="2026-10-08"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImage}
        aboveFoldCta
      >
        <SeoGuideTitle>Romance anime dubbed for a live room</SeoGuideTitle>
        <SeoGuideAnswer>
          <p>
            Romance anime dubbed means the English voice track is the version
            the group will follow. Agree on it before play.{" "}
            <Link href="/sub-vs-dub">Sub vs dub</Link> is the whole night if
            one person is reading and the other is listening.
          </p>
        </SeoGuideAnswer>
        <h2 id="steps" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          How to check the dub
        </h2>
        <SeoGuideSteps steps={howToSteps} />
        <h2 id="best" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          Best dubbed romance anime
        </h2>
        <p className="mb-6 leading-relaxed text-ani-muted">
          “Best dubbed romance anime” is a title list. This page is whether
          the episode in front of you has English audio. Titles people try
          when that track is listed include Toradora, Fruits Basket, and Spy x
          Family. A given episode can still lack English. Ranked group picks
          stay on{" "}
          <Link
            href="/guides/best-romance-anime-to-watch-with-friends"
            className="text-brand-orange hover:underline"
          >
            best romance anime to watch with friends
          </Link>
          . The audio switch for any genre is{" "}
          <Link href="/guides/watch-anime-dub" className="text-brand-orange hover:underline">
            watch anime dub
          </Link>
          . Stay on Japanese audio with{" "}
          <Link href="/guides/subbed-anime" className="text-brand-orange hover:underline">
            subbed anime
          </Link>
          . Hosting needs Plus or Pro. See{" "}
          <Link href="/pricing" className="text-brand-orange hover:underline">
            pricing
          </Link>
          . Install from{" "}
          <Link href="/extension" className="text-brand-orange hover:underline">
            /extension
          </Link>
          .
        </p>
        <SeoGuideRelated
          links={[
            { href: "/sub-vs-dub", label: "Sub vs dub" },
            {
              href: "/guides/best-romance-anime-to-watch-with-friends",
              label: "Best romance anime to watch with friends",
            },
            { href: "/guides/dubbed-anime-on-crunchyroll", label: "Dubbed anime on Crunchyroll" },
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
