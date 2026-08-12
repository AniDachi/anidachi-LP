import type { Metadata } from "next";
import Link from "next/link";
import { FeatureRequestForm } from "@/components/feature-request-form";

export const metadata: Metadata = {
  title: "Feature Requests",
  robots: { index: false, follow: false },
};

export default function AccountFeatureRequestsPage() {
  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-2xl border border-brand-border/80 bg-brand-surface p-5 sm:p-7">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_0%_0%,oklch(0.71_0.20_45_/_0.12),transparent_55%)]"
        />
        <div className="relative">
          <h2 className="text-xl font-bold tracking-[-0.02em] text-foreground sm:text-2xl">
            Feature requests
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-foreground/65 sm:text-base">
            Tell us what would make Crunchyroll or YouTube watchrooms better for
            your group. We read every submission.
          </p>
          <div className="mt-6">
            <FeatureRequestForm />
          </div>
          <p className="mt-6 text-sm text-foreground/45">
            Need help instead?{" "}
            <Link href="/contact" className="text-brand-orange hover:underline">
              Contact support
            </Link>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
