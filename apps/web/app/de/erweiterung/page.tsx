import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ExtensionInstallHub } from "@/components/extension-install-hub";
import { BreadcrumbJsonLd, FAQPageJsonLd, HowToJsonLd } from "@/components/json-ld";
import { getExtensionArtifact, toPublicExtensionArtifact } from "@/lib/extension-artifact";
import { languageAlternates } from "@/lib/hreflang";
import { DE_INSTALL_HUB_PATH } from "@/lib/install-cta";
import { DE_OG_LOCALE } from "@/lib/locale/de-copy";
import { deExtensionHowToSteps, deExtensionInstallFaq, deExtensionUsingSteps } from "@/lib/locale/de-extension";
import { UI_STRINGS } from "@/lib/locale/ui-strings";

const TITLE = "AniDachi installieren: Chrome-Erweiterung für Watchpartys";
const DESCRIPTION =
  "Installiere die offizielle AniDachi-Erweiterung aus dem Chrome Web Store und schau Crunchyroll, YouTube und Netflix zusammen.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: languageAlternates({ en: "/extension", de: DE_INSTALL_HUB_PATH }, "de"),
  openGraph: {
    title: "AniDachi zu Chrome hinzufügen",
    description: DESCRIPTION,
    url: DE_INSTALL_HUB_PATH,
    locale: DE_OG_LOCALE,
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "AniDachi" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AniDachi zu Chrome hinzufügen",
    description: DESCRIPTION,
    images: ["/opengraph-image.png"],
  },
};

/**
 * German install page: the public part of /extension in German. The post-install welcome flow
 * (?welcome=1) stays on /extension, because the English extension opens that page.
 */
export default function GermanExtensionInstallPage() {
  const artifact = toPublicExtensionArtifact(getExtensionArtifact());
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Startseite", url: "/de" },
          { name: "Chrome-Erweiterung", url: DE_INSTALL_HUB_PATH },
        ]}
      />
      <FAQPageJsonLd questions={deExtensionInstallFaq} />
      <HowToJsonLd
        name="So installierst du die AniDachi-Erweiterung für Chrome"
        description="Installiere die offizielle AniDachi-Erweiterung aus dem Chrome Web Store und öffne dann eine Seite auf Crunchyroll, YouTube oder Netflix."
        steps={deExtensionHowToSteps}
      />
      <HowToJsonLd
        name="So schaut ihr zusammen"
        description="Veranstalte einen Live-Raum für Crunchyroll, YouTube oder Netflix mit Free (20 Minuten pro UTC-Tag für bis zu 4 Personen), Plus oder Pro. Freunde treten kostenlos bei."
        steps={deExtensionUsingSteps.map(({ name, text }) => ({ name, text }))}
      />
      <main id="main-content" className="min-h-screen bg-ani-canvas">
        <nav aria-label={UI_STRINGS.de.breadcrumb} className="border-b border-ani-line bg-ani-canvas">
          <div className="container mx-auto px-4 py-3.5 text-sm text-ani-muted">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link href="/de" className="hover:text-ani-text">
                  Startseite
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="font-medium text-ani-text">Chrome-Erweiterung</li>
            </ol>
          </div>
        </nav>
        <div className="mx-auto max-w-[1200px] px-5 pb-16 sm:px-8">
          <Suspense
            fallback={
              <div className="mx-auto max-w-4xl py-16 text-center">
                <p className="text-4xl font-semibold tracking-[-0.035em] text-ani-text">
                  AniDachi zu Chrome hinzufügen
                </p>
              </div>
            }
          >
            <ExtensionInstallHub artifact={artifact} locale="de" />
          </Suspense>
        </div>
      </main>
    </>
  );
}
