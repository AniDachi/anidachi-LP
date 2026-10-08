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
    name: "Pick the title before the call",
    text: "A group stalls if the film is still being argued when everyone is online. Choose the movie or episode first.",
  },
  {
    name: "Give everyone the start time",
    text: "Send one time that works in each time zone. Late joins miss the opening and then talk over it.",
  },
  {
    name: "Have each friend open Netflix",
    text: "Every person uses their own Netflix account in desktop Chrome and opens that same title.",
  },
  {
    name: "Sync play, and talk somewhere else",
    text: "Netflix will not sync the group. A Chrome extension does that today. Voice can stay on Discord. AniDachi Netflix rooms are not public yet.",
  },
];

export const metadata: Metadata = {
  title: "How to Watch Netflix with Friends",
  description:
    "How to watch Netflix with friends: agree on one title, a start time, and own Netflix accounts in desktop Chrome. AniDachi group rooms for Netflix are coming.",
  alternates: { canonical: "/guides/how-to-watch-netflix-with-friends" },
  openGraph: {
    title: "How to Watch Netflix with Friends",
    description: "One title, one start time, every friend on their own account.",
    url: "/guides/how-to-watch-netflix-with-friends",
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Watch Netflix with Friends",
    description: "A friend group on the same Netflix title.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "How do friends watch Netflix together?",
    answer:
      "Choose the title, set a start time, and have each friend open it on their own Netflix account. Use a sync extension so play and pause match, and a call for voices.",
  },
  {
    question: "Can one Netflix login cover the group?",
    answer:
      "No. Netflix limits how a single account can be shared, and AniDachi does not rebroadcast one person’s stream. Each friend needs access.",
  },
  {
    question: "Is a pair the same as a friend group?",
    answer:
      "The accounts work the same way. A group needs a firmer start time and a voice channel so several people are not talking over the cold open.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Short answer", level: 2 },
  { id: "steps", label: "Steps", level: 2 },
  { id: "group", label: "A group, not a pair", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

export default function HowToWatchNetflixWithFriendsPage() {
  return (
    <>
      <HowToJsonLd
        name="How to watch Netflix with friends"
        description="Set a title and a start time, then have each friend open Netflix on their own account."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Netflix watch party", url: "/netflix-watch-party" },
          {
            name: "How to watch Netflix with friends",
            url: "/guides/how-to-watch-netflix-with-friends",
          },
        ]}
        title="How to watch Netflix with friends"
        description="A friend group on one Netflix title."
        url="/guides/how-to-watch-netflix-with-friends"
        datePublished="2026-10-08"
        dateModified="2026-10-08"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImage}
        aboveFoldCta
      >
        <SeoGuideTitle>How to watch Netflix with friends</SeoGuideTitle>
        <SeoGuideAnswer>
          <p>
            Watch Netflix with friends by picking one title and one start
            time, then having every friend open it on their own account.
            Netflix will not keep the group in sync. A{" "}
            <Link href="/guides/netflix-group-watch">Netflix group watch</Link>{" "}
            is the name for that larger night. AniDachi’s Netflix rooms are
            still coming.
          </p>
        </SeoGuideAnswer>
        <h2 id="steps" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          Steps
        </h2>
        <SeoGuideSteps steps={howToSteps} />
        <h2 id="group" className="mt-10 scroll-mt-24 text-2xl font-bold text-ani-text">
          Friends versus one other person
        </h2>
        <p className="mb-6 leading-relaxed text-ani-muted">
          A pair can sort the title on the call. A group cannot. Send the
          title before you start. The two-person steps live on{" "}
          <Link
            href="/guides/how-to-watch-netflix-together"
            className="text-brand-orange hover:underline"
          >
            how to watch Netflix together
          </Link>
          . The cluster home is{" "}
          <Link href="/netflix-watch-party" className="text-brand-orange hover:underline">
            Netflix watch party
          </Link>
          . Crunchyroll and YouTube groups can install AniDachi now from{" "}
          <Link href="/extension">/extension</Link>.
        </p>
        <SeoGuideRelated
          links={[
            { href: "/netflix-watch-party", label: "Netflix watch party" },
            { href: "/guides/netflix-group-watch", label: "Netflix group watch" },
            {
              href: "/guides/how-to-watch-netflix-together",
              label: "How to watch Netflix together",
            },
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
