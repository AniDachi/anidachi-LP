import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ExtensionInstallHub } from "@/components/extension-install-hub";
import {
  BreadcrumbJsonLd,
  FAQPageJsonLd,
  HowToJsonLd,
} from "@/components/json-ld";
import {
  getExtensionArtifact,
  toPublicExtensionArtifact,
} from "@/lib/extension-artifact";
import { extensionInstallFaq } from "@/lib/extension-install-faq";
import { extensionUsingSteps } from "@/lib/extension-using-guide";
import { CHROME_EXTENSIONS_PAGE, INSTALL_HUB_PATH } from "@/lib/install-cta";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Install AniDachi Chrome Extension (Manual Download)",
  description:
    "Download the official AniDachi Chrome extension zip and Load unpacked in Developer mode. Crunchyroll and YouTube watchrooms. Chrome Web Store listing is in review, including publisher verification.",
  alternates: { canonical: INSTALL_HUB_PATH },
  openGraph: {
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "AniDachi – watch anime together, in perfect sync",
      },
    ],

    title: "Install AniDachi on Chrome",
    description:
      "Official zip from anidachi.app. Load unpacked in Chrome while the Web Store listing goes through Chrome’s standard review, including publisher verification.",
    url: INSTALL_HUB_PATH,
  },
  twitter: {
    images: ["/opengraph-image.png"],

    card: "summary_large_image",
    title: "Install AniDachi on Chrome",
    description:
      "Download the official zip and Load unpacked in desktop Chrome. Crunchyroll and YouTube watchrooms.",
  },
};

const howToSteps = [
  {
    name: "Download the official zip",
    text: "Download AniDachi from https://www.anidachi.app/extension only. Do not use a third-party file.",
  },
  {
    name: "Unzip the folder",
    text: "Unzip the file. Load unpacked must point at the folder that contains manifest.json, not the zip itself.",
  },
  {
    name: "Open Chrome extensions",
    text: `In Chrome, open ${CHROME_EXTENSIONS_PAGE} (paste it in the address bar).`,
  },
  {
    name: "Turn on Developer mode",
    text: "On the Extensions page, the Developer mode toggle is in the top-right, to the right of the search bar. Turn it on (it turns blue).",
  },
  {
    name: "Load unpacked",
    text: "With Developer mode on, click Load unpacked — the first button on the left under the header (Load unpacked, Pack extension, Update). Select the unzipped folder that contains manifest.json, not the zip.",
  },
  {
    name: "Pin and open Crunchyroll or YouTube",
    text: "Click the puzzle-piece icon in Chrome’s toolbar (top-right, next to your profile). Find AniDachi and click the pin on the right of that row so it stays in the toolbar. Then open a Crunchyroll title or a full YouTube watch page and sign in when the extension asks.",
  },
];

export default function ExtensionInstallPage() {
  const artifact = toPublicExtensionArtifact(getExtensionArtifact());

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Chrome extension", url: INSTALL_HUB_PATH },
        ]}
      />
      <FAQPageJsonLd questions={extensionInstallFaq} />
      <HowToJsonLd
        name="How to install the AniDachi Chrome extension"
        description="Download the official zip from AniDachi and Load unpacked in Chrome Developer mode while the Chrome Web Store listing goes through standard review, including publisher verification."
        steps={howToSteps}
      />
      <HowToJsonLd
        name="How to Watch Together"
        description="Live sync on Crunchyroll or YouTube: open the overlay bubble, create a room, assign media seats, then set Reactions, Layout, Voice, Interface, and Room defaults."
        steps={extensionUsingSteps.map(({ name, text }) => ({ name, text }))}
      />
      <main id="main-content" className="min-h-screen bg-ani-canvas">
        <nav
          aria-label="Breadcrumb"
          className="border-b border-ani-line bg-ani-canvas"
        >
          <div className="container mx-auto px-4 py-3.5 text-sm text-ani-muted">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link href="/" className="hover:text-ani-text">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="font-medium text-ani-text">Chrome extension</li>
            </ol>
          </div>
        </nav>
        <div className="container mx-auto px-4 py-12 lg:py-16">
          <Suspense
            fallback={
              <div className="mx-auto max-w-3xl">
                <h1 className="text-4xl font-semibold tracking-[-0.035em] text-ani-text">
                  Install AniDachi on Chrome
                </h1>
              </div>
            }
          >
            <ExtensionInstallHub artifact={artifact} />
          </Suspense>
        </div>
      </main>
    </>
  );
}
