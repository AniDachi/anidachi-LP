import type { Viewport } from "next";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { extensionPreviewFont } from "@/components/extension-preview-font";
import { Footer } from "@/components/footer";
import { NavBar } from "@/components/nav-bar";
import {
  ConditionalFooter,
  ConditionalNav,
} from "@/components/conditional-site-chrome";
import { AnalyticsEvents } from "@/components/analytics-events";
import { OrganizationJsonLd } from "@/components/json-ld";
import { MobileInstallProvider } from "@/components/mobile-install-panel";
import { GA_MEASUREMENT_ID } from "@/lib/gtag";
import { buildGaBootstrapScript } from "@/lib/analytics-env";
import {
  ANIDACHI_OG_IMAGE_ALT,
  ANIDACHI_OG_IMAGE_PATH,
} from "@/lib/brand";
import {
  getSeoSiteOrigin,
  isRobotsIndexingDisabled,
} from "@/lib/site-url";
import "./globals.css";
import { EXTENSION_BROWSER_LABEL } from "@/lib/extension-store";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const shouldNoindex = isRobotsIndexingDisabled();

export const metadata: Metadata = {
  title: {
    default:
      "Watch Party App: Watch Movies, Shows & Anime Together Online",
    template: "%s | AniDachi",
  },
  description:
    `Watch movies, shows and anime together online. AniDachi is a watch party extension for Netflix, Crunchyroll and YouTube in ${EXTENSION_BROWSER_LABEL}. Friends join free.`,
  metadataBase: new URL(getSeoSiteOrigin()),
  // No root canonical: a page without its own `alternates.canonical` must not inherit the homepage URL.
  openGraph: {
    title:
      "Watch Party App: Watch Movies, Shows & Anime Together Online",
    description:
      `Watch movies, shows and anime together online. A watch party extension for Netflix, Crunchyroll and YouTube in ${EXTENSION_BROWSER_LABEL}.`,
    type: "website",
    siteName: "AniDachi",
    images: [
      {
        url: ANIDACHI_OG_IMAGE_PATH,
        width: 1200,
        height: 630,
        alt: ANIDACHI_OG_IMAGE_ALT,
      },
    ],
  },
  // No root twitter title/description: cards fall back to each page's og:title and og:description.
  twitter: {
    card: "summary_large_image",
    images: [ANIDACHI_OG_IMAGE_PATH],
  },
  robots: {
    index: !shouldNoindex,
    follow: !shouldNoindex,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth" data-ani-theme="account" data-scroll-behavior="smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${extensionPreviewFont.variable} antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:rounded-full focus:bg-ani-primary focus:px-4 focus:py-2 focus:text-ani-on-primary focus:outline-2 focus:outline-offset-4 focus:outline-ani-focus"
        >
          Skip to main content
        </a>
        <Script id="google-analytics" strategy="afterInteractive">
          {buildGaBootstrapScript(GA_MEASUREMENT_ID)}
        </Script>
        <MobileInstallProvider>
          <ConditionalNav marketingNav={<NavBar />} />
          {children}
          <ConditionalFooter marketingFooter={<Footer />} />
        </MobileInstallProvider>
        <OrganizationJsonLd />
        <AnalyticsEvents />
      </body>
    </html>
  );
}
