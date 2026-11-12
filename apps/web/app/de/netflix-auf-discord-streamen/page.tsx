import type { Metadata } from "next";
import Link from "next/link";
import { InstallLink } from "@/components/install-link";
import { HowToJsonLd } from "@/components/json-ld";
import { ResponsiveCompareTable } from "@/components/responsive-compare-table";
import {
  SeoGuideAnswer,
  SeoGuideBulletList,
  SeoGuideNote,
  SeoGuideRelated,
  SeoGuideSteps,
  SeoGuideTitle,
} from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { languageAlternates } from "@/lib/hreflang";
import { DE_INSTALL_HOWTO_STEP_TEXT, DE_INSTALL_HUB_PATH } from "@/lib/install-cta";
import { DE_OG_LOCALE, DE_PLUS_ROOM, DE_PRICING_FREE20_SUMMARY, DE_PRO_ROOM } from "@/lib/locale/de-copy";
import { getSeoSiteOrigin } from "@/lib/site-url";

const PAGE_PATH = "/de/netflix-auf-discord-streamen";
const PAGE_TITLE = "Netflix auf Discord streamen (ohne Schwarzbild)";
const PAGE_DESCRIPTION =
  "Netflix auf Discord streamen zeigt Freunden oft nur ein schwarzes Bild. Warum das so ist und wie ihr Netflix trotzdem zusammen schaut, mit Discord für Sprache.";
const h2Class = "mt-10 scroll-mt-24 text-2xl font-bold text-ani-text";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: languageAlternates(
    { en: "/guides/how-to-screen-share-netflix-on-discord", de: PAGE_PATH },
    "de",
  ),
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

/** Same sources as the English guide (checked 20 Oct 2026), German pages where they exist. */
const SOURCES = [
  {
    href: "https://support.discord.com/hc/de/articles/360040816151",
    label: "Discord: Go Live und Bildschirmübertragung",
  },
  {
    href: "https://support.discord.com/hc/de/articles/360058862134",
    label: "Discord: FAQ zur Bildschirmübertragung auf Mobilgeräten",
  },
  {
    href: "https://support-apps.discord.com/hc/en-us/articles/26502500234519-Watch-Together-FAQ",
    label: "Discord: Watch Together FAQ",
  },
  { href: "https://help.netflix.com/legal/termsofuse", label: "Netflix-Nutzungsbedingungen" },
  { href: "https://help.netflix.com/de/node/27451", label: "Netflix-Hilfe: Fehler M7701-1003 (Widevine in Chrome)" },
];

const howToSteps = [
  {
    name: "Im Discord-Call bleiben",
    text: "Bleibt in eurem Sprachkanal, DM-Anruf oder Gruppenanruf. Startet aber kein Go Live auf dem Netflix-Tab; Discord überträgt nur eure Stimmen.",
  },
  { name: "AniDachi in Chrome installieren", text: DE_INSTALL_HOWTO_STEP_TEXT },
  {
    name: "Denselben Netflix-Titel im eigenen Konto öffnen",
    text: "Jeder meldet sich in Chrome mit dem eigenen Netflix-Konto an und öffnet denselben Film oder dieselbe Folge.",
  },
  {
    name: "Raum erstellen und Einladung in Discord posten",
    text: "Der Gastgeber mit Free, Plus oder Pro klickt oben rechts im Player auf die AniDachi-Kapsel, wählt „Create room“ und postet den Einladungslink im Discord-Chat. Freunde treten kostenlos bei, und Abspielen, Pause und Spulen bleiben synchron.",
  },
];

const faq = [
  {
    question: "Wie kann man Netflix auf Discord streamen, ohne schwarzen Bildschirm?",
    answer:
      "Einen unterstützten Weg gibt es nicht. Netflix schützt sein Video mit DRM, deshalb zeigt die Übertragung in Discord meist nur Schwarz. Nutzt Discord für die Stimmen und lasst jeden den Titel im eigenen Netflix-Konto abspielen, synchronisiert mit einer Watchparty-Erweiterung wie AniDachi in Chrome auf dem Computer.",
  },
  {
    question: "Warum ist Netflix auf Discord schwarz?",
    answer:
      "Netflix läuft in Chrome über geschützte Inhaltsentschlüsselung (Widevine). Discord nimmt die Pixel eines Fensters oder Bildschirms auf, und geschütztes Video wird aus dieser Aufnahme herausgehalten. Deine Freunde sehen deshalb Schwarz, während der Ton manchmal trotzdem durchkommt.",
  },
  {
    question: "Kann man Netflix auf Discord am Handy streamen?",
    answer:
      "Nein. Laut der FAQ von Discord zur Bildschirmübertragung auf Mobilgeräten erlaubt Netflix keine Bild- oder Tonübertragung aus seiner App, und Discord unterstützt das nicht. Am Handy nutzt du Discord für die Stimmen und schaust Netflix auf einem Computer oder deinem eigenen Gerät.",
  },
  {
    question: "Ist es verboten, Netflix auf Discord zu streamen?",
    answer:
      "Wir können keine Rechtsberatung geben. Die Netflix-Nutzungsbedingungen sehen den Dienst für den persönlichen, nicht kommerziellen Gebrauch vor, beschränken das Teilen auf den eigenen Haushalt und verbieten das Umgehen von Schutzmaßnahmen. Wenn jeder im eigenen Konto schaut, entsteht dieses Problem gar nicht erst.",
  },
  {
    question: "Hilft es, die Hardwarebeschleunigung auszuschalten?",
    answer:
      "Manche berichten von einem anderen Ergebnis, aber wir empfehlen das nicht. Es hängt davon ab, wie der Browser geschütztes Video verarbeitet, kann sich nach jedem Update ändern, und das Umgehen von Kopierschutz widerspricht den Netflix-Nutzungsbedingungen.",
  },
  {
    question: "Braucht jeder Netflix, um zusammen auf Discord zu schauen?",
    answer: `Ja, für eine synchrone Watchparty. Jeder braucht Zugriff auf denselben Titel in seinem Land. ${DE_PRICING_FREE20_SUMMARY} Freunde treten dem Raum kostenlos bei.`,
  },
  {
    question: "Wie schaut man Filme mit Freunden auf Discord?",
    answer:
      "Für YouTube-Videos spielt die Discord-Aktivität „Watch Together“ sie direkt in Discord ab. Für Netflix-Filme nutzt ihr Discord für die Stimmen und synchronisiert das Netflix jeder Person mit AniDachi in Chrome auf dem Computer.",
  },
];

const tocHeadings: TocHeading[] = [
  { id: "answer", label: "Kurz gesagt", level: 2 },
  { id: "why-black", label: "Warum Netflix schwarz bleibt", level: 2 },
  { id: "what-people-try", label: "Was viele versuchen", level: 2 },
  { id: "watch-in-sync", label: "Stattdessen synchron schauen", level: 2 },
  { id: "compare", label: "Bildschirm teilen vs. AniDachi", level: 2 },
  { id: "mobile", label: "Netflix auf Discord am Handy", level: 2 },
  { id: "movies", label: "Filme auf Discord schauen", level: 2 },
  { id: "sources", label: "Quellen", level: 2 },
  { id: "faq", label: "Häufige Fragen", level: 2 },
];

export default function GermanNetflixDiscordPage() {
  return (
    <>
      <HowToJsonLd
        name="Netflix mit Discord zusammen schauen, ohne Bildschirm zu teilen"
        description="Discord für die Stimmen nutzen und das Netflix jeder Person mit AniDachi in Chrome synchronisieren."
        steps={howToSteps}
      />
      <SeoPageLayout
        locale="de"
        breadcrumbs={[
          { name: "Startseite", url: "/de" },
          { name: "Netflix Watchparty", url: "/de/netflix-watchparty" },
          { name: "Netflix auf Discord streamen", url: PAGE_PATH },
        ]}
        title="Netflix auf Discord streamen"
        description="Warum Netflix auf Discord ein schwarzes Bild zeigt, was viele versuchen und wie ihr synchron schaut, mit Discord für die Stimmen."
        url={PAGE_PATH}
        datePublished="2026-11-12"
        dateModified="2026-11-12"
        faq={faq}
        headings={tocHeadings}
        articleImage={`${getSeoSiteOrigin()}/opengraph-image.png`}
        ctaCopy="guide"
        aboveFoldCta
      >
        <SeoGuideTitle>Netflix auf Discord streamen (und das schwarze Bild beheben)</SeoGuideTitle>

        <h2 id="answer" className="scroll-mt-24">
          Kurz gesagt
        </h2>
        <SeoGuideAnswer>
          <p>
            <strong>
              Meistens geht es nicht. Netflix schützt sein Video mit DRM. Wenn du es per Discord Go
              Live teilst, sehen deine Freunde ein schwarzes Bild und hören manchmal nur den Ton.
              Was funktioniert: Bleibt im Discord-Call für die Stimmen, und jeder spielt denselben
              Titel im eigenen Netflix-Konto ab, synchron gehalten von einer
              Watchparty-Erweiterung.
            </strong>{" "}
            AniDachi macht das in Chrome auf dem Computer, und Freunde treten einer{" "}
            <Link href="/de/netflix-watchparty">Netflix Watchparty</Link> kostenlos bei.
          </p>
        </SeoGuideAnswer>

        <h2 id="why-black" className={h2Class}>
          Warum Netflix auf Discord schwarz bleibt
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Go Live und Bildschirmübertragung in Discord nehmen die Pixel eines App-Fensters oder des
          ganzen Bildschirms auf, wandeln sie in einen Videostream um und schicken ihn an alle im
          Call. Für ein Spiel, eine Präsentation oder einen Browser-Tab mit einem Artikel ist das
          kein Problem.
        </p>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Netflix ist anders. In Chrome läuft Netflix über geschützte Inhaltsentschlüsselung: Die
          Netflix-Hilfe empfiehlt, das Widevine Content Decryption Module aktuell zu halten und
          Seiten das Abspielen geschützter Inhalte zu erlauben. Geschütztes Video wird so
          entschlüsselt, dass Bildschirmaufnahmen es nicht lesen dürfen. Discord nimmt also alles
          rund um den Player auf (Untertitel, Fortschrittsbalken, Mauszeiger) und an der Stelle des
          Bildes ein schwarzes Rechteck. Der Ton wird getrennt verarbeitet, deshalb hören Freunde
          den Film oft, sehen ihn aber nicht.
        </p>
        <p className="mb-8 leading-relaxed text-ani-muted">
          Aus demselben Grund bleibt auch Crunchyroll auf Discord oft schwarz, siehe{" "}
          <Link href="/de/crunchyroll-watchparty">Crunchyroll Watchparty</Link>. Es ist keine kaputte
          Discord-Installation, keine fehlende Berechtigung und kein schlechter Grafiktreiber. Der
          Streamingdienst schützt sein Video, und das funktioniert wie vorgesehen.
        </p>

        <h2 id="what-people-try" className={h2Class}>
          Was viele versuchen, und wo die Grenzen liegen
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Wer nach „Netflix Discord schwarzer Bildschirm“ sucht, findet immer dieselben Tipps. Hier
          steht, was dahintersteckt und warum wir keinen davon als Lösung sehen.
        </p>
        <SeoGuideBulletList
          items={[
            {
              title: "Hardwarebeschleunigung ausschalten",
              body: "Manche berichten, dass das Bild danach erscheint. Das hängt davon ab, wie eine bestimmte Browserversion geschütztes Video verarbeitet, kann nach einem Update wieder aufhören und bedeutet, den Schutz zu umgehen, den Netflix vorgesehen hat.",
            },
            {
              title: "Den ganzen Bildschirm statt des Fensters teilen",
              body: "Ändert nichts daran, wie geschütztes Video behandelt wird. Meist ist das Ergebnis dasselbe schwarze Rechteck, nur mit deinem Desktop drumherum.",
            },
            {
              title: "Browser wechseln oder die Discord-Web-App nutzen",
              body: "Die Ergebnisse schwanken je nach Browser und ändern sich mit der Zeit. Netflix unterstützt außerdem nur bestimmte Browser, ein Browser mit Bild spielt Netflix also vielleicht gar nicht gut ab.",
            },
            {
              title: "Aufnahmetools oder virtuelle Kameras",
              body: "Alles, was Kopierschutz umgehen soll, ist bei Netflix nicht erlaubt. Die Nutzungsbedingungen verbieten das Umgehen von Schutzmaßnahmen und das Teilen außerhalb des Haushalts.",
            },
          ]}
        />
        <SeoGuideNote>
          Selbst wenn eine Übertragung ein Bild zeigt, hat sie die Grenzen jedes Go-Live-Streams: Der
          Upload einer Person trägt den Film für alle, Discord begrenzt normale Streams auf 720p und
          30 fps (mit Nitro mehr), und nur wer streamt, kann pausieren oder spulen. Für einen ganzen
          Film ist Bildschirmteilen das falsche Werkzeug.
        </SeoGuideNote>

        <h2 id="watch-in-sync" className={h2Class}>
          Stattdessen synchron schauen: Stimmen über Discord, Video über AniDachi
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Die Lösung: Das Video läuft gar nicht mehr über Discord. Discord macht weiter, was es gut
          kann, nämlich Sprache. Der Film läuft im eigenen Netflix-Konto jeder Person im eigenen
          Chrome-Tab, in voller Qualität, und AniDachi hält die Player auf derselben Stelle. Niemand
          nimmt etwas auf, also kann auch nichts schwarz werden.
        </p>
        <SeoGuideSteps steps={howToSteps} />
        <p className="mb-8 leading-relaxed text-ani-muted">
          Bereit?{" "}
          <InstallLink href={DE_INSTALL_HUB_PATH}>
            AniDachi zu Chrome hinzufügen
          </InstallLink>{" "}
          und einen Netflix-Film oder eine Folge öffnen. Wenn ihr lieber im Raum redet: AniDachi hat
          eigene Sprach- und Videoanrufe mit Push-to-Talk (Taste V), Chat und Reaktionen im Player,
          ein Discord-Call ist also optional.
        </p>

        <h2 id="compare" className={h2Class}>
          Discord-Bildschirmübertragung vs. AniDachi für Netflix
        </h2>
        <ResponsiveCompareTable
locale="de"
          columns={[
            { id: "share", label: "Discord-Bildschirmübertragung" },
            { id: "anidachi", label: "Discord-Sprache + AniDachi", highlight: true },
          ]}
          rows={[
            {
              feature: "Netflix-Bild",
              values: { share: "Meist schwarz (DRM-geschütztes Video)", anidachi: "Der eigene Netflix-Player jeder Person" },
            },
            {
              feature: "Bildqualität",
              values: { share: "Bis 720p/30 fps; mit Nitro bis 4K/60 fps", anidachi: "So, wie Netflix-Abo und Verbindung jeder Person es erlauben" },
            },
            {
              feature: "Filmton",
              values: { share: "Im Stream gemischt; unter Linux keine Tonaufnahme", anidachi: "Aus dem eigenen Player jeder Person" },
            },
            {
              feature: "Verzögerung",
              values: { share: "Zuschauer sehen eine verzögerte Kopie", anidachi: "Player auf derselben Stelle; Abspielen, Pause und Spulen synchron" },
            },
            {
              feature: "Braucht jeder Netflix?",
              values: { share: "Laut Netflix ist ein Konto auf einen Haushalt beschränkt", anidachi: "Ja, jeder nutzt den eigenen Netflix-Zugang" },
            },
            {
              feature: "Was der Gastgeber hochlädt",
              values: { share: "Den ganzen Film, für jeden Zuschauer", anidachi: "Kein Video; Netflix streamt an jede Person" },
            },
            {
              feature: "Gruppengröße",
              values: { share: "Bis zu 50 Zuschauer pro Go-Live-Stream", anidachi: `Bis zu ${DE_PLUS_ROOM} Personen (Plus) oder ${DE_PRO_ROOM} (Pro), inklusive Gastgeber` },
            },
            {
              feature: "Kosten",
              values: { share: "Kostenlos; Nitro für höhere Qualität", anidachi: "Freunde treten kostenlos bei; Free-Gastgeber: 20 Minuten pro UTC-Tag, bis zu 4 Personen; Plus und Pro ohne Tageslimit" },
            },
            {
              feature: "Geräte",
              values: { share: "Discord am Computer, im Browser und am Handy", anidachi: "Nur Chrome auf dem Computer" },
            },
          ]}
        />
        <p className="mb-8 leading-relaxed text-ani-muted">
          Der Vergleich ist eindeutig. Bildschirmteilen kostet nichts und reicht für einen kurzen
          Blick auf ein Menü oder einen Trailer, zeigt bei Netflix aber selten ein Bild. AniDachi
          braucht alle in Chrome auf dem Computer, mit eigenem Netflix-Zugang und einem Gastgeber
          mit Free, Plus oder Pro, und dafür sieht der Film so aus, wie Netflix ihn schickt.
        </p>

        <h2 id="mobile" className={h2Class}>
          Netflix auf Discord am Handy streamen
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Am Handy ist die Antwort klar: nein. Die FAQ von Discord zur Bildschirmübertragung auf
          Mobilgeräten nennt Netflix unter den Streaming-Apps, die keine Bild- oder Tonübertragung
          erlauben, und Discord unterstützt das nicht. Eine Übertragung aus der Netflix-App bringt
          also nichts.
        </p>
        <p className="mb-8 leading-relaxed text-ani-muted">
          AniDachi hat ebenfalls keine Handy-App; es läuft in Chrome auf dem Computer. Was
          funktioniert: die Geräte aufteilen. Tritt dem Discord-Sprachkanal am Handy bei und spiel
          Netflix in Chrome auf dem Laptop oder Computer ab, während AniDachi die Gruppe synchron
          hält. Wer nur ein Handy hat, startet am ehrlichsten dieselbe Folge gleichzeitig in der
          eigenen Netflix-App und redet über Discord. Nach einer Pause läuft das nicht mehr
          synchron, ist aber erlaubt.
        </p>

        <h2 id="movies" className={h2Class}>
          Filme auf Discord schauen
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Discord hat einen eingebauten Weg, Videos zusammen zu schauen: die Aktivität „Watch
          Together“. Sie funktioniert nur mit YouTube. Laut der FAQ von Discord ist sie eine
          gemeinsame YouTube-Playlist, die das Synchronisieren übernimmt und über den eingebetteten
          YouTube-Player läuft. Man kann sich dort nicht mit dem eigenen YouTube-Konto anmelden,
          deshalb sehen auch YouTube-Premium-Mitglieder Werbung. In der Gruppe ist das Schauen auf
          180 Minuten pro Person begrenzt, danach folgt eine Pause von 10 Minuten. Netflix,
          Crunchyroll oder andere Dienste lassen sich damit nicht öffnen.
        </p>
        <p className="mb-8 leading-relaxed text-ani-muted">
          Es kommt also darauf an, wo der Film läuft. Für ein YouTube-Video ist die Aktivität der
          schnellste Weg in Discord, oder ihr nutzt die{" "}
          <Link href="/de/youtube-watchparty">YouTube Watchparty</Link>. Für einen Netflix-Film nutzt
          ihr Discord für die Stimmen und einen AniDachi-Raum für den Film. Anime-Filme auf
          Crunchyroll funktionieren genauso.
        </p>

        <h2 id="sources" className={h2Class}>
          Quellen
        </h2>
        <p className="mb-8 leading-relaxed text-ani-muted">
          Angaben zu Discord und Netflix geprüft am 20. Oktober 2026:{" "}
          {SOURCES.map((source, index) => (
            <span key={source.href}>
              {index > 0 ? ", " : null}
              <a href={source.href} target="_blank" rel="noopener noreferrer">
                {source.label}
              </a>
            </span>
          ))}
          . AniDachi ist nicht mit Netflix oder Discord verbunden.
        </p>
        <SeoGuideRelated
          links={[
            { href: "/de/netflix-watchparty", label: "Netflix Watchparty" },
            { href: "/de", label: "Watchparty: Netflix, YouTube und Crunchyroll" },
            { href: "/de/crunchyroll-watchparty", label: "Crunchyroll Watchparty" },
            { href: "/de/watch2gether-alternative", label: "Watch2Gether Alternative" },
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
