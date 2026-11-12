import type { Metadata } from "next";
import Link from "next/link";
import { HubCtaBand } from "@/components/hub-cta-band";
import { DE_HUB_INSTALL_STEP, HubFeatureGrid, HubLandingLayout } from "@/components/hub-landing-layout";
import { HowToJsonLd } from "@/components/json-ld";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import { SeoGuideRelated } from "@/components/seo-guide-blocks";
import type { TocHeading } from "@/components/table-of-contents";
import { languageAlternates } from "@/lib/hreflang";
import { DE_INSTALL_HUB_PATH } from "@/lib/install-cta";
import {
  DE_DESKTOP_ONLY,
  DE_HERO_FINE_PRINT,
  DE_OG_LOCALE,
  DE_PRICING_FREE20_SUMMARY,
  DE_ROOM_SIZES,
} from "@/lib/locale/de-copy";
import { getSeoSiteOrigin } from "@/lib/site-url";

const PAGE_PATH = "/de/youtube-watchparty";
const PAGE_TITLE = "YouTube Watchparty: YouTube zusammen schauen";
const PAGE_DESCRIPTION =
  "YouTube Watchparty in Chrome: YouTube-Videos zusammen und synchron schauen, jeder im eigenen Tab, mit Chat und Videoanruf. Freunde treten kostenlos bei.";
const CTA_LABEL = "YouTube Watchparty starten";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: languageAlternates({ en: "/watch-youtube-together", de: PAGE_PATH }, "de"),
  openGraph: {
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    url: PAGE_PATH,
    locale: DE_OG_LOCALE,
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    images: ["/opengraph-image.png"],
  },
};

const howToSteps = [
  DE_HUB_INSTALL_STEP,
  {
    name: "YouTube-Video öffnen",
    text: "Öffne das Video auf youtube.com, sodass in der Adresszeile youtube.com/watch steht. Shorts, eingebettete Videos und die Startseite werden nicht unterstützt.",
  },
  {
    name: "Raum erstellen",
    text: "Klicke oben rechts im Player auf die AniDachi-Kapsel und wähle „Create room“.",
  },
  {
    name: "Link teilen",
    text: "Schick den Einladungslink in euren Chat. Deine Freunde treten kostenlos bei und sehen das Video in ihrem eigenen YouTube-Player, synchron mit dir.",
  },
];

const faq = [
  {
    question: "Hat YouTube eine Watchparty-Funktion?",
    answer:
      "Auf iPhone und iPad unterstützt YouTube SharePlay; die Person, die startet, braucht YouTube Premium. Auf dem Computer gibt es für normale Videos keinen Knopf zum gemeinsamen Schauen. Dafür nutzt man Tools wie AniDachi, Watch2Gether oder Teleparty.",
  },
  {
    question: "Wie kann man YouTube zusammen schauen?",
    answer:
      "Installiere AniDachi und öffne ein Video auf youtube.com/watch. Erstelle über die AniDachi-Kapsel einen Raum und teile den Link. Deine Freunde treten kostenlos bei und schauen im eigenen YouTube-Player, synchron und mit Chat.",
  },
  {
    question: "Braucht man YouTube Premium für eine Watchparty mit AniDachi?",
    answer:
      "Nein. Normale YouTube-Videos laufen ohne Premium. Jeder sieht das Video im eigenen YouTube-Player, so wie sonst auch.",
  },
  {
    question: "Welche YouTube-Videos funktionieren?",
    answer:
      "Normale Videos auf youtube.com/watch. Shorts, auf anderen Webseiten eingebettete Videos und die Startseite werden nicht unterstützt.",
  },
  {
    question: "Ist die YouTube Watchparty kostenlos?",
    answer: `Freunde treten kostenlos bei. ${DE_PRICING_FREE20_SUMMARY}`,
  },
  {
    question: "Geht das auch am Handy?",
    answer: `Mit AniDachi nicht. ${DE_DESKTOP_ONLY} Auf iPhone und iPad gibt es SharePlay mit YouTube Premium.`,
  },
  {
    question: "Was ist der Unterschied zu Watch2Gether?",
    answer:
      "Watch2Gether ist eine kostenlose Webseite, auf der man YouTube-Links in einen gemeinsamen Raum einfügt. AniDachi ist eine Chrome-Erweiterung, die das Video bei jedem auf youtube.com synchronisiert und zusätzlich Netflix und Crunchyroll kann.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "step-by-step", label: "YouTube zusammen schauen", level: 2 },
  { id: "what-works", label: "Was funktioniert", level: 2 },
  { id: "ideas", label: "Ideen für den Abend", level: 2 },
  { id: "vs-watch2gether", label: "AniDachi vs. Watch2Gether", level: 2 },
  { id: "faq", label: "Häufige Fragen", level: 2 },
];

export default function GermanYouTubeWatchPartyPage() {
  return (
    <>
      <HowToJsonLd
        name="So startest du eine YouTube Watchparty"
        description="YouTube-Videos in Chrome synchron mit Freunden schauen, jeder im eigenen YouTube-Player."
        steps={howToSteps}
      />
      <HubLandingLayout
        locale="de"
        breadcrumbs={[
          { name: "Startseite", url: "/de" },
          { name: "YouTube Watchparty", url: PAGE_PATH },
        ]}
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        url={PAGE_PATH}
        datePublished="2026-11-12"
        dateModified="2026-11-12"
        faq={faq}
        headings={tocHeadings}
        articleImage={`${getSeoSiteOrigin()}/opengraph-image.png`}
        h1="YouTube Watchparty: YouTube zusammen schauen"
        heroLead="Videos gemeinsam schauen und darüber reden, als würdet ihr nebeneinander sitzen."
        heroCtaLabel={CTA_LABEL}
        heroWorksOn={["YouTube", "Netflix", "Crunchyroll"]}
        heroFinePrint={DE_HERO_FINE_PRINT}
        answer={
          <>
            <strong>
              Mit AniDachi schaut ihr YouTube-Videos zusammen und synchron in Chrome: Jeder sieht das
              Video im eigenen YouTube-Player, und AniDachi hält Abspielen, Pause und Spulen gleich.
            </strong>{" "}
            Im Raum gibt es Chat, Reaktionen sowie Sprach- und Videoanruf. Freunde treten kostenlos
            bei.
          </>
        }
        steps={{
          id: "step-by-step",
          heading: "So schaut ihr YouTube zusammen",
          intro:
            "Jeder öffnet das Video auf youtube.com im eigenen Tab, und AniDachi hält alle auf derselben Stelle.",
          items: howToSteps,
        }}
      >
        <h2 id="what-works" className="scroll-mt-24">
          Was bei YouTube funktioniert
        </h2>
        <ResponsiveCompareTable
locale="de"
          columns={[{ id: "status", label: "AniDachi auf YouTube", highlight: true }]}
          rows={[
            { feature: "Normale Videos (youtube.com/watch)", values: { status: "yes" } },
            { feature: "Synchrones Abspielen, Pause und Spulen", values: { status: "yes" } },
            { feature: "Chat, Reaktionen, Sprach- und Videoanruf", values: { status: "yes" } },
            { feature: "Shorts", values: { status: "no" } },
            { feature: "Eingebettete Videos auf anderen Seiten", values: { status: "no" } },
            { feature: "Handy und Tablet", values: { status: "no" } },
          ]}
        />
        <p className="mb-6 leading-relaxed text-ani-muted">
          In einen Raum passen {DE_ROOM_SIZES}. Der Gastgeber steuert die Wiedergabe für alle.
        </p>
        <h2 id="ideas" className="scroll-mt-24">
          Ideen für eure YouTube Watchparty
        </h2>
        <HubFeatureGrid
          items={[
            {
              title: "Fernbeziehung",
              body: "Zusammen ein Video oder eine Doku schauen und euch dabei sehen und hören, mit dem Videoanruf im Raum.",
            },
            {
              title: "Freundesabend",
              body: "Musikvideos, Reaktionsvideos oder alte Lieblingsclips der Reihe nach schauen und im Chat kommentieren.",
            },
            {
              title: "Lernen und Arbeiten",
              body: "Vorträge, Tutorials oder Präsentationen gemeinsam durchgehen und an wichtigen Stellen pausieren.",
            },
            {
              title: "Anime und Filme",
              body: (
                <>
                  Wenn ihr danach weiterschauen wollt: Dieselbe Erweiterung kann{" "}
                  <Link href="/de/netflix-watchparty">Netflix</Link> und{" "}
                  <Link href="/de/crunchyroll-watchparty">Crunchyroll</Link>.
                </>
              ),
            },
          ]}
        />

        <h2 id="vs-watch2gether" className="scroll-mt-24">
          AniDachi oder Watch2Gether für YouTube?
        </h2>
        <p className="mb-6 leading-relaxed text-ani-muted">
          Watch2Gether ist kostenlos und braucht für YouTube keine Installation: Man fügt einen Link
          in einen Raum ein, und alle sehen ihn im Watch2Gether-Player. Das ist praktisch für eine
          schnelle Runde. AniDachi läuft dagegen direkt auf youtube.com, hat Sprach- und Videoanruf
          im Raum und funktioniert auch mit Netflix und Crunchyroll, wo Watch2Gether nur über eine
          Zusatzerweiterung weiterhilft. Den vollständigen Vergleich findest du unter{" "}
          <Link href="/de/watch2gether-alternative">Watch2Gether Alternative</Link>.
        </p>

        <HubCtaBand
          pagePath={PAGE_PATH}
          href={DE_INSTALL_HUB_PATH}
          ctaLabel={CTA_LABEL}
          heading="Starte deine YouTube Watchparty"
          body="AniDachi installieren, Video öffnen, Link schicken. 20 Minuten am Tag kostenlos, Freunde treten kostenlos bei."
        />

        <h2 id="more" className="scroll-mt-24">
          Mehr Watchpartys
        </h2>
        <SeoGuideRelated links={[
            { href: "/de", label: "Watchparty: Netflix, YouTube und Crunchyroll" },
            { href: "/de/netflix-watchparty", label: "Netflix Watchparty" },
            { href: "/de/crunchyroll-watchparty", label: "Crunchyroll Watchparty" },
            { href: "/de/watch2gether-alternative", label: "Watch2Gether Alternative" },
          ]} />
      </HubLandingLayout>
    </>
  );
}
