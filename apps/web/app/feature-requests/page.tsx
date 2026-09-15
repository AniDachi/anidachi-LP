import type { Metadata } from "next";
import Link from "next/link";
import { AnidachiLogo } from "@/components/anidachi-logo";
import { FeatureRequestForm } from "@/components/feature-request-form";

export const metadata: Metadata = {
  title: "Feature Requests — AniDachi",
  description:
    "Submit product ideas for AniDachi watchrooms on Crunchyroll and YouTube. We read every request.",
  alternates: { canonical: "/feature-requests" },
  openGraph: {
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "AniDachi – watch anime together, in perfect sync",
      },
    ],

    title: "Feature Requests — AniDachi",
    description:
      "Tell us what would make your Crunchyroll or YouTube watch parties better.",
    url: "/feature-requests",
  },
};

export default function FeatureRequestsPage() {
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
          Feature requests
        </h1>
        <p className="mb-10 max-w-xl text-pretty text-lg leading-relaxed text-ani-muted">
          Tell us what would make Crunchyroll or YouTube watchrooms better for
          your group. We read every submission — this is not a support ticket
          queue.
        </p>

        <div className="relative mb-10 overflow-hidden rounded-[20px] border border-ani-line bg-ani-panel px-5 py-6 sm:px-7">
          <FeatureRequestForm />
        </div>

        <p className="text-sm leading-relaxed text-ani-muted">
          Need help with billing, install, or a bug? Use{" "}
          <Link href="/contact" className="text-ani-text underline decoration-ani-line underline-offset-2 hover:text-ani-primary">
            Contact
          </Link>{" "}
          instead.
        </p>
      </article>
    </main>
  );
}
