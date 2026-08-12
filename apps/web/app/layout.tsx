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
import { PlanSurveyProvider } from "@/components/plan-survey/plan-survey-provider";
import { GA_MEASUREMENT_ID } from "@/lib/gtag";
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
    "AniDachi lets you watch together with friends on Crunchyroll and YouTube. Create watchrooms, sync playback, chat in real-time, and catch up asynchronously.",
  metadataBase: new URL(getResolvedSiteOrigin()),
  alternates: { canonical: "/" },
  openGraph: {
    title:
      "AniDachi – Watch Together | Sync Crunchyroll & YouTube with Friends",
    description:
      "Create watchrooms for Crunchyroll and YouTube, sync with friends, chat in real-time, and track progress — even asynchronously.",
    type: "website",
    siteName: "AniDachi",
  },
  twitter: {
    card: "summary_large_image",
    title: "AniDachi – Watch Anime Together",
    description:
      "Watchrooms for Crunchyroll and YouTube — sync, chat, and async catch-up in desktop Chrome.",
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
    <html lang="en" className="dark scroll-smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-brand-orange focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded"
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
        <PlanSurveyProvider>
          <ConditionalNav marketingNav={<NavBar />} />
          {children}
          <ConditionalFooter marketingFooter={<Footer />} />
          <OrganizationJsonLd />
          <AnalyticsEvents />
        </PlanSurveyProvider>
      </body>
    </html>
  );
}
