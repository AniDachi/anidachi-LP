import type { Metadata } from "next";
import { howToStepsDe } from "@/components/how-it-works";
import { HomeClient } from "@/components/home/home-client";
import { FAQPageJsonLd, HowToJsonLd, SoftwareApplicationJsonLd } from "@/components/json-ld";
import { languageAlternates } from "@/lib/hreflang";
import { DE_OG_LOCALE } from "@/lib/locale/de-copy";
import { deHomeFAQ } from "@/lib/locale/de-home-faq";

const PAGE_PATH = "/de";
// Keyword Planner, German, DE/AT/CH (12 Nov 2026): "watch together" 18,100, "watchparty" 3,600,
// "zusammen schauen" phrases about 300 in total. Platform searches go to the German platform pages.
const PAGE_TITLE = "Watch Together & Watchparty: zusammen schauen";
const PAGE_DESCRIPTION =
  "Watchparty und Watch Together mit Freunden: Netflix, YouTube und Crunchyroll synchron zusammen schauen, jeder im eigenen Konto. Mit Chat und Videoanruf.";

export const metadata: Metadata = {
  title: PAGE_TITLE,
  description: PAGE_DESCRIPTION,
  alternates: languageAlternates({ en: "/", de: PAGE_PATH }, "de"),
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

export const revalidate = 300;

/**
 * German homepage: the same sections as `/` (app/page.tsx) in German. The product demo and the
 * store review quotes stay English, and the pricing cards keep their English plan details and
 * checkout.
 */
export default function GermanHomePage() {
  return (
    <>
      <HomeClient locale="de" />
      <SoftwareApplicationJsonLd />
      <FAQPageJsonLd questions={deHomeFAQ} />
      <HowToJsonLd
        name="So schaut ihr mit AniDachi zusammen"
        description="AniDachi installieren, anmelden und einen Raum erstellen oder beitreten, um YouTube, Crunchyroll oder Netflix zusammen zu schauen."
        steps={howToStepsDe}
      />
    </>
  );
}
