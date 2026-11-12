import type { Metadata } from "next";
import Link from "next/link";
import { getPlanPolicy } from "@anidachi/protocol";
import { FAQSection } from "@/components/faq-section";
import { BreadcrumbJsonLd, FAQPageJsonLd } from "@/components/json-ld";
import { PricingSectionDe } from "@/components/pricing-section-de";
import { StoreReviews } from "@/components/store-reviews";
import { languageAlternates } from "@/lib/hreflang";
import { DE_OG_LOCALE, DE_PRICING_FREE20_SUMMARY } from "@/lib/locale/de-copy";
import { UI_STRINGS } from "@/lib/locale/ui-strings";

export const revalidate = 300;

const PAGE_PATH = "/de/preise";
const t = UI_STRINGS.de;
const linkClass = "font-medium text-ani-text underline decoration-ani-line underline-offset-2 hover:text-ani-primary";

export const metadata: Metadata = {
  title: { absolute: "AniDachi Preise: Free, Plus und Pro" },
  description: DE_PRICING_FREE20_SUMMARY,
  alternates: languageAlternates({ en: "/pricing", de: PAGE_PATH }, "de"),
  openGraph: {
    title: "AniDachi Preise: kostenlose Watchparty in Chrome",
    description: DE_PRICING_FREE20_SUMMARY,
    url: PAGE_PATH,
    locale: DE_OG_LOCALE,
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AniDachi Preise: kostenlose Watchparty in Chrome",
    description: DE_PRICING_FREE20_SUMMARY,
    images: ["/opengraph-image.png"],
  },
};

/** Same questions as /pricing, in German. Keep the facts in step with lib/pricing-copy.ts. */
const faq = [
  {
    question: "Ist AniDachi kostenlos?",
    answer: `Ja. ${DE_PRICING_FREE20_SUMMARY} Freunde können deinem Raum kostenlos beitreten. Für Free brauchst du keine Kreditkarte.`,
  },
  {
    question: "Wie funktionieren meine kostenlosen Minuten?",
    answer:
      "Deine Minuten laufen, solange du und mindestens ein Gast in deinem Raum seid, auch wenn das Video pausiert ist. Allein warten kostet keine Zeit. Du teilst dir ein Kontingent über alle Räume und Geräte. Es wird jeden Tag um 00:00 UTC zurückgesetzt (in Deutschland um 1 Uhr, im Sommer um 2 Uhr); übrige Minuten verfallen. Wer dem Raum eines anderen beitritt, verbraucht keine eigenen Minuten.",
  },
  {
    question: "Brauchen meine Freunde ein bezahltes AniDachi-Abo?",
    answer:
      "Nein. Freunde treten deinem Raum kostenlos bei. Dein Plan bestimmt die Raumgröße. Jeder braucht die Erweiterung und eigenen Zugriff auf das Video. Den eigenen Schaufortschritt speichern kann nur, wer selbst Plus oder Pro hat.",
  },
  {
    question: "Was ist der Unterschied zwischen Plus und Pro?",
    answer: `Plus erlaubt bis zu ${getPlanPolicy("plus").maxParticipants} Personen und ${getPlanPolicy("plus").maxMicrophones} Mikrofone. Pro erlaubt bis zu ${getPlanPolicy("pro").maxParticipants} Personen und ${getPlanPolicy("pro").maxMicrophones} Mikrofone, mit bevorzugtem Support. Die Raumgrößen schließen den Gastgeber ein. Beide Pläne haben kein tägliches Zeitlimit und speichern deinen persönlichen Schauverlauf.`,
  },
  {
    question: "Kann ich meinen Schauverlauf mit Free behalten?",
    answer:
      "Mit Free kannst du gespeicherten Verlauf ansehen, fortsetzen und löschen. Neuen Fortschritt speichern oder bearbeiten geht nur mit deinem eigenen Plus- oder Pro-Plan.",
  },
  {
    question: "Wie kündige ich mein Abo?",
    answer:
      "Öffne Account → Subscription und wähle „Cancel renewal“. Du behältst den Zugang bis zum Ende des aktuellen Zeitraums, danach verlängert sich das Abo nicht.",
  },
  {
    question: "Brauche ich trotzdem Crunchyroll, YouTube oder Netflix?",
    answer:
      "Ja. Jeder braucht eigenen Zugriff auf dasselbe Video. Ein Streaming-Abo ist nötig, wenn der Dienst für diesen Titel Geld verlangt. AniDachi synchronisiert eure Player, das Video selbst liefert es nicht.",
  },
  {
    question: "In welcher Währung wird abgerechnet?",
    answer:
      "Die Preise sind in US-Dollar. Endbetrag, Steuern und Rabatte siehst du im Stripe-Checkout vor der Bestätigung.",
  },
];

export default function GermanPricingPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Startseite", url: "/de" },
          { name: "Preise", url: PAGE_PATH },
        ]}
      />
      <FAQPageJsonLd questions={faq} />
      <main className="min-h-screen bg-ani-canvas">
        <nav aria-label={t.breadcrumb} className="border-b border-ani-line bg-ani-canvas">
          <div className="container mx-auto px-4 py-3.5 text-sm tracking-[-0.01em] text-ani-muted">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link href="/de" className="transition-colors duration-200 hover:text-ani-text">
                  Startseite
                </Link>
              </li>
              <li className="text-ani-line" aria-hidden="true">
                /
              </li>
              <li className="font-medium text-ani-text">Preise</li>
            </ol>
          </div>
        </nav>

        <PricingSectionDe pagePath={PAGE_PATH} headingLevel={1} showPlanMatrix />
        <StoreReviews title={t.reviewsTitle} />
        <FAQSection title="Häufige Fragen zu den Preisen" questions={faq} moreLabel={t.faqMore} fewerLabel={t.faqFewer} />
        <section className="container mx-auto max-w-3xl px-4 pb-16 text-center text-sm text-ani-muted">
          <p>
            Plus und Pro gelten für Crunchyroll, YouTube und eine{" "}
            <Link href="/de/netflix-watchparty" className={linkClass}>
              Netflix Watchparty
            </Link>
            , und Freunde treten kostenlos bei. Die Installation dauert etwa zwei Minuten:{" "}
            <Link href="/de/erweiterung" className={linkClass}>
              AniDachi zu Chrome hinzufügen
            </Link>
            . Wie eine Watchparty funktioniert, steht unter{" "}
            <Link href="/de/crunchyroll-watchparty" className={linkClass}>
              Crunchyroll Watchparty
            </Link>{" "}
            und{" "}
            <Link href="/de/youtube-watchparty" className={linkClass}>
              YouTube Watchparty
            </Link>
            .
          </p>
        </section>
      </main>
    </>
  );
}
