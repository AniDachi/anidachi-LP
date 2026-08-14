import type { Metadata } from "next";
import Link from "next/link";
import { AnidachiLogo } from "@/components/anidachi-logo";
import { ContactForm } from "@/components/contact-form";

export const metadata: Metadata = {
  title: "Contact AniDachi",
  description:
    "Contact AniDachi for product support, privacy requests, security reports, and press questions.",
  alternates: { canonical: "/contact" },
  openGraph: {
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "AniDachi – watch anime together, in perfect sync",
      },
    ],

    title: "Contact AniDachi",
    description:
      "Support, privacy, security, and press contact channels for AniDachi.",
    url: "/contact",
  },
};

export default function ContactPage() {
  return (
    <main id="main-content" className="min-h-screen bg-background">
      <article className="container mx-auto max-w-2xl px-4 py-14 lg:py-20">
        <div className="mb-8 flex items-center gap-3">
          <AnidachiLogo size={40} priority />
          <p className="text-xl font-bold tracking-[-0.03em] text-foreground">
            AniDachi
          </p>
        </div>

        <h1 className="mb-4 text-balance text-4xl font-bold tracking-[-0.03em] text-foreground md:text-5xl md:leading-[1.08]">
          Contact
        </h1>
        <p className="mb-10 max-w-xl text-pretty text-lg leading-relaxed text-foreground/70">
          We are a small team. Send a message below — include the page URL,
          browser, and extension version when it helps.
        </p>

        <div className="relative mb-10 overflow-hidden rounded-2xl border border-brand-border/80 bg-brand-surface px-5 py-6 sm:px-7">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_0%_0%,oklch(0.71_0.20_45_/_0.12),transparent_55%)]"
          />
          <div className="relative">
            <ContactForm />
          </div>
        </div>

        <div className="space-y-3 text-sm leading-relaxed text-foreground/55">
          <p>
            Product ideas?{" "}
            <Link
              href="/feature-requests"
              className="text-brand-orange hover:underline"
            >
              Submit a feature request
            </Link>
            .
          </p>
          <p>
            Privacy details:{" "}
            <Link href="/privacy" className="text-brand-orange hover:underline">
              Privacy Policy
            </Link>
            . Security notes:{" "}
            <Link href="/security" className="text-brand-orange hover:underline">
              Security &amp; permissions
            </Link>
            . Editorial process:{" "}
            <Link
              href="/editorial-policy"
              className="text-brand-orange hover:underline"
            >
              Editorial Policy
            </Link>
            .
          </p>
        </div>
      </article>
    </main>
  );
}
