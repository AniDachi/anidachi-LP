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
    "Install the official AniDachi Chrome extension from the Chrome Web Store for Crunchyroll and YouTube watchrooms. Netflix is coming soon.",
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
      "Install the official AniDachi Chrome extension from the Chrome Web Store for Crunchyroll and YouTube watchrooms. Netflix is coming soon.",
    url: INSTALL_HUB_PATH,
  },
  twitter: {
    images: ["/opengraph-image.png"],

    card: "summary_large_image",
    title: "Install AniDachi on Chrome",
    description:
      "Install the official AniDachi Chrome extension from the Chrome Web Store for Crunchyroll and YouTube watchrooms. Netflix is coming soon.",
  },
};

const howToSteps = [
  {
    name: "Add the extension",
    text: "On the Chrome Web Store page, choose Add to Chrome, then Add extension.",
  },
  {
    name: "Pin AniDachi",
    text: "Open the puzzle-piece menu in Chrome’s toolbar. Find AniDachi and click the pin.",
  },
  {
    name: "Open a video & sign in",
    text: "Open a supported video page, click the AniDachi capsule in the player, and sign in.",
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
        description="Install the official AniDachi Chrome extension from the Chrome Web Store, then open a Crunchyroll or YouTube watch page. Netflix is coming soon."
        steps={howToSteps}
      />
      <HowToJsonLd
        name="How to Watch Together"
        description="Host a live Crunchyroll or YouTube room with Plus or Pro, including during a trial. Friends join for free. Netflix is coming soon. Use the overlay for invites, calls, reactions, and room settings."
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
        <div className="mx-auto max-w-[1200px] px-5 pb-16 sm:px-8">
          <Suspense
            fallback={
              <div className="mx-auto max-w-4xl py-16 text-center">
                <h1 className="text-4xl font-semibold tracking-[-0.035em] text-ani-text">
                  Add AniDachi to Chrome
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
