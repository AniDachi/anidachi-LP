import type { Metadata } from "next";
import Link from "next/link";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { languageAlternates } from "@/lib/hreflang";
import { DE_FREE_ROOM, DE_OG_LOCALE, DE_PLUS_ROOM, DE_PRICING_FREE20_SUMMARY, DE_PRO_ROOM } from "@/lib/locale/de-copy";
import { getSeoSiteOrigin } from "@/lib/site-url";

const PAGE_PATH = "/de/watch2gether-alternative";
const PAGE_TITLE = "Watch2Gether Alternative für Netflix";
const PAGE_DESCRIPTION =
  "Watch2Gether ist super für YouTube, aber Netflix klappt nur über eine Zusatzerweiterung. Die Alternative für Netflix, Crunchyroll und YouTube im Vergleich.";
const h2Class = "text-2xl font-bold text-foreground mt-10 mb-4 scroll-mt-24";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: languageAlternates({ en: "/compare/anidachi-vs-watch2gether", de: PAGE_PATH }, "de"),
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

/** Watch2Gether facts on this page, checked on these pages on 12 Nov 2026. */
const SOURCES = [
  { href: "https://w2g.tv/de/", label: "Watch2Gether Startseite" },
  { href: "https://community.w2g.tv/t/how-to-use-w2gsync/8975", label: "Watch2Gether: How to use W2gSync" },
  {
    href: "https://community.w2g.tv/t/faq-what-are-the-limitations-of-watch2gether/148839",
    label: "Watch2Gether: FAQ zu Einschränkungen",
  },
  { href: "https://w2g.tv/en/upgrade/", label: "Watch2Gether: PLUS und PRO" },
];

const faq = [
  {
    question: "Kann man mit Watch2Gether Netflix schauen?",
    answer:
      "Nur über W2gSync. Laut Watch2Gether lassen sich Netflix, Amazon Prime und Disney+ nicht direkt einbetten. Mit W2gSync braucht jeder die Watch2Gether-Browsererweiterung und ein eigenes Login, und das Video öffnet sich bei jedem in einem eigenen Fenster. Watch2Gether schreibt selbst, dass manche Seiten damit nicht richtig funktionieren.",
  },
  {
    question: "Funktioniert Watch2Gether für YouTube?",
    answer:
      "Ja. Watch2Gether ist eines der beliebtesten kostenlosen Tools, um YouTube live zusammen zu schauen: Raum erstellen, Link einfügen, Raum teilen.",
  },
  {
    question: "Funktioniert Watch2Gether mit Crunchyroll?",
    answer:
      "Watch2Gether nennt Crunchyroll auf seinen Seiten nicht. Lizenzierte Folgen müssen bei jedem im eigenen Crunchyroll-Konto laufen. AniDachi unterstützt Crunchyroll direkt.",
  },
  {
    question: "Ist Watch2Gether kostenlos?",
    answer:
      "Ja, Räume lassen sich ohne Konto erstellen. Die Bezahlstufen PLUS und PRO entfernen vor allem Werbebanner und bringen Extras für Chat und Moderation.",
  },
  {
    question: "Ersetzen Watch2Gether oder AniDachi ein Netflix- oder Crunchyroll-Abo?",
    answer:
      "Nein. Jeder braucht eigenen Zugriff auf den Dienst. AniDachi legt Raum und Synchronisation über den Stream jeder Person, statt Videos neu zu übertragen.",
  },
  {
    question: "Ist AniDachi kostenlos?",
    answer: `Freunde treten kostenlos bei. ${DE_PRICING_FREE20_SUMMARY}`,
  },
];

const headings: TocHeading[] = [
  { id: "answer", label: "Kurz gesagt", level: 2 },
  { id: "tldr", label: "Auf einen Blick", level: 2 },
  { id: "netflix", label: "Watch2Gether und Netflix", level: 2 },
  { id: "feature-comparison", label: "Funktionsvergleich", level: 2 },
  { id: "when-watch2gether", label: "Wann Watch2Gether reicht", level: 2 },
  { id: "when-anidachi", label: "Wann AniDachi besser ist", level: 2 },
  { id: "related", label: "Mehr dazu", level: 2 },
  { id: "faq", label: "Häufige Fragen", level: 2 },
];

export default function GermanWatch2GetherAlternativePage() {
  return (
    <SeoPageLayout
      locale="de"
      breadcrumbs={[
        { name: "Startseite", url: "/de" },
        { name: "Watch2Gether Alternative", url: PAGE_PATH },
      ]}
      title="Watch2Gether Alternative"
      description="Netflix, Crunchyroll und YouTube zusammen schauen: AniDachi und Watch2Gether im Vergleich."
      url={PAGE_PATH}
      datePublished="2026-11-12"
      dateModified="2026-11-12"
      faq={faq}
      headings={headings}
      articleImage={`${getSeoSiteOrigin()}/opengraph-image.png`}
      ctaCopy="compare"
      aboveFoldCta
    >
      <h1 className="text-4xl font-bold text-foreground mb-6">
        Watch2Gether Alternative für Netflix und Crunchyroll
      </h1>

      <h2 id="answer" className="text-2xl font-bold text-foreground mt-8 mb-4 scroll-mt-24">
        Kurz gesagt
      </h2>
      <p className="text-xl text-foreground/80 leading-relaxed mb-6">
        <strong>
          Nimm AniDachi für Netflix, Crunchyroll und YouTube mit Chat, Reaktionen sowie Sprach- und
          Videoanruf, direkt im Player des Dienstes. Nimm Watch2Gether für einen kostenlosen
          YouTube-Raum ohne Installation, wenn alle gleichzeitig schauen.
        </strong>
      </p>

      <h2 id="tldr" className="text-2xl font-bold text-foreground mt-10 mb-3 scroll-mt-24">
        Auf einen Blick
      </h2>
      <p className="text-foreground/80 mb-8">
        <strong>Watch2Gether:</strong> schnelle Räume im Browser, ideal für YouTube mit Freunden;
        Netflix nur über die Zusatzerweiterung W2gSync. <strong>AniDachi:</strong> Chrome-Erweiterung
        mit Räumen direkt auf Netflix, Crunchyroll und YouTube, mit Synchronisation, Chat, Reaktionen
        sowie Sprach- und Videoanruf.
      </p>

      <h2 id="netflix" className={h2Class}>
        Watch2Gether und Netflix: wie es funktioniert
      </h2>
      <p className="text-foreground/80 mb-4">
        Watch2Gether wirbt auf seiner Startseite damit, dass auch Netflix, Amazon und Disney+
        unterstützt werden. In der Hilfe steht genauer, wie: Diese Dienste lassen sich nicht in den
        Watch2Gether-Player einbetten, deshalb läuft es über W2gSync. Laut Watch2Gether gilt dabei:
      </p>
      <ul className="list-disc pl-6 text-foreground/80 space-y-2 mb-8">
        <li>Jeder im Raum braucht die Watch2Gether-Browsererweiterung.</li>
        <li>Wenn die Seite ein Login verlangt, braucht jeder im Raum sein eigenes.</li>
        <li>Jeder klickt auf „Open“, und das Video öffnet sich in einem separaten Fenster mit einer Steuerleiste.</li>
        <li>Manche Seiten funktionieren mit W2gSync nicht richtig, schreibt Watch2Gether selbst.</li>
      </ul>
      <p className="text-foreground/80 mb-8">
        Bei AniDachi entfällt der Umweg: Die Erweiterung arbeitet direkt im Netflix-Player, den ihr
        ohnehin öffnet. Wie das aussieht, zeigt die{" "}
        <Link href="/de/netflix-watchparty" className="text-brand-orange hover:underline">
          Netflix Watchparty
        </Link>
        .
      </p>

      <h2 id="feature-comparison" className={h2Class}>
        Funktionsvergleich
      </h2>
      <ResponsiveCompareTable
locale="de"
        columns={[
          { id: "anidachi", label: "AniDachi", highlight: true },
          { id: "w2g", label: "Watch2Gether" },
        ]}
        rows={[
          { feature: "YouTube", values: { anidachi: "yes", w2g: "yes" } },
          { feature: "Netflix", values: { anidachi: "Direkt im Netflix-Player", w2g: "Über W2gSync, eigenes Fenster" } },
          { feature: "Crunchyroll", values: { anidachi: "yes", w2g: "Nicht angegeben" } },
          { feature: "Installation", values: { anidachi: "Chrome-Erweiterung", w2g: "Für YouTube keine, für Netflix Erweiterung" } },
          { feature: "Sprach- und Videoanruf", values: { anidachi: "yes", w2g: "Webcam und Ton, bis zu 10 gleichzeitig" } },
          {
            feature: "Personen pro Raum",
            values: { anidachi: `Bis zu ${DE_FREE_ROOM} (Free), ${DE_PLUS_ROOM} (Plus), ${DE_PRO_ROOM} (Pro)`, w2g: "Große Räume möglich" },
          },
          { feature: "Handy", values: { anidachi: "no", w2g: "Webseite ja, Erweiterung nein" } },
          { feature: "Zeitversetzt nachholen", values: { anidachi: "Bald verfügbar", w2g: "no" } },
          {
            feature: "Kostenlose Stufe",
            values: { anidachi: "20 Minuten am Tag, bis zu 4 Personen; Freunde treten kostenlos bei", w2g: "Ja (Räume); PLUS und PRO ohne Werbebanner" },
          },
        ]}
      />
      <p className="text-sm text-foreground/70 mb-8">
        Angaben zu Watch2Gether laut dessen Webseite und Hilfeseiten, geprüft am 12. November 2026.
      </p>

      <h2 id="when-watch2gether" className={h2Class}>
        Wann Watch2Gether reicht
      </h2>
      <ul className="list-disc pl-6 text-foreground/80 space-y-2 mb-8">
        <li>Ihr wollt schnell zusammen YouTube schauen, ohne etwas zu installieren.</li>
        <li>Eure Gruppe ist sehr groß, oder jemand schaut am Handy mit.</li>
        <li>Ihr braucht kein Netflix oder Crunchyroll.</li>
      </ul>

      <h2 id="when-anidachi" className={h2Class}>
        Wann AniDachi besser ist
      </h2>
      <ul className="list-disc pl-6 text-foreground/80 space-y-2 mb-8">
        <li>Ihr macht regelmäßig Filmabende auf Netflix oder schaut Anime auf Crunchyroll.</li>
        <li>Ihr wollt euch beim Schauen hören oder sehen, ohne zusätzliches Tool.</li>
        <li>Ihr wollt eine Erweiterung für Netflix, Crunchyroll und YouTube.</li>
      </ul>

      <h2 id="related" className={h2Class}>
        Mehr dazu
      </h2>
      <ul className="space-y-2 text-brand-orange mb-8">
        <li>
          <Link href="/de/netflix-watchparty" className="hover:underline">
            Netflix Watchparty
          </Link>
        </li>
        <li>
          <Link href="/de/youtube-watchparty" className="hover:underline">
            YouTube Watchparty
          </Link>
        </li>
        <li>
          <Link href="/de/crunchyroll-watchparty" className="hover:underline">
            Crunchyroll Watchparty
          </Link>
        </li>
        <li>
          <Link href="/de/netflix-auf-discord-streamen" className="hover:underline">
            Netflix auf Discord streamen
          </Link>
        </li>
        <li>
          <Link href="/de" className="hover:underline">
            Watchparty: Netflix, YouTube und Crunchyroll
          </Link>
        </li>
        <li>
          <Link href="/de/preise" className="hover:underline">
            Preise: Free, Plus und Pro
          </Link>
        </li>
      </ul>
      <p className="text-sm text-foreground/70 mb-8">
        Quellen, geprüft am 12. November 2026:{" "}
        {SOURCES.map((source, index) => (
          <span key={source.href}>
            {index > 0 ? ", " : null}
            <a href={source.href} target="_blank" rel="noopener noreferrer" className="text-brand-orange hover:underline">
              {source.label}
            </a>
          </span>
        ))}
        . AniDachi ist nicht mit Watch2Gether verbunden.
      </p>
    </SeoPageLayout>
  );
}
