import type { Metadata } from "next";
import Link from "next/link";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { getResolvedSiteOrigin } from "@/lib/site-url";

const SITE_URL = getResolvedSiteOrigin();
const BRAND_OG_PATH = "/Anidachi_logo.png";
const articleImageAbsolute = `${SITE_URL}${BRAND_OG_PATH}`;

export const metadata: Metadata = {
  title: "Best Sci-Fi Anime to Watch With Friends (2026) | AniDachi",
  description:
    "Best sci-fi anime for group watch parties on Crunchyroll — time travel, mecha, cyberpunk, and space opera. AniDachi watchrooms with synced playback and theory-friendly chat.",
  alternates: { canonical: "/guides/best-sci-fi-anime-to-watch-with-friends" },
  openGraph: {
    title: "Best Sci-Fi Anime to Watch With Friends — 2026",
    description: "14 sci-fi anime picks for Crunchyroll group watchrooms.",
    url: "/guides/best-sci-fi-anime-to-watch-with-friends",
    images: [{ url: BRAND_OG_PATH, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Best Sci-Fi Anime to Watch With Friends — 2026",
    description: "Sci-fi anime picks for synced Crunchyroll watch parties.",
    images: [BRAND_OG_PATH],
  },
};

const faq = [
  {
    question: "What is the best sci-fi anime to watch with friends?",
    answer:
      "Steins;Gate is the top pick for theory-heavy groups — the slow burn pays off in episodes 12–24 with debates that last days. Cowboy Bebop fits one-session parties (26 episodes, episodic structure). Cyberpunk: Edgerunners is a compact 10-episode emotional sprint.",
  },
  {
    question: "Is sci-fi anime good for watch party theory discussions?",
    answer:
      "Yes — time travel (Steins;Gate), hard sci-fi (Planetes), and philosophical mecha (Evangelion) generate long post-episode threads. Use episode-tagged chat in AniDachi so late viewers avoid timeline spoilers.",
  },
  {
    question: "Should sci-fi watch parties be binge or weekly?",
    answer:
      "Steins;Gate benefits from weekly pacing before episode 12 to let theories breathe. Edgerunners and Ergo Proxy suit focused weekend binges. Episodic series like Cowboy Bebop work as drop-in watch parties any week.",
  },
];

const headings: TocHeading[] = [
  { id: "mind-benders", label: "Mind-benders & time travel", level: 2 },
  { id: "mecha-cyber", label: "Mecha & cyberpunk", level: 2 },
  { id: "space-episodic", label: "Space & episodic sci-fi", level: 2 },
  { id: "related", label: "Related guides", level: 2 },
  { id: "faq", label: "FAQ", level: 2 },
];

const itemList = [
  { name: "Mind-benders & time travel", url: "/guides/best-sci-fi-anime-to-watch-with-friends#mind-benders", position: 1 },
  { name: "Mecha & cyberpunk", url: "/guides/best-sci-fi-anime-to-watch-with-friends#mecha-cyber", position: 2 },
  { name: "Space & episodic sci-fi", url: "/guides/best-sci-fi-anime-to-watch-with-friends#space-episodic", position: 3 },
];

export default function BestSciFiAnimeToWatchWithFriendsPage() {
  return (
    <SeoPageLayout
      breadcrumbs={[
        { name: "Home", url: "/" },
        { name: "Watch Anime Together", url: "/watch-anime-together" },
        { name: "Best sci-fi anime to watch with friends", url: "/guides/best-sci-fi-anime-to-watch-with-friends" },
      ]}
      title="14 best sci-fi anime to watch with friends in 2026"
      description="Sci-fi anime picks for Crunchyroll group watchrooms."
      url="/guides/best-sci-fi-anime-to-watch-with-friends"
      datePublished="2026-07-02"
      dateModified="2026-07-02"
      faq={faq}
      headings={headings}
      itemList={itemList}
      articleImage={articleImageAbsolute}
      conversionTemplate="listicle"
      aboveFoldCta
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        Best Sci-Fi Anime to Watch With Friends (2026)
      </h1>
      <p className="text-xl text-foreground/80 leading-relaxed mb-10">
        <strong>
          Sci-fi anime turns watch parties into theory labs — timeline rules,
          mecha politics, and dystopian world-building give groups more to
          debate than reaction gifs alone. These 14 picks span time travel,
          cyberpunk, and space opera on Crunchyroll.
        </strong>
      </p>

      <h2 id="mind-benders" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        Mind-Benders &amp; Time Travel
      </h2>
      <ul className="space-y-4 text-foreground/80 mb-10">
        <li><strong><Link href="/watch/steins-gate-with-friends" className="text-brand-orange hover:underline">Steins;Gate</Link></strong> — 24 episodes; world-line theory debates peak after episode 12.</li>
        <li><strong><Link href="/watch/erased-with-friends" className="text-brand-orange hover:underline">Erased</Link></strong> — 12-episode time-loop mystery; complete in two sessions.</li>
        <li><strong><Link href="/watch/summertime-render-with-friends" className="text-brand-orange hover:underline">Summertime Render</Link></strong> — Time-loop thriller; binge-friendly 25-episode cour.</li>
        <li><strong><Link href="/watch/psycho-pass-with-friends" className="text-brand-orange hover:underline">Psycho-Pass</Link></strong> — Dystopian crime sci-fi; case-of-the-week then arc escalation.</li>
        <li><strong><Link href="/watch/serial-experiments-lain-with-friends" className="text-brand-orange hover:underline">Serial Experiments Lain</Link></strong> — Internet-age philosophy; best for patient, discussion-heavy groups.</li>
      </ul>

      <h2 id="mecha-cyber" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        Mecha &amp; Cyberpunk
      </h2>
      <ul className="space-y-4 text-foreground/80 mb-10">
        <li><strong><Link href="/watch/neon-genesis-evangelion-with-friends" className="text-brand-orange hover:underline">Neon Genesis Evangelion</Link></strong> — Mecha deconstruction; schedule a finale debrief session.</li>
        <li><strong><Link href="/watch/cyberpunk-edgerunners-with-friends" className="text-brand-orange hover:underline">Cyberpunk: Edgerunners</Link></strong> — 10 episodes; high-intensity one-weekend watch party.</li>
        <li><strong><Link href="/watch/code-geass-with-friends" className="text-brand-orange hover:underline">Code Geass</Link></strong> — Strategy mecha; groups argue protagonist morality every arc.</li>
        <li><strong><Link href="/watch/gurren-lagann-with-friends" className="text-brand-orange hover:underline">Gurren Lagann</Link></strong> — Escalation meme energy; live sync for transformation episodes.</li>
        <li><strong><Link href="/watch/ghost-in-the-shell-stand-alone-complex-with-friends" className="text-brand-orange hover:underline">Ghost in the Shell: Stand Alone Complex</Link></strong> — Episodic cyberpunk; drop-in watch party format.</li>
      </ul>

      <h2 id="space-episodic" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        Space &amp; Episodic Sci-Fi
      </h2>
      <ul className="space-y-4 text-foreground/80 mb-10">
        <li><strong><Link href="/watch/cowboy-bebop-with-friends" className="text-brand-orange hover:underline">Cowboy Bebop</Link></strong> — 26 standalone adventures; any episode works as a party entry.</li>
        <li><strong><Link href="/watch/planetes-with-friends" className="text-brand-orange hover:underline">Planetes</Link></strong> — Hard sci-fi debris collectors; quieter group discussions.</li>
        <li><strong><Link href="/watch/eighty-six-with-friends" className="text-brand-orange hover:underline">86 Eighty-Six</Link></strong> — War sci-fi; Season 1 split-cour rewards committed clubs.</li>
        <li><strong><Link href="/watch/dr-stone-with-friends" className="text-brand-orange hover:underline">Dr. Stone</Link></strong> — Science rebuild adventure; invention reveals spark group debate.</li>
      </ul>

      <h2 id="related" className="text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24">
        Related Guides
      </h2>
      <ul className="space-y-2 text-brand-orange mb-8">
        <li><Link href="/watch-sci-fi-anime-with-friends" className="hover:underline">Watch sci-fi anime with friends — genre hub</Link></li>
        <li><Link href="/watch-mecha-anime-with-friends" className="hover:underline">Watch mecha anime with friends — genre hub</Link></li>
        <li><Link href="/guides/best-psychological-anime-to-watch-with-friends" className="hover:underline">Best psychological anime with friends</Link></li>
        <li><Link href="/watch-anime-together" className="hover:underline">Watch anime together online</Link></li>
      </ul>
    </SeoPageLayout>
  );
}
