import type { Metadata } from "next";
import Link from "next/link";
import { Pricing } from "@/components/pricing";
import { FAQSection } from "@/components/faq-section";
import { BreadcrumbJsonLd, FAQPageJsonLd } from "@/components/json-ld";
import { SocialProof } from "@/components/social-proof";
import {
  PRICING_FRIENDS_NEED_SUBSCRIPTION_ANSWER,
  PRICING_IS_ANIDACHI_FREE_ANSWER,
  PRICING_PLUS_VS_PRO_ANSWER,
  PRICING_CANCELLATION_NOTE,
  PRICING_STARTING_AT,
} from "@/lib/pricing-copy";

export const metadata: Metadata = {
  title: "AniDachi Pricing — Free, Plus & Pro Plans (2026)",
  description:
    "AniDachi pricing for Crunchyroll and YouTube watchrooms. Free to join. Plus and Pro raise host limits and unlock personal history. Subscribe now and keep this rate.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "AniDachi – watch anime together, in perfect sync",
      },
    ],

    title: "AniDachi Pricing — Free, Plus & Pro",
    description:
      "Compare Free, Plus, and Pro for Crunchyroll and YouTube watchrooms. Subscribe now and keep this rate.",
    url: "/pricing",
  },
  twitter: {
    images: ["/opengraph-image.png"],

    card: "summary_large_image",
    title: "AniDachi Pricing — Free, Plus & Pro",
    description:
      "Friends join free. Hosts upgrade for unlimited Crunchyroll or YouTube watchrooms starting at " +
      PRICING_STARTING_AT +
      ".",
  },
};

const faq = [
  {
    question: "Is AniDachi free?",
    answer: PRICING_IS_ANIDACHI_FREE_ANSWER,
  },
  {
    question: "Do my friends need a paid AniDachi subscription?",
    answer: PRICING_FRIENDS_NEED_SUBSCRIPTION_ANSWER,
  },
  {
    question: "What's the difference between Plus and Pro?",
    answer: PRICING_PLUS_VS_PRO_ANSWER,
  },
  {
    question: "Can I get a refund?",
    answer: PRICING_CANCELLATION_NOTE,
  },
  {
    question: "Do I still need Crunchyroll or YouTube?",
    answer:
      "Yes. Each person streams under their own Crunchyroll or YouTube account. AniDachi adds watchrooms, sync, chat, and personal history on paid plans — it does not replace a streaming subscription.",
  },
];

export default function PricingPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Pricing", url: "/pricing" },
        ]}
      />
      <FAQPageJsonLd questions={faq} />
      <main className="min-h-screen bg-ani-canvas">
        <nav
          aria-label="Breadcrumb"
          className="border-b border-ani-line bg-ani-canvas"
        >
          <div className="container mx-auto px-4 py-3.5 text-sm tracking-[-0.01em] text-ani-muted">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link
                  href="/"
                  className="transition-colors duration-200 hover:text-ani-text"
                >
                  Home
                </Link>
              </li>
              <li className="text-ani-line" aria-hidden="true">
                /
              </li>
              <li className="font-medium text-ani-text">Pricing</li>
            </ol>
          </div>
        </nav>

        <Pricing headingLevel={1} showPlanMatrix />
        <SocialProof />
        <FAQSection
          title="Pricing FAQ"
          questions={faq}
          defaultOpenIndexes={[0]}
        />
        <section className="container mx-auto max-w-3xl px-4 pb-16 text-center text-sm text-ani-muted">
          <p>
            Looking for how watch parties work? See{" "}
            <Link
              href="/watch-crunchyroll-together"
              className="font-medium text-ani-text underline decoration-ani-line underline-offset-2 hover:text-ani-primary"
            >
              watch Crunchyroll together
            </Link>
            ,{" "}
            <Link
              href="/watch-youtube-together"
              className="font-medium text-ani-text underline decoration-ani-line underline-offset-2 hover:text-ani-primary"
            >
              YouTube watch party
            </Link>
            , or{" "}
            <Link
              href="/guides/best-watch-party-apps-for-anime"
              className="font-medium text-ani-text underline decoration-ani-line underline-offset-2 hover:text-ani-primary"
            >
              best watch party apps for anime
            </Link>
            .
          </p>
        </section>
      </main>
    </>
  );
}
