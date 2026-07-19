import type { Metadata } from "next";
import Link from "next/link";
import { Pricing } from "@/components/pricing";
import { FAQSection } from "@/components/faq-section";
import { BreadcrumbJsonLd, FAQPageJsonLd } from "@/components/json-ld";
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
    "AniDachi pricing for anime watch parties on Crunchyroll. Friends join free. Plus and Pro unlock unlimited hosting, async rooms, and larger groups — pre-launch rates locked forever.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "AniDachi Pricing — Free, Plus & Pro",
    description:
      "Compare Free, Plus, and Pro. Pre-launch pricing locked forever with a full refund before launch.",
    url: "/pricing",
  },
  twitter: {
    card: "summary_large_image",
    title: "AniDachi Pricing — Free, Plus & Pro",
    description:
      "Friends join free. Hosts upgrade for unlimited Crunchyroll watchrooms starting at " +
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
    question: "Do I still need Crunchyroll?",
    answer:
      "Yes. Each person streams anime under their own Crunchyroll account. AniDachi adds watchrooms, sync, chat, and async progress on top — it does not replace a streaming subscription.",
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
          className="container mx-auto px-4 pt-8 text-sm text-foreground/50"
        >
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="hover:text-brand-orange transition-colors">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-foreground/80">Pricing</li>
          </ol>
        </nav>
        <Pricing headingLevel={1} />
        <FAQSection
          title="Pricing FAQ"
          questions={faq}
          defaultOpenIndexes={[0]}
        />
        <section className="container mx-auto max-w-3xl px-4 pb-16 text-center text-sm text-foreground/60">
          <p>
            Looking for how watch parties work? See{" "}
            <Link
              href="/anime-watch-party"
              className="text-brand-orange font-medium hover:underline"
            >
              anime watch party
            </Link>
            ,{" "}
            <Link
              href="/watch-crunchyroll-together"
              className="text-brand-orange font-medium hover:underline"
            >
              watch Crunchyroll together
            </Link>
            , or{" "}
            <Link
              href="/guides/best-watch-party-apps-for-anime"
              className="text-brand-orange font-medium hover:underline"
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
