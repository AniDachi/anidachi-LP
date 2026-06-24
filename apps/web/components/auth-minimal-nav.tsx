import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AnidachiLogoLink } from "@/components/anidachi-logo";

export function AuthMinimalNav() {
  return (
    <nav
      aria-label="Authentication"
      className="sticky top-0 z-[90] border-b border-brand-border bg-background/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex min-h-14 max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <AnidachiLogoLink
          size={28}
          wordmarkClassName="text-foreground"
          className="min-h-11"
          priority
        />
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-foreground/60 transition-colors hover:text-brand-orange-bright"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to home
        </Link>
      </div>
    </nav>
  );
}
