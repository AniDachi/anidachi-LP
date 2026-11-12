import type { Metadata } from "next";
import Link from "next/link";
import { HubCtaBand } from "@/components/hub-cta-band";
import { DE_HUB_INSTALL_STEP, HubFeatureGrid, HubLandingLayout } from "@/components/hub-landing-layout";
import { HowToJsonLd } from "@/components/json-ld";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import { SeoGuideBulletList, SeoGuideNote, SeoGuideRelated } from "@/components/seo-guide-blocks";
import type { TocHeading } from "@/components/table-of-contents";
import { languageAlternates } from "@/lib/hreflang";
import { DE_INSTALL_HUB_PATH } from "@/lib/install-cta";
import {
  DE_DESKTOP_ONLY,
  DE_FREE_ROOM,
  DE_HERO_FINE_PRINT,
  DE_OG_LOCALE,
  DE_PLUS_ROOM,
  DE_PRICING_FREE20_SUMMARY,
  DE_PRO_ROOM,
} from "@/lib/locale/de-copy";
import { getSeoSiteOrigin } from "@/lib/site-url";

const PAGE_PATH = "/de/netflix-watchparty";
const PAGE_TITLE = "Netflix Watchparty: Netflix zusammen schauen";
const PAGE_DESCRIPTION =
  "Netflix hat keine Watchparty-Funktion. Mit AniDachi schaut ihr Netflix zusammen und synchron in Chrome, jeder mit eigenem Konto, mit Chat, Sprache und Video.";
const CTA_LABEL = "Netflix Watchparty starten";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: languageAlternates({ en: "/netflix-watch-party", de: PAGE_PATH }, "de"),
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

/** Netflix and Teleparty facts on this page, checked against these sources on 20 Oct 2026. */
const SOURCES = [
  { href: "https://www.teleparty.com/support", label: "Teleparty Support-FAQ" },
  { href: "https://help.netflix.com/de/node/123277", label: "Netflix-Hilfe: Konto teilen" },
  { href: "https://help.netflix.com/de/node/24853", label: "Netflix-Hilfe: Netflix in einem anderen Land" },
];

const howToSteps = [
  DE_HUB_INSTALL_STEP,
  {
    name: "Netflix-Titel öffnen",
    text: "Melde dich mit deinem eigenen Netflix-Konto an und starte den Film oder die Folge. In der Adresszeile steht dann netflix.com/watch/ und eine Nummer; die Startseite und die Infoseite sind nicht der Player.",
  },
  {
    name: "Raum erstellen",
    text: "Klicke oben rechts im Player auf die AniDachi-Kapsel und wähle „Create room“.",
  },
  {
    name: "Einladungslink teilen",
    text: "Kopiere den Link in euren Gruppenchat. Deine Freunde treten kostenlos bei und spielen denselben Titel in ihrem eigenen Netflix-Konto ab, synchron mit dir.",
  },
];

const faq = [
  {
    question: "Hat Netflix eine Watchparty-Funktion?",
    answer:
      "Nein. Als wir am 20. Oktober 2026 im Netflix-Hilfecenter nachgesehen haben, gab es dort keine Watchparty, kein Gruppenschauen und kein synchrones Abspielen. Um Netflix zusammen zu schauen, brauchst du ein Zusatztool wie AniDachi oder Teleparty.",
  },
  {
    question: "Wie kann man Netflix zusammen schauen, obwohl man nicht am selben Ort ist?",
    answer:
      "Installiere AniDachi in Chrome auf dem Computer, öffne den Film in deinem Netflix-Konto, erstelle über die AniDachi-Kapsel einen Raum und schick den Link. Deine Freunde öffnen denselben Titel in ihrem Konto, und alle schauen synchron.",
  },
  {
    question: "Braucht jeder ein eigenes Netflix-Konto?",
    answer:
      "Ja. Jeder spielt den Titel über ein Netflix-Konto ab, das er nutzen darf. AniDachi und Teleparty synchronisieren getrennte Player, sie übertragen kein Netflix-Bild an andere. Laut Netflix darf ein Konto nicht außerhalb des eigenen Haushalts geteilt werden.",
  },
  {
    question: "Ist eine Netflix Watchparty kostenlos?",
    answer: `Einem AniDachi-Raum beizutreten ist kostenlos. ${DE_PRICING_FREE20_SUMMARY} Netflix bezahlt jeder wie gewohnt selbst.`,
  },
  {
    question: "Wie viele Personen können bei einer Netflix Watchparty mitmachen?",
    answer: `Bis zu ${DE_FREE_ROOM} Personen inklusive Gastgeber mit Free, ${DE_PLUS_ROOM} mit Plus und ${DE_PRO_ROOM} mit Pro. Freunde treten kostenlos bei. Bis zu vier Kameras können gleichzeitig an sein.`,
  },
  {
    question: "Kann man Netflix auf dem Handy zusammen schauen?",
    answer: `Mit AniDachi nicht. ${DE_DESKTOP_ONLY} Teleparty nennt auf seiner Support-Seite Apps für Android und iOS, falls eure Gruppe Handys braucht.`,
  },
  {
    question: "Warum ist Netflix schwarz, wenn ich meinen Bildschirm teile?",
    answer:
      "Netflix schützt sein Video vor Aufnahmen. Beim Bildschirmteilen in Discord, Zoom oder ähnlichen Apps sehen die anderen deshalb oft nur ein schwarzes Bild. Wenn jeder Netflix selbst abspielt und nur die Wiedergabe synchronisiert wird, tritt das Problem nicht auf.",
  },
  {
    question: "Können meine Freunde den Film pausieren?",
    answer:
      "Bei AniDachi steuert der Gastgeber Abspielen, Pause und Spulen für den ganzen Raum. Die anderen sagen im Chat oder per Sprache Bescheid, und der Gastgeber pausiert für alle.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "how-it-works", label: "Netflix zusammen schauen", level: 2 },
  { id: "what-works", label: "Was geht, was nicht", level: 2 },
  { id: "account", label: "Braucht jeder Netflix?", level: 2 },
  { id: "not-working", label: "Wenn es nicht klappt", level: 2 },
  { id: "vs-teleparty", label: "AniDachi vs. Teleparty", level: 2 },
  { id: "faq", label: "Häufige Fragen", level: 2 },
];

export default function GermanNetflixWatchPartyPage() {
  return (
    <>
      <HowToJsonLd
        name="So startest du eine Netflix Watchparty"
        description="Netflix in Chrome synchron mit Freunden schauen, jeder mit eigenem Netflix-Konto."
        steps={howToSteps}
      />
      <HubLandingLayout
        locale="de"
        breadcrumbs={[
          { name: "Startseite", url: "/de" },
          { name: "Netflix Watchparty", url: PAGE_PATH },
        ]}
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        url={PAGE_PATH}
        datePublished="2026-11-12"
        dateModified="2026-11-12"
        faq={faq}
        headings={tocHeadings}
        articleImage={`${getSeoSiteOrigin()}/opengraph-image.png`}
        itemList={[
          { name: "Netflix auf Discord streamen", url: "/de/netflix-auf-discord-streamen", position: 1 },
          { name: "Watch2Gether Alternative", url: "/de/watch2gether-alternative", position: 2 },
          { name: "YouTube Watchparty", url: "/de/youtube-watchparty", position: 3 },
        ]}
        h1="Netflix Watchparty: Netflix zusammen schauen"
        heroLead="Netflix hat keinen Watchparty-Knopf. AniDachi bringt ihn mit."
        heroCtaLabel={CTA_LABEL}
        heroWorksOn={["Netflix", "YouTube", "Crunchyroll"]}
        heroFinePrint={DE_HERO_FINE_PRINT}
        answer={
          <>
            <strong>
              Netflix hat keine eingebaute Watchparty. AniDachi synchronisiert einen Netflix-Film
              oder eine Folge in Chrome auf dem Computer: Jeder schaut im eigenen Netflix-Konto,
              und Freunde treten kostenlos bei.
            </strong>{" "}
            Im Raum gibt es Chat, Reaktionen, Sprach- und Videoanruf, mit Push-to-Talk auf der
            Taste V.
          </>
        }
        steps={{
          id: "how-it-works",
          heading: "So schaut ihr Netflix zusammen",
          intro:
            "Jeder öffnet Netflix im eigenen Chrome-Tab und im eigenen Konto, und AniDachi hält alle Player auf derselben Stelle. Niemand schaut eine verwaschene Kopie von einem fremden Bildschirm.",
          items: howToSteps,
        }}
      >
        <h2 id="what-works" className="scroll-mt-24">
          Was heute geht, und was nicht
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Netflix wird von AniDachi seit Oktober 2026 unterstützt. So sieht es im Moment aus:
        </p>
        <ResponsiveCompareTable
locale="de"
          columns={[{ id: "status", label: "AniDachi auf Netflix", highlight: true }]}
          rows={[
            { feature: "Netflix-Filme und -Serien", values: { status: "yes" } },
            { feature: "Chrome auf dem Computer", values: { status: "yes" } },
            { feature: "Synchrones Abspielen, Pause und Spulen", values: { status: "yes" } },
            { feature: "Chat und Emoji-Reaktionen im Player", values: { status: "yes" } },
            { feature: "Sprach- und Videoanruf, Push-to-Talk", values: { status: "yes" } },
            { feature: "Handy, Tablet, Smart-TV, Konsole", values: { status: "no" } },
            { feature: "Andere Browser", values: { status: "Nicht unterstützt" } },
            { feature: "Trailer und Rückblicke", values: { status: "Nicht synchron" } },
            { feature: "Netflix-Abo mit Werbung", values: { status: "Noch nicht bestätigt" } },
          ]}
        />
        <HubFeatureGrid
          items={[
            {
              title: "Raumgröße",
              body: `Mit Free passen bis zu ${DE_FREE_ROOM} Personen in einen Raum, inklusive Gastgeber. Mit Plus sind es ${DE_PLUS_ROOM}, mit Pro ${DE_PRO_ROOM}.`,
            },
            {
              title: "Sprache und Video",
              body: "Der Gastgeber vergibt Mikrofon- und Kameraplätze. Bis zu vier Kameras können gleichzeitig an sein. Halte V zum Sprechen gedrückt oder lass das Mikrofon offen.",
            },
            {
              title: "Wiedergabe",
              body: "Der Gastgeber steuert Abspielen, Pause und Spulen für alle. Die anderen können chatten, reagieren und reden, sobald sie ein Mikrofon haben.",
            },
            {
              title: "Dein eigenes Netflix",
              body: "Jeder braucht Zugriff auf denselben Titel in seinem Land. AniDachi teilt weder Netflix-Logins noch das Videobild.",
            },
          ]}
        />
        <SeoGuideNote>
          <strong>Hinweis:</strong> Ob AniDachi mit dem Netflix-Abo mit
          Werbung funktioniert, haben wir noch nicht bestätigt. Wenn jemand in eurer Gruppe dieses
          Abo hat, macht vor dem Filmabend einen kurzen Testraum.
        </SeoGuideNote>

        <h2 id="account" className="scroll-mt-24">
          Braucht jeder ein eigenes Netflix?
        </h2>
        <p className="mb-6 leading-relaxed text-ani-muted">
          Ja. Jedes Tool, das Netflix synchronisiert, funktioniert so: Der Browser jeder Person
          spielt den Titel direkt von Netflix ab. Das gilt für AniDachi genauso wie für Teleparty.
          Laut Netflix-Hilfecenter darf ein Konto nicht außerhalb des eigenen Haushalts geteilt
          werden. Zwei Personen im selben Haushalt können getrennte Profile nutzen, wenn ihr Abo
          genug gleichzeitige Streams erlaubt. Freunde in anderen Wohnungen brauchen ein eigenes
          Konto.
        </p>
        <p className="mb-6 leading-relaxed text-ani-muted">
          Für AniDachi selbst brauchen deine Freunde kein Abo: Sie treten deinem Raum mit einem
          kostenlosen Konto bei. {DE_PRICING_FREE20_SUMMARY} Alle Pläne im Vergleich findest du unter{" "}
          <Link href="/de/preise">Preise</Link>, die Installation unter{" "}
          <Link href="/de/erweiterung">AniDachi zu Chrome hinzufügen</Link>.
        </p>

        <h2 id="not-working" className="scroll-mt-24">
          Netflix Watchparty klappt nicht?
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Meistens ist eine Person an einer etwas anderen Stelle. Geht diese Liste durch, bevor
          jemand etwas neu installiert.
        </p>
        <SeoGuideBulletList
          items={[
            {
              title: "Falsche Seite",
              body: "AniDachi funktioniert nur im Player, also auf netflix.com/watch/. Wer auf der Startseite oder der Infoseite ist, drückt zuerst auf Abspielen.",
            },
            {
              title: "Andere Folge",
              body: "Sagt Staffel und Folge laut an. Folge 3 lässt sich nicht mit Folge 4 synchronisieren.",
            },
            {
              title: "Anderes Land",
              body: "Das Netflix-Angebot unterscheidet sich je nach Land. Findet jemand den Titel gar nicht, ist er dort vielleicht nicht verfügbar. Wählt etwas, das alle öffnen können.",
            },
            {
              title: "Profil",
              body: "Ein Kinderprofil oder Altersfreigaben können Titel ausblenden. Wechselt zu einem Profil, das den Titel zeigt.",
            },
            {
              title: "Browser",
              body: "Nutzt Chrome auf dem Computer. AniDachi läuft nicht in Safari, Firefox oder den Netflix-Apps.",
            },
            {
              title: "Erweiterung nicht bereit",
              body: "Hefte AniDachi über das Puzzle-Symbol in Chrome an und lade den Netflix-Tab einmal neu.",
            },
          ]}
        />
        <p className="mb-6 leading-relaxed text-ani-muted">
          Ihr wolltet eigentlich über Discord teilen? Warum Netflix dort schwarz bleibt und wie ihr
          Discord trotzdem für die Stimmen nutzt, steht unter{" "}
          <Link href="/de/netflix-auf-discord-streamen">Netflix auf Discord streamen</Link>.
        </p>

        <h2 id="vs-teleparty" className="scroll-mt-24">
          AniDachi oder Teleparty für Netflix?
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Teleparty, früher Netflix Party, ist die bekannteste Netflix-Erweiterung. Die Angaben zu
          Teleparty stammen aus der Support-FAQ und dem Chrome-Web-Store-Eintrag, Stand 20. Oktober
          2026.
        </p>
        <ResponsiveCompareTable
locale="de"
          columns={[
            { id: "anidachi", label: "AniDachi", highlight: true },
            { id: "teleparty", label: "Teleparty" },
          ]}
          rows={[
            {
              feature: "Netflix-Party veranstalten",
              values: { anidachi: "20 Minuten am Tag mit Free, ohne Limit mit Plus oder Pro", teleparty: "Kostenlose Stufe" },
            },
            {
              feature: "Sprach- und Videochat",
              values: { anidachi: "Im Raum enthalten", teleparty: "Nur mit Premium (6,59 $ im Monat oder 47,88 $ im Jahr)" },
            },
            {
              feature: "Personen pro Party",
              values: {
                anidachi: `Bis zu ${DE_FREE_ROOM} (Free), ${DE_PLUS_ROOM} (Plus) oder ${DE_PRO_ROOM} (Pro)`,
                teleparty: "Über 1.000",
              },
            },
            {
              feature: "Wo es läuft",
              values: { anidachi: "Chrome auf dem Computer", teleparty: "Chrome, Edge, Safari, Opera; Apps für Android und iOS" },
            },
            {
              feature: "Andere Dienste",
              values: { anidachi: "YouTube, Crunchyroll", teleparty: "Disney+, Prime Video, HBO Max und mehr" },
            },
          ]}
        />
        <p className="mb-6 leading-relaxed text-ani-muted">
          Teleparty passt besser, wenn eure Gruppe Handys, einen anderen Browser als Chrome, eine
          sehr große Party oder Dienste wie Disney+ braucht. AniDachi passt besser, wenn ihr euch
          beim Schauen sehen und hören wollt, ohne dass alle für Sprachchat bezahlen, und wenn ihr
          auch YouTube oder Anime auf Crunchyroll schaut. Ihr nutzt bisher Watch2Gether? Dann lies{" "}
          <Link href="/de/watch2gether-alternative">Watch2Gether Alternative für Netflix</Link>.
        </p>

        <HubCtaBand
          pagePath={PAGE_PATH}
          href={DE_INSTALL_HUB_PATH}
          ctaLabel={CTA_LABEL}
          heading="Starte deine Netflix Watchparty"
          body="AniDachi installieren, Film oder Folge öffnen, Link schicken. 20 Minuten am Tag kostenlos, Freunde treten kostenlos bei."
        />

        <h2 id="more" className="scroll-mt-24">
          Mehr Watchpartys
        </h2>
        <SeoGuideRelated
          links={[
            { href: "/de", label: "Watchparty: Netflix, YouTube und Crunchyroll" },
            { href: "/de/netflix-auf-discord-streamen", label: "Netflix auf Discord streamen" },
            { href: "/de/youtube-watchparty", label: "YouTube Watchparty" },
            { href: "/de/crunchyroll-watchparty", label: "Crunchyroll Watchparty" },
            { href: "/de/watch2gether-alternative", label: "Watch2Gether Alternative" },
          ]}
        />
        <p className="mt-6 text-sm leading-relaxed text-ani-muted">
          Quellen, geprüft am 20. Oktober 2026:{" "}
          {SOURCES.map((source, index) => (
            <span key={source.href}>
              {index > 0 ? ", " : null}
              <a href={source.href} target="_blank" rel="noopener noreferrer" className="text-brand-orange hover:underline">
                {source.label}
              </a>
            </span>
          ))}
          . AniDachi ist nicht mit Netflix oder Teleparty verbunden.
        </p>
      </HubLandingLayout>
    </>
  );
}
