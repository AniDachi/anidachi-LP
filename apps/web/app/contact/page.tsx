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
          <p className="text-xl font-semibold tracking-[-0.03em] text-ani-text">
            AniDachi
          </p>
        </div>

        <h1 className="mb-4 text-balance text-4xl font-semibold tracking-[-0.03em] text-ani-text md:text-5xl md:leading-[1.08]">
          Contact
        </h1>
        <p className="mb-10 max-w-xl text-pretty text-lg leading-relaxed text-ani-muted">
          We are a small team. Send a message below — include the page URL,
          browser, and extension version when it helps.
        </p>

        <div className="relative mb-10 overflow-hidden rounded-[20px] border border-ani-line bg-ani-panel px-5 py-6 sm:px-7">
          <ContactForm />
        </div>

        <div className="space-y-3 text-sm leading-relaxed text-ani-muted">
          <p>
            Product ideas?{" "}
            <Link
              href="/feature-requests"
              className="text-ani-text underline decoration-ani-line underline-offset-2 hover:text-ani-primary"
            >
              Submit a feature request
            </Link>
            .
          </p>
          <p>
            Privacy details:{" "}
            <Link href="/privacy" className="text-ani-text underline decoration-ani-line underline-offset-2 hover:text-ani-primary">
              Privacy Policy
            </Link>
            . Security notes:{" "}
            <Link href="/security" className="text-ani-text underline decoration-ani-line underline-offset-2 hover:text-ani-primary">
              Security &amp; permissions
            </Link>
            . Editorial process:{" "}
            <Link
              href="/editorial-policy"
              className="text-ani-text underline decoration-ani-line underline-offset-2 hover:text-ani-primary"
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
