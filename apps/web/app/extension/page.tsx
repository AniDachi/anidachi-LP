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
import { INSTALL_HUB_PATH } from "@/lib/install-cta";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Install AniDachi Chrome Extension",
  description:
    "Install the official AniDachi Chrome extension from the Chrome Web Store for Crunchyroll and YouTube watchrooms.",
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
      "Install the official AniDachi Chrome extension from the Chrome Web Store for Crunchyroll and YouTube watchrooms.",
    url: INSTALL_HUB_PATH,
  },
  twitter: {
    images: ["/opengraph-image.png"],

    card: "summary_large_image",
    title: "Install AniDachi on Chrome",
    description:
      "Install the official AniDachi Chrome extension from the Chrome Web Store for Crunchyroll and YouTube watchrooms.",
  },
};

const howToSteps = [
  {
    name: "Install from the Chrome Web Store",
    text: "Open the official AniDachi Chrome Web Store listing and choose Add to Chrome.",
  },
  {
    name: "Pin and open Crunchyroll or YouTube",
    text: "Click the puzzle-piece icon in Chrome’s toolbar, find AniDachi, and pin it. Then open a Crunchyroll title or a full YouTube watch page and sign in when the extension asks.",
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
        description="Install the official AniDachi Chrome extension from the Chrome Web Store, then open a Crunchyroll or YouTube watch page."
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
