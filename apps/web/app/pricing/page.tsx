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
  PRICING_REFUND_NOTE,
  PRICING_STARTING_AT,
} from "@/lib/pricing-copy";

export const metadata: Metadata = {
  title: "AniDachi Pricing — Free, Plus & Pro Plans (2026)",
  description:
    "AniDachi pricing for Crunchyroll and YouTube watchrooms. Friends join free. Plus and Pro unlock unlimited hosting, async rooms, and larger groups — pre-launch rates locked forever.",
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
      "Compare Free, Plus, and Pro for Crunchyroll and YouTube watchrooms. Pre-launch pricing locked forever.",
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
    answer: PRICING_REFUND_NOTE,
  },
  {
    question: "Do I still need Crunchyroll or YouTube?",
    answer:
      "Yes. Each person streams under their own Crunchyroll or YouTube account. AniDachi adds watchrooms, sync, chat, and async progress on top — it does not replace a streaming subscription.",
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
      <main className="min-h-screen bg-background">
        <nav
          aria-label="Breadcrumb"
          className="border-b border-brand-border/80 bg-brand-surface/80"
        >
          <div className="container mx-auto px-4 py-3.5 text-sm tracking-[-0.01em] text-foreground/50">
            <ol className="flex flex-wrap items-center gap-2">
              <li>
                <Link
                  href="/"
                  className="transition-colors duration-200 hover:text-brand-orange-bright"
                >
                  Home
                </Link>
              </li>
              <li className="text-foreground/30" aria-hidden="true">
                /
              </li>
              <li className="font-medium text-foreground">Pricing</li>
            </ol>
          </div>
        </nav>

        <div className="container mx-auto max-w-3xl px-4 pb-2 pt-10 text-center lg:pt-14">
          <p className="mx-auto max-w-2xl text-pretty text-base leading-relaxed text-foreground/70 md:text-lg">
            Pre-launch rates for Crunchyroll anime nights and YouTube hangs —
            friends join free while hosts unlock unlimited rooms.
          </p>
        </div>

        <Pricing headingLevel={1} />
        <SocialProof />
        <FAQSection
          title="Pricing FAQ"
          questions={faq}
          defaultOpenIndexes={[0]}
        />
        <section className="container mx-auto max-w-3xl px-4 pb-16 text-center text-sm text-foreground/60">
          <p>
            Looking for how watch parties work? See{" "}
            <Link
              href="/watch-crunchyroll-together"
              className="font-medium text-brand-orange hover:underline"
            >
              watch Crunchyroll together
            </Link>
            ,{" "}
            <Link
              href="/watch-youtube-together"
              className="font-medium text-brand-orange hover:underline"
            >
              YouTube watch party
            </Link>
            , or{" "}
            <Link
              href="/guides/best-watch-party-apps-for-anime"
              className="font-medium text-brand-orange hover:underline"
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
