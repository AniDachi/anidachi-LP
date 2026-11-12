import type { Metadata } from "next";
import { languageAlternates } from "@/lib/hreflang";
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
import { cookies } from "next/headers";
import { getSession } from "@/lib/anidachi-auth/session";
import { REFRESH_TOKEN_COOKIE } from "@/lib/anidachi-auth/cookies";
import { resolveWebsiteSession } from "@/lib/anidachi-auth/website-session";
import { createBillingService } from "@/lib/anidachi-auth/billing";
import { loadExtensionWelcome } from "@/lib/anidachi-auth/extension-welcome-snapshot";
import { readApprovedExtensionClientId } from "@/lib/anidachi-auth/extension-codes";
import { type ExtensionWelcome } from "@/lib/extension-welcome";

export const dynamic = "force-dynamic";

const metadata: Metadata = {
  title: { absolute: "Install AniDachi — Chrome Extension for Watch Parties" },
  description:
    "Install the official AniDachi Chrome extension from the Chrome Web Store for Crunchyroll, YouTube, and Netflix watchrooms.",
  alternates: languageAlternates({ en: INSTALL_HUB_PATH, de: "/de/erweiterung" }, "en"),
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
      "Install the official AniDachi Chrome extension from the Chrome Web Store for Crunchyroll, YouTube, and Netflix watchrooms.",
    url: INSTALL_HUB_PATH,
  },
  twitter: {
    images: ["/opengraph-image.png"],

    card: "summary_large_image",
    title: "Install AniDachi on Chrome",
    description:
      "Install the official AniDachi Chrome extension from the Chrome Web Store for Crunchyroll, YouTube, and Netflix watchrooms.",
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

type PageProps = {
	searchParams?: Promise<Record<string, string | string[] | undefined>>;
};
export async function generateMetadata({
	searchParams,
}: PageProps): Promise<Metadata> {
	return (await searchParams)?.welcome === "1"
		? { ...metadata, robots: { index: false, follow: false } }
		: metadata;
}

export default async function ExtensionInstallPage({
	searchParams,
}: PageProps) {
	const artifact = toPublicExtensionArtifact(getExtensionArtifact());
	let welcome: ExtensionWelcome | undefined;
	let owner: string | undefined;
	if ((await searchParams)?.welcome === "1") {
		try {
			const session = await getSession();
			owner = session?.userId;
			if (!session) welcome = { kind: "sign_in" };
			else {
				welcome = await loadExtensionWelcome(session.userId, {
					websiteUser: async () =>
						resolveWebsiteSession(
							(await cookies()).get(REFRESH_TOKEN_COOKIE)?.value,
						),
					overview: (userId) => createBillingService().overview(userId),
				});
			}
		} catch {
			welcome = { kind: "error" };
		}
	}

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
        description="Install the official AniDachi Chrome extension from the Chrome Web Store, then open a Crunchyroll, YouTube, or Netflix watch page."
        steps={howToSteps}
      />
      <HowToJsonLd
        name="How to Watch Together"
        description="Host a live Crunchyroll, YouTube, or Netflix room on Free (20 host minutes per UTC day for up to 4 people), Plus, or Pro. Friends join for free. Use the overlay for invites, calls, reactions, and room settings."
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
                <p className="text-4xl font-semibold tracking-[-0.035em] text-ani-text">
                  Add AniDachi to Chrome
                </p>
              </div>
            }
          >
            <ExtensionInstallHub key={owner ?? "public"} artifact={artifact} welcome={welcome}
              extensionId={welcome ? readApprovedExtensionClientId() : null} />
          </Suspense>
        </div>
      </main>
    </>
  );
}
