import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { HowToJsonLd } from "@/components/json-ld";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "How to Plan an Anime Marathon With Friends (2026)",
  description:
    "Plan an anime marathon with friends: episode counts, break schedules, snack prep, spoiler rules, and synced Crunchyroll watchrooms for weekend binges.",
  alternates: { canonical: "/guides/how-to-plan-an-anime-marathon-with-friends" },
  openGraph: {
    title: "How to Plan an Anime Marathon With Friends",
    description:
      "Weekend binge guide — how many episodes, when to break, and how to keep your group synced on Crunchyroll.",
    url: "/guides/how-to-plan-an-anime-marathon-with-friends",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "How to Plan an Anime Marathon With Friends",
    description: "Episode pacing, breaks, and watchroom setup for group anime binges.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "How many anime episodes can you watch in a marathon?",
    answer:
      "Most groups comfortably watch 8–12 episodes in a full day with breaks. Short series (12–13 episodes) fit a single weekend. For longer marathons, split across two days — 6 episodes Saturday, 6 Sunday — to avoid fatigue and keep reactions sharp.",
  },
  {
    question: "What anime is best for a marathon with friends?",
    answer:
      "Pick completed series with strong episode-to-episode momentum: KonoSuba (10 eps S1), Death Note (37 eps), Spy x Family (25 eps S1), or a Ghibli movie triple-feature. Avoid starting a 500+ episode series unless your group has committed to months of weekly sessions, not a single weekend.",
  },
  {
    question: "How do you keep everyone synced during a marathon?",
    answer:
      "Use an AniDachi watchroom on Crunchyroll so playback stays aligned without screen sharing. Schedule 10-minute breaks every 3–4 episodes, pause on black frames for manual resync if needed, and pin the current episode so nobody skips ahead during bathroom breaks.",
  },
  {
    question: "What should we eat during an anime marathon?",
    answer:
      "Match snacks to the show — convenience-store food for slice of life, ramen for action series, themed treats for Ghibli nights. Avoid messy food that takes eyes off the screen during key scenes. Hydration matters more than caffeine for 8+ hour sessions.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "pick-show", label: "Pick the right show", level: 2 },
  { id: "howto", label: "HowTo: plan your marathon", level: 2 },
  { id: "pacing", label: "Episode pacing & breaks", level: 2 },
  { id: "rules", label: "Marathon house rules", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

const howToSteps = [
  {
    name: "Choose a completed series",
    text: "Pick a show everyone can finish in your marathon window. Check episode count, runtime, and Crunchyroll availability in every member's region before committing.",
  },
  {
    name: "Set up your watchroom",
    text: "Install AniDachi, open episode 1 on Crunchyroll, and create a watchroom. Share the link before marathon day so everyone tests their setup in advance.",
  },
  {
    name: "Plan breaks",
    text: "Schedule a 10-minute break every 3–4 episodes and a longer meal break at the halfway point. Post the break schedule in your group chat so nobody loses sync wandering off.",
  },
  {
    name: "Prep snacks and seating",
    text: "Stock snacks, drinks, and chargers. For remote marathons, agree on a voice chat channel and mute rules during episodes.",
  },
  {
    name: "Debrief after the finale",
    text: "Leave 20–30 minutes after the last episode for group discussion. The best marathon moments happen in the post-credits conversation.",
  },
];

export default function HowToPlanAnAnimeMarathonWithFriendsPage() {
  return (
    <>
      <HowToJsonLd
        name="How to plan an anime marathon with friends"
        description="Plan episode pacing, breaks, and synced Crunchyroll watchrooms for a group anime binge."
        steps={howToSteps}
      />
      <SeoPageLayout
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Guides", url: "/watch-anime-together" },
          {
            name: "How to plan an anime marathon with friends",
            url: "/guides/how-to-plan-an-anime-marathon-with-friends",
          },
        ]}
        title="How to plan an anime marathon with friends"
        description="Weekend binge planning guide — episode counts, breaks, and synced watchrooms."
        url="/guides/how-to-plan-an-anime-marathon-with-friends"
        datePublished="2026-06-08"
        dateModified="2026-06-08"
        faq={faq}
        headings={tocHeadings}
        articleImage={articleImageAbsolute}
        aboveFoldCta
      >
        <h1 className="text-4xl font-bold text-foreground mb-6">
          How to plan an anime marathon with friends
        </h1>
        <p className="text-xl text-foreground/80 leading-relaxed mb-8">
          <strong>
            An anime marathon is a planned binge — a weekend, a holiday, or a
            rainy day where your group commits to watching a full series or
            season together. Good marathons need the right show, realistic pacing,
            and a synced watchroom so nobody falls behind during breaks.
          </strong>
        </p>

        <h2
          id="pick-show"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Pick the right show
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-4">
          Marathon length should match your window. Quick reference:
        </p>
        <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-8">
          <li>
            <strong>Half day (4–6 hours):</strong> 6–8 episodes or 1–2 movies —
            try{" "}
            <Link href="/watch/konosuba-with-friends" className="text-brand-orange hover:underline">
              KonoSuba S1
            </Link>{" "}
            or a Ghibli double feature.
          </li>
          <li>
            <strong>Full day (8–12 hours):</strong> 10–14 episodes —{" "}
            <Link href="/watch/death-note-with-friends" className="text-brand-orange hover:underline">
              Death Note
            </Link>
            ,{" "}
            <Link href="/watch/spy-x-family-with-friends" className="text-brand-orange hover:underline">
              Spy x Family S1
            </Link>
            , or{" "}
            <Link href="/guides/best-anime-to-binge-with-friends-this-weekend" className="text-brand-orange hover:underline">
              our weekend binge list
            </Link>
            .
          </li>
          <li>
            <strong>Two-day marathon:</strong> 24–26 episodes — a full cour or
            short series like{" "}
            <Link href="/watch/bocchi-the-rock-with-friends" className="text-brand-orange hover:underline">
              Bocchi the Rock!
            </Link>{" "}
            plus extras.
          </li>
        </ul>

        <h2
          id="howto"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          HowTo: plan your marathon
        </h2>
        <ol className="list-decimal pl-6 space-y-3 text-foreground/80 mb-8">
          {howToSteps.map((step) => (
            <li key={step.name}>
              <span className="font-medium text-foreground">{step.name}.</span>{" "}
              {step.text}
            </li>
          ))}
        </ol>

        <h2
          id="pacing"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Episode pacing &amp; breaks
        </h2>
        <p className="text-foreground/80 leading-relaxed mb-8">
          Anime fatigue is real — reactions get quieter, jokes land softer, and
          emotional beats lose impact after hour six. Build breaks into the
          schedule rather than pushing through. A 10-minute stretch break every
          3–4 episodes keeps energy up. Stop at natural arc endings even if
          you planned one more episode — a strong stopping point beats a
          exhausted final hour.
        </p>

        <h2
          id="rules"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Marathon house rules
        </h2>
        <ul className="list-disc pl-6 space-y-2 text-foreground/80 mb-8">
          <li>No skipping ahead — pause the watchroom during breaks.</li>
          <li>Phones on silent during episodes; chat in the watchroom instead.</li>
          <li>Agree on dub vs sub before starting — see our{" "}
            <Link href="/glossary/dub-vs-sub-watch-party" className="text-brand-orange hover:underline">
              dub vs sub guide
            </Link>
            .
          </li>
          <li>Veto power: any member can call a break if energy drops.</li>
        </ul>

        <h2
          id="related"
          className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24"
        >
          Related guides
        </h2>
        <ul className="space-y-2 text-brand-orange mb-8">
          <li>
            <Link href="/guides/best-anime-to-binge-with-friends-this-weekend" className="hover:underline">
              Best anime to binge with friends this weekend
            </Link>
          </li>
          <li>
            <Link href="/guides/best-short-anime-to-watch-with-friends" className="hover:underline">
              Best short anime to watch with friends
            </Link>
          </li>
          <li>
            <Link href="/guides/anime-watch-party-ideas" className="hover:underline">
              Anime watch party ideas
            </Link>
          </li>
          <li>
            <Link href="/guides/first-anime-watch-party-checklist" className="hover:underline">
              First anime watch party checklist
            </Link>
          </li>
        </ul>
      </SeoPageLayout>
    </>
  );
}
