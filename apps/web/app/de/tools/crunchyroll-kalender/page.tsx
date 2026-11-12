import type { Metadata } from "next";
import Link from "next/link";
import { InstallLink } from "@/components/install-link";
import { SeoGuideAnswer, SeoGuideNote, SeoGuideRelated, SeoGuideTitle } from "@/components/seo-guide-blocks";
import { SeoPageLayout, type TocHeading } from "@/components/seo-page-layout";
import { ReleaseSchedule } from "@/components/tools/release-schedule";
import { ToolWebAppJsonLd } from "@/components/tools/tool-json-ld";
import { languageAlternates } from "@/lib/hreflang";
import { DE_INSTALL_HUB_PATH } from "@/lib/install-cta";
import { DE_OG_LOCALE, DE_PRICING_FREE20_SUMMARY } from "@/lib/locale/de-copy";
import { UI_STRINGS } from "@/lib/locale/ui-strings";
import { CRUNCHYROLL_WEEK } from "@/lib/tools/crunchyroll-schedule";
import { slotAnchor, slotInstant, weekRangeLabel, type ScheduleWeek } from "@/lib/tools/schedule-time";
import { getSeoSiteOrigin } from "@/lib/site-url";

const url = "/de/tools/crunchyroll-kalender";
const t = UI_STRINGS.de;
const headingClass = "mt-12 mb-3 scroll-mt-24 text-2xl font-bold tracking-[-0.02em] text-ani-text";
const linkClass = "font-medium text-ani-text underline decoration-ani-line underline-offset-4";
const CET = "Europe/Paris";

/**
 * Same weekly data as /tools/crunchyroll-schedule, for German readers: German episode labels and
 * no links to the English per-show guides. Bump dateModified below whenever the English schedule
 * is updated on Mondays.
 */
const week: ScheduleWeek = {
  ...CRUNCHYROLL_WEEK,
  slots: CRUNCHYROLL_WEEK.slots.map((slot) => ({
    ...slot,
    watchSlug: undefined,
    episode: slot.episode?.replace(/^Ep /, "Folge "),
  })),
};
const showCount = week.slots.length;
/** "8 Nov 2026" from the shared data, written the German way ("8. Nov. 2026"). */
const checkedDe = week.checked.replace(/^(\d+) (\w+) (\d{4})$/, (_m, day: string, month: string, year: string) => {
  const months: Record<string, string> = { Jan: "Jan.", Feb: "Feb.", Mar: "März", Apr: "Apr.", May: "Mai", Jun: "Juni", Jul: "Juli", Aug: "Aug.", Sep: "Sep.", Oct: "Okt.", Nov: "Nov.", Dec: "Dez." };
  return `${day}. ${months[month] ?? month} ${year}`;
});
const weekLabel = weekRangeLabel(week, true, t.intl);
const shortWeekLabel = weekRangeLabel(week, false, t.intl);

// The layout appends " | AniDachi" (11 characters).
const pageTitle = "Crunchyroll Kalender: Simulcasts diese Woche";
const pageDescription = `Crunchyroll Kalender für ${shortWeekLabel}: ${showCount} Simulcast-Folgen mit Uhrzeit in deutscher Zeit (MEZ), oder in deiner eigenen Zeitzone.`;

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: languageAlternates({ en: "/tools/crunchyroll-schedule", de: url }, "de"),
  openGraph: {
    title: pageTitle,
    description: `${showCount} Crunchyroll-Simulcasts vom ${weekLabel}, in deutscher Zeit.`,
    url,
    locale: DE_OG_LOCALE,
    images: [{ url: "/opengraph-image.png", alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: `${showCount} Crunchyroll-Simulcasts vom ${weekLabel}, in deutscher Zeit.`,
    images: ["/opengraph-image.png"],
  },
};

const faq = [
  {
    question: "Was ist der Crunchyroll Simulcast-Kalender?",
    answer: `Die Wochenübersicht der neuen Folgen, die Crunchyroll kurz nach der Ausstrahlung in Japan mit Untertiteln zeigt. Diese Seite listet ${showCount} davon für ${weekLabel}, jeweils mit der Uhrzeit in deutscher Zeit oder in deiner eigenen Zeitzone.`,
  },
  {
    question: "Wann kommen neue Folgen auf Crunchyroll?",
    answer:
      "Jede Serie hat ihren eigenen Termin, meist wenige Stunden nach der Ausstrahlung in Japan. In Deutschland erscheinen die meisten neuen Folgen am Nachmittag oder frühen Abend. Die genaue Uhrzeit für jede Serie steht in der Liste oben.",
  },
  {
    question: "Wann erscheint die deutsche Synchronfassung?",
    answer:
      "Dieser Kalender zeigt die Simulcasts mit Untertiteln. Deutsche Synchronfassungen erscheinen bei Crunchyroll meist später und nicht für jede Serie. Prüft die Folge in der App, bevor eure Gruppe startet.",
  },
  {
    question: "Wann kommt die neue Folge von One Piece?",
    answer:
      "One Piece pausiert nach Folge 1180 (27. September 2026). Neue Folgen kommen 2027 zurück, dann im neuen Format mit 26 Folgen pro Jahr.",
  },
  {
    question: "Ist jede Serie in Deutschland verfügbar?",
    answer:
      "Nicht unbedingt. Die Liste stammt aus dem weltweiten Simulcast-Plan, und das Angebot von Crunchyroll unterscheidet sich je nach Land. Wenn eine Serie bei dir fehlt, ist sie in deinem Land vielleicht nicht lizenziert.",
  },
  {
    question: "Kann eine Gruppe die neue Folge zusammen schauen?",
    answer: `Ja. Einer erstellt mit AniDachi einen Raum, die anderen treten kostenlos bei, und alle öffnen dieselbe Folge im eigenen Crunchyroll-Konto. ${DE_PRICING_FREE20_SUMMARY}`,
  },
];

const headings: TocHeading[] = [
  { id: "kalender", label: `Diese Woche: ${shortWeekLabel}`, level: 2 },
  { id: "synchro", label: "Deutsche Synchro", level: 2 },
  { id: "uhrzeiten", label: "So funktionieren die Uhrzeiten", level: 2 },
  { id: "one-piece", label: "One Piece", level: 2 },
  { id: "woechentlich", label: "Jede Woche zusammen schauen", level: 2 },
  { id: "mehr", label: "Mehr dazu", level: 2 },
];

export default function GermanCrunchyrollCalendarPage() {
  const itemList = [...week.slots]
    .sort((a, b) => slotInstant(week, a).getTime() - slotInstant(week, b).getTime())
    .map((slot, i) => ({ name: slot.title, url: `${url}#${slotAnchor(slot)}`, position: i + 1 }));

  return (
    <>
      <ToolWebAppJsonLd
        name="Crunchyroll Kalender"
        description={`Crunchyroll-Simulcasts für ${weekLabel}, in deutscher Zeit.`}
        url={url}
      />
      <SeoPageLayout
        locale="de"
        breadcrumbs={[
          { name: "Startseite", url: "/de" },
          { name: "Crunchyroll Kalender", url },
        ]}
        title="Crunchyroll Kalender: Simulcasts diese Woche"
        description={`Crunchyroll-Simulcasts für ${weekLabel}, in deutscher Zeit.`}
        url={url}
        datePublished="2026-11-12"
        dateModified="2026-11-12"
        faq={faq}
        headings={headings}
        itemList={itemList}
        articleImage={`${getSeoSiteOrigin()}/opengraph-image.png`}
        ctaCopy="anime"
      >
        <SeoGuideTitle>Crunchyroll Kalender: Simulcasts vom {shortWeekLabel}</SeoGuideTitle>
        <SeoGuideAnswer>
          <p>
            <strong>
              Im Crunchyroll Kalender für {weekLabel} stehen {showCount} neue Simulcast-Folgen mit
              Untertiteln, jeweils zur geplanten Uhrzeit.
            </strong>{" "}
            Die Zeiten starten in deutscher Zeit (MEZ) und wechseln beim Laden in die Zeitzone deines
            Geräts; du kannst auch eine andere wählen. Wir prüfen die Liste jeden Montag, zuletzt am{" "}
            {checkedDe}.
          </p>
        </SeoGuideAnswer>

        <h2 id="kalender" className={headingClass}>
          Crunchyroll Simulcasts: {weekLabel}
        </h2>
        <p className="mb-6 leading-relaxed text-ani-muted">
          Dieser Kalender wird von Hand gepflegt und ist kein Live-Feed. Er zeigt nur Folgen mit
          Untertiteln, sortiert nach Uhrzeit. Serien können sich um eine Woche verschieben, und nicht
          jede Serie ist in jedem Land verfügbar. Prüft die Folge deshalb in der App, bevor eure
          Gruppe startet. Die Serientitel stehen so, wie Crunchyroll sie international führt.
        </p>
        <div className="mb-10">
          <ReleaseSchedule week={week} locale="de" defaultZone={CET} />
        </div>

        <h2 id="synchro" className={headingClass}>
          Deutsche Synchro
        </h2>
        <SeoGuideNote>
          Dieser Kalender zeigt die Simulcasts mit Untertiteln. Deutsche Synchronfassungen erscheinen
          bei Crunchyroll meist einige Wochen später und nicht für jede Serie. Wenn eure Gruppe auf
          Deutsch schauen will, prüft vorher in der App, bis zu welcher Folge die Synchro schon da ist.
        </SeoGuideNote>

        <div className="not-prose mb-10 rounded-[20px] border border-ani-line bg-ani-panel px-5 py-5 sm:px-7">
          <p className="text-lg font-semibold tracking-[-0.01em] text-ani-text">
            Die Folgen dieser Woche zusammen schauen
          </p>
          <p className="mt-2 leading-relaxed text-ani-muted">
            Such dir oben einen Termin aus,{" "}
            <InstallLink href={DE_INSTALL_HUB_PATH} className={linkClass}>
              füge AniDachi zu Chrome hinzu
            </InstallLink>{" "}
            und öffne die Folge auf Crunchyroll, sobald sie erscheint. Einer erstellt den Raum mit Free
            (20 Minuten am Tag für bis zu 4 Personen), Plus oder Pro; die anderen treten kostenlos bei,
            jeder im eigenen Crunchyroll-Konto. Abspielen, Pause und Spulen bleiben synchron, mit
            Sprache und Chat im Raum. Ihr schaut stattdessen etwas auf Netflix? Dieselbe Erweiterung
            startet eine{" "}
            <Link href="/de/netflix-watchparty" className={linkClass}>
              Netflix Watchparty
            </Link>
            .
          </p>
        </div>

        <h2 id="uhrzeiten" className={headingClass}>
          So funktionieren die Uhrzeiten
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Jeder Simulcast hängt an der Ausstrahlung in Japan, und Japan stellt die Uhr nicht um. Wenn
          bei uns die Zeit umgestellt wird, erscheint dieselbe Serie deshalb eine Stunde früher oder
          später, obwohl sich in Japan nichts geändert hat. Seit dem 25. Oktober 2026 gilt in
          Deutschland wieder die Winterzeit (MEZ).
        </p>
        <p className="mb-10 leading-relaxed text-ani-muted">
          Eine Ausstrahlung spät in der japanischen Nacht landet bei uns oft am Nachmittag oder Abend
          desselben Tages. Die Tagesüberschriften oben richten sich nach der gewählten Zeitzone, das ist
          also schon eingerechnet.
        </p>

        <h2 id="one-piece" className={headingClass}>
          One Piece
        </h2>
        <p className="mb-10 leading-relaxed text-ani-muted">
          {/* Keep in step with ONE_PIECE_STATUS in lib/tools/crunchyroll-schedule.ts. */}
          One Piece pausiert nach Folge 1180 (27. September 2026). Neue Folgen kommen 2027 zurück, dann
          im neuen Format mit 26 Folgen pro Jahr. Bis dahin taucht One Piece in diesem Kalender nicht
          auf.
        </p>

        <h2 id="woechentlich" className={headingClass}>
          Jede Woche zusammen schauen
        </h2>
        <p className="mb-4 leading-relaxed text-ani-muted">
          Gruppen, die eine Season verfolgen, bleiben meist bei ein oder zwei Serien und treffen sich
          jede Woche zur gleichen Zeit, ein paar Stunden nach Erscheinen der Folge. Nutzt die
          Zeitzonen-Knöpfe, um einen Termin zu finden, der für alle passt, und klärt vor dem ersten
          Abend, ob ihr mit Untertiteln oder Synchro schaut.
        </p>
        <p className="mb-10 leading-relaxed text-ani-muted">
          Ihr trefft euch auf Discord? Beim Bildschirmteilen bleibt Crunchyroll oft schwarz. Wie ihr
          Discord trotzdem für die Stimmen nutzt, steht unter{" "}
          <Link href="/de/netflix-auf-discord-streamen" className={linkClass}>
            Netflix auf Discord streamen
          </Link>
          ; bei Crunchyroll ist es dasselbe.
        </p>

        <h2 id="mehr" className={headingClass}>
          Mehr dazu
        </h2>
        <SeoGuideRelated
          className="mb-8"
          links={[
            { href: "/de/crunchyroll-watchparty", label: "Crunchyroll Watchparty" },
            { href: "/de", label: "Watchparty: Netflix, YouTube und Crunchyroll" },
            { href: "/de/netflix-watchparty", label: "Netflix Watchparty" },
          ]}
        />
      </SeoPageLayout>
    </>
  );
}
