import type { Metadata } from "next";
import Link from "next/link";
import { HubCtaBand } from "@/components/hub-cta-band";
import { DE_HUB_INSTALL_STEP, HubFeatureGrid, HubLandingLayout } from "@/components/hub-landing-layout";
import { HowToJsonLd } from "@/components/json-ld";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import { SeoGuideBulletList, SeoGuideRelated } from "@/components/seo-guide-blocks";
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

const PAGE_PATH = "/de/crunchyroll-watchparty";
const PAGE_TITLE = "Crunchyroll Watchparty: Anime zusammen schauen";
const PAGE_DESCRIPTION =
  "Crunchyroll hat keine Watchparty. Mit AniDachi schaut ihr Anime auf Crunchyroll zusammen und synchron in Chrome, jeder im eigenen Konto, mit Chat und Sprache.";
const CTA_LABEL = "Crunchyroll Watchparty starten";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: languageAlternates({ en: "/watch-crunchyroll-together", de: PAGE_PATH }, "de"),
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
    name: "Folge auf Crunchyroll öffnen",
    text: "Melde dich mit deinem eigenen Crunchyroll-Konto an und starte die Folge.",
  },
  {
    name: "Raum erstellen",
    text: "Klicke oben rechts im Player auf die AniDachi-Kapsel und wähle „Create room“.",
  },
  {
    name: "Link teilen",
    text: "Schick den Einladungslink an deine Freunde oder in euren Discord-Server. Sie öffnen dieselbe Folge im eigenen Konto und schauen synchron mit dir.",
  },
];

const faq = [
  {
    question: "Hat Crunchyroll eine Watchparty-Funktion?",
    answer:
      "Nein. Stand 2026 hat Crunchyroll keine eingebaute Watchparty und kein Gruppenschauen. Um zusammen zu schauen, nutzt jeder eine Chrome-Erweiterung wie AniDachi, Crunchyroll Party oder Teleparty im eigenen Crunchyroll-Konto.",
  },
  {
    question: "Wie schaut man Crunchyroll mit Freunden zusammen?",
    answer:
      "Installiere AniDachi aus dem Chrome Web Store und öffne eine Folge in Chrome auf dem Computer. Erstelle einen Raum und teile den Link. Deine Freunde öffnen dieselbe Folge im eigenen Konto, und alles läuft synchron mit Chat.",
  },
  {
    question: "Brauchen alle Freunde ein Crunchyroll-Konto?",
    answer:
      "Ja. Jeder streamt über das eigene Crunchyroll-Konto. Laut der Abo-Seite von Crunchyroll (geprüft am 20. Oktober 2026) gibt es nur noch kostenpflichtige Abos, mit einer kostenlosen Testphase für neue Abonnenten. AniDachi fügt Synchronisation, Raum und Chat hinzu.",
  },
  {
    question: "Können zwei Personen mit einem Konto gleichzeitig schauen?",
    answer:
      "Nicht zuverlässig. Crunchyroll begrenzt die gleichzeitigen Streams je Abo, und laut den Nutzungsbedingungen ist ein Konto für einen Haushalt gedacht. Für eine Watchparty öffnet jeder die Folge im eigenen Konto.",
  },
  {
    question: "Ist die Crunchyroll Watchparty kostenlos?",
    answer: `Bei AniDachi ja, zum Ausprobieren. ${DE_PRICING_FREE20_SUMMARY} Freunde treten kostenlos bei. Ein eigenes Crunchyroll-Abo braucht trotzdem jeder.`,
  },
  {
    question: "Kann man Crunchyroll auf Discord streamen?",
    answer:
      "Beim Bildschirmteilen sehen Freunde oft nur ein schwarzes Bild, weil Crunchyroll sein Video schützt. Nutzt Discord für die Stimmen und AniDachi für das Video, dann schaut jeder in voller Qualität.",
  },
  {
    question: "Funktioniert Teleparty mit Crunchyroll?",
    answer:
      "Teleparty nennt Crunchyroll als unterstützten Dienst, aber nach Player-Updates kann die Synchronisation schwanken. AniDachi ist für Anime-Gruppen auf Crunchyroll gebaut und funktioniert zusätzlich mit YouTube und Netflix.",
  },
  {
    question: "Geht eine Crunchyroll Watchparty am Handy?",
    answer: `Mit AniDachi nicht. ${DE_DESKTOP_ONLY}`,
  },
];

const tocHeadings: TocHeading[] = [
  { id: "step-by-step", label: "Crunchyroll zusammen schauen", level: 2 },
  { id: "what-works", label: "Was funktioniert", level: 2 },
  { id: "discord", label: "Crunchyroll auf Discord", level: 2 },
  { id: "weekly", label: "Jede Woche die neue Folge", level: 2 },
  { id: "faq", label: "Häufige Fragen", level: 2 },
];

export default function GermanCrunchyrollWatchPartyPage() {
  return (
    <>
      <HowToJsonLd
        name="So startest du eine Crunchyroll Watchparty"
        description="Anime auf Crunchyroll in Chrome synchron mit Freunden schauen, jeder im eigenen Crunchyroll-Konto."
        steps={howToSteps}
      />
      <HubLandingLayout
        locale="de"
        breadcrumbs={[
          { name: "Startseite", url: "/de" },
          { name: "Crunchyroll Watchparty", url: PAGE_PATH },
        ]}
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        url={PAGE_PATH}
        datePublished="2026-11-12"
        dateModified="2026-11-12"
        faq={faq}
        headings={tocHeadings}
        articleImage={`${getSeoSiteOrigin()}/opengraph-image.png`}
        h1="Crunchyroll Watchparty: Anime zusammen schauen"
        heroLead="Die neue Folge zusammen schauen, auch wenn ihr in verschiedenen Städten wohnt."
        heroCtaLabel={CTA_LABEL}
        heroWorksOn={["Crunchyroll", "Netflix", "YouTube"]}
        heroFinePrint={DE_HERO_FINE_PRINT}
        answer={
          <>
            <strong>
              Crunchyroll hat keine eingebaute Watchparty. Mit AniDachi schaut ihr Anime auf
              Crunchyroll synchron in Chrome: Jeder streamt im eigenen Konto, und AniDachi hält
              Abspielen, Pause und Spulen bei allen gleich.
            </strong>{" "}
            Im Raum gibt es Chat, Reaktionen sowie Sprach- und Videoanruf. Freunde treten kostenlos
            bei.
          </>
        }
        steps={{
          id: "step-by-step",
          heading: "So schaut ihr Crunchyroll zusammen",
          intro:
            "Jeder öffnet die Folge im eigenen Chrome-Tab und im eigenen Crunchyroll-Konto, und AniDachi hält alle auf derselben Stelle.",
          items: howToSteps,
        }}
      >
        <h2 id="what-works" className="scroll-mt-24">
          Was bei Crunchyroll funktioniert
        </h2>
        <ResponsiveCompareTable
locale="de"
          columns={[{ id: "status", label: "AniDachi auf Crunchyroll", highlight: true }]}
          rows={[
            { feature: "Folgen im eigenen Crunchyroll-Konto", values: { status: "yes" } },
            { feature: "Synchrones Abspielen, Pause und Spulen", values: { status: "yes" } },
            { feature: "Chat, Reaktionen, Sprach- und Videoanruf", values: { status: "yes" } },
            { feature: "Chrome auf dem Computer", values: { status: "yes" } },
            { feature: "Handy, Tablet, Smart-TV", values: { status: "no" } },
          ]}
        />
        <HubFeatureGrid
          items={[
            {
              title: "Raumgröße",
              body: `In einen Raum passen ${DE_ROOM_SIZES}.`,
            },
            {
              title: "Untertitel oder Synchro",
              body: "Einigt euch vor dem Start auf eine Version. Alle sollten dieselbe Folge in derselben Sprachfassung öffnen, damit die Zeiten übereinstimmen.",
            },
          ]}
        />
        <h2 id="discord" className="scroll-mt-24">
          Crunchyroll auf Discord streamen
        </h2>
        <p className="mb-6 leading-relaxed text-ani-muted">
          Viele Anime-Gruppen treffen sich auf Discord und versuchen, Crunchyroll per Go Live zu
          teilen. Weil Crunchyroll sein Video schützt, sehen die anderen oft nur ein schwarzes Bild,
          und wenn es klappt, ist das Bild komprimiert. Besser: Bleibt im Discord-Sprachkanal, und
          jeder schaut die Folge im eigenen Konto, synchronisiert mit AniDachi. Wie das bei Netflix
          aussieht, steht unter{" "}
          <Link href="/de/netflix-auf-discord-streamen">Netflix auf Discord streamen</Link>; bei Crunchyroll
          funktioniert es genauso.
        </p>
        <SeoGuideBulletList
          items={[
            {
              title: "Link im Server posten",
              body: "Der Gastgeber postet den Einladungslink im Textkanal, und wer mitschauen will, tritt bei.",
            },
            {
              title: "Stimmen über Discord",
              body: "Ihr bleibt im gewohnten Sprachkanal. AniDachi kümmert sich nur um das Video.",
            },
            {
              title: "Volle Qualität",
              body: "Jeder sieht die Folge direkt von Crunchyroll, ohne verwaschenes Bild.",
            },
          ]}
        />

        <h2 id="weekly" className="scroll-mt-24">
          Jede Woche die neue Folge zusammen schauen
        </h2>
        <p className="mb-6 leading-relaxed text-ani-muted">
          Gruppen, die eine Season verfolgen, treffen sich am besten zu einer festen Zeit, ein paar
          Stunden nach Erscheinen der Folge. Wann welche Simulcast-Folge in deutscher Zeit kommt,
          zeigt der <Link href="/de/tools/crunchyroll-kalender">Crunchyroll Kalender</Link>.
        </p>

        <HubCtaBand
          pagePath={PAGE_PATH}
          href={DE_INSTALL_HUB_PATH}
          ctaLabel={CTA_LABEL}
          heading="Starte deine Crunchyroll Watchparty"
          body="AniDachi installieren, Folge öffnen, Link schicken. 20 Minuten am Tag kostenlos, Freunde treten kostenlos bei."
        />

        <h2 id="more" className="scroll-mt-24">
          Mehr Watchpartys
        </h2>
        <SeoGuideRelated links={[
            { href: "/de", label: "Watchparty: Netflix, YouTube und Crunchyroll" },
            { href: "/de/tools/crunchyroll-kalender", label: "Crunchyroll Kalender" },
            { href: "/de/netflix-watchparty", label: "Netflix Watchparty" },
            { href: "/de/youtube-watchparty", label: "YouTube Watchparty" },
          ]} />
      </HubLandingLayout>
    </>
  );
}
