import type { Metadata } from "next";
import Link from "next/link";
import { AlternativesGuide } from "@/components/alternatives-guide";

/**
 * One Rave alternatives page for every platform (ANI-44 step 4 / ANI-79, owner-approved
 * 23 Nov 2026). The URL keeps "-for-youtube" because it holds the rankings ("rave
 * alternative" position 9.2); the anime twin, the compare page and does-rave-work-with-youtube
 * 308 here. Keyword Planner, 23 Nov 2026 (worldwide / US per month): "rave app alternative"
 * 140 / 20, "apps like rave" - / 110, "rave alternative ios" 50 / 10. rave.io showed a notice
 * that Apple removed Rave from the App Store on 23 Nov 2026.
 */
const PAGE_PATH = "/guides/rave-alternatives-for-youtube";
const PAGE_TITLE = "Best Rave Alternatives: Apps Like Rave (iPhone & PC)";
const PAGE_DESCRIPTION =
  "Rave is off Apple's App Store. Apps like Rave for iPhone, Android and PC, compared for Netflix, YouTube, Crunchyroll and free voice and video chat.";

export const metadata: Metadata = {
  title: { absolute: PAGE_TITLE },
  description: PAGE_DESCRIPTION,
  alternates: { canonical: PAGE_PATH },
  openGraph: {
    title: PAGE_TITLE,
    description: "Apps like Rave for iPhone, Android and computers, compared from each company's own pages.",
    url: PAGE_PATH,
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: "Kosmi, SyncUp, AniDachi, Teleparty, Watch2Gether and Discord compared with Rave.",
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "Is Rave still on the App Store?",
    answer:
      "No. A notice on rave.io says Apple removed Rave from the App Store (checked 23 Nov 2026), although Rave's FAQ still lists iPhone and iPad. Rave is still offered for Android, Windows, Mac, Linux and Chromebook.",
  },
  {
    question: "What is the best Rave alternative for iPhone?",
    answer:
      "Kosmi and SyncUp both work in a phone browser and have apps, and Kosmi includes free voice and video chat. Teleparty has an iPhone app with fewer services than its browser extension. Discord works on iPhone for the call.",
  },
  {
    question: "Does Rave work with YouTube?",
    answer:
      "Yes. Rave's FAQ lists YouTube, but not rented or bought YouTube titles. For YouTube, Watch2Gether and SyncUp offer free rooms with no account, and AniDachi syncs each person's own youtube.com player with calls.",
  },
  {
    question: "What is the best Rave alternative on a computer?",
    answer:
      "For Netflix, YouTube or Crunchyroll with voice and video calls on the player, AniDachi in desktop Chrome. For the most streaming services with text chat, Teleparty. For a free room with video chat and no install, Kosmi.",
  },
];

export default function RaveAlternativesPage() {
  return (
    <AlternativesGuide
      path={PAGE_PATH}
      subject="rave"
      alternatives={["kosmi", "syncup", "anidachi", "teleparty", "watch2gether", "discord"]}
      breadcrumbName="Rave alternatives"
      layoutTitle="Best Rave alternatives"
      description={PAGE_DESCRIPTION}
      h1="Best Rave Alternatives (2026)"
      datePublished="2026-07-19"
      faq={faq}
      answer={
        <p>
          <strong>
            Apple removed Rave from the App Store, according to a notice on
            rave.io. On iPhone, use Kosmi or SyncUp, which both run in a phone
            browser. On a computer, use AniDachi for Netflix, YouTube or
            Crunchyroll with calls on the player, or Teleparty for the most
            streaming services.
          </strong>{" "}
          Rave itself still runs on Android, Windows, Mac, Linux and Chromebook.
          Every competitor detail here comes from that company&apos;s own site,
          checked on 23 Nov 2026.
        </p>
      }
      sections={[
        {
          id: "iphone",
          label: "Rave on iPhone: what to use now",
          content: (
            <p className="mb-8 leading-relaxed text-ani-muted">
              If Rave is already on your iPhone, the notice doesn&apos;t say
              whether it keeps working; new users can&apos;t download it from the
              App Store. Kosmi and SyncUp open in Safari from a link, so a mixed
              group of iPhone and Android friends can join the same room.
              Teleparty&apos;s iPhone app covers fewer services than its extension.
              For a call while everyone watches on their own device, Discord works
              on every phone.
            </p>
          ),
        },
        {
          id: "youtube",
          label: "Does Rave work with YouTube?",
          content: (
            <p className="mb-8 leading-relaxed text-ani-muted">
              Yes: Rave&apos;s FAQ lists YouTube, though not rented or bought
              titles. Alternatives for YouTube: Watch2Gether or SyncUp for free
              rooms with no account, Discord&apos;s Watch Together inside a call,
              or AniDachi on everyone&apos;s own youtube.com watch page with calls
              on the player. Setup:{" "}
              <Link href="/watch-youtube-together">YouTube watch party</Link>.
            </p>
          ),
        },
        {
          id: "crunchyroll",
          label: "Rave alternatives for Crunchyroll and Netflix",
          content: (
            <p className="mb-8 leading-relaxed text-ani-muted">
              Rave lists Crunchyroll and Netflix. On a computer, AniDachi syncs
              both on each person&apos;s own account with calls included, and
              friends join free; Teleparty is free on Netflix but needs Premium for
              Crunchyroll. Setup:{" "}
              <Link href="/watch-crunchyroll-together">Crunchyroll watch party</Link>{" "}
              and <Link href="/netflix-watch-party">Netflix watch party</Link>.
            </p>
          ),
        },
      ]}
      stay={
        <p>
          If everyone in your group is on Android or a computer, Rave still covers
          many services in one free app with no limit on group size. Switch when
          someone is on a new iPhone, or when you want voice and video calls on
          the player itself.
        </p>
      }
      related={[
        { href: "/guides/best-teleparty-alternatives-for-anime", label: "Best Teleparty alternatives" },
        { href: "/guides/watch2gether-alternatives-for-anime", label: "Watch2Gether alternatives" },
        { href: "/compare/anidachi-vs-kosmi", label: "Kosmi alternatives" },
        { href: "/watch-youtube-together", label: "YouTube watch party" },
      ]}
    />
  );
}
