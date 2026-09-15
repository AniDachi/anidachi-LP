import type { Viewport } from "next";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Footer } from "@/components/footer";
import { NavBar } from "@/components/nav-bar";
import {
  ConditionalFooter,
  ConditionalNav,
} from "@/components/conditional-site-chrome";
import { AnalyticsEvents } from "@/components/analytics-events";
import { OrganizationJsonLd } from "@/components/json-ld";
import { GA_MEASUREMENT_ID } from "@/lib/gtag";
import {
  ANIDACHI_OG_IMAGE_ALT,
  ANIDACHI_OG_IMAGE_PATH,
} from "@/lib/brand";
import {
  getResolvedSiteOrigin,
  isRobotsIndexingDisabled,
} from "@/lib/site-url";
import "./globals.css";

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
      "AniDachi – Watch Together | Sync Crunchyroll & YouTube with Friends",
    template: "%s | AniDachi",
  },
  description:
    "AniDachi lets you watch together with friends on Crunchyroll and YouTube. Create watchrooms, sync playback, and chat in real-time. Async catch-up is coming soon in a later batch.",
  metadataBase: new URL(getResolvedSiteOrigin()),
  alternates: { canonical: "/" },
  openGraph: {
    title:
      "AniDachi – Watch Together | Sync Crunchyroll & YouTube with Friends",
    description:
      "Create watchrooms for Crunchyroll and YouTube, sync with friends, and chat in real-time. Async catch-up is coming soon.",
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
  twitter: {
    card: "summary_large_image",
    title: "AniDachi – Watch Anime Together",
    description:
      "Watchrooms for Crunchyroll and YouTube — live sync and chat in desktop Chrome. Async catch-up coming soon.",
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
    <html lang="en" className="dark scroll-smooth" data-ani-theme="account">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:rounded-full focus:bg-ani-primary focus:px-4 focus:py-2 focus:text-ani-on-primary focus:outline-2 focus:outline-offset-4 focus:outline-ani-focus"
        >
          Skip to main content
        </a>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        <ConditionalNav marketingNav={<NavBar />} />
        {children}
        <ConditionalFooter marketingFooter={<Footer />} />
        <OrganizationJsonLd />
        <AnalyticsEvents />
      </body>
    </html>
  );
}
