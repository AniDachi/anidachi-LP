import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Display title for SEO guide H1 — keeps intent copy, tightens type. */
export function SeoGuideTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h1
      className={cn(
        "mb-6 max-w-[22ch] text-balance text-4xl font-bold tracking-[-0.03em] text-foreground md:mb-8 md:max-w-none md:text-5xl md:leading-[1.08]",
        className,
      )}
    >
      {children}
    </h1>
  );
}

/**
 * Short-answer / verdict plane. One surface, not a card grid.
 * Soft warm wash from brand orange — no thick accent borders.
 */
export function SeoGuideAnswer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "not-prose relative mb-10 overflow-hidden rounded-2xl border border-brand-border/80 bg-brand-surface px-5 py-5 sm:px-7 sm:py-6",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_0%_0%,oklch(0.71_0.20_45_/_0.14),transparent_55%)]"
      />
      <div className="relative text-lg leading-relaxed text-foreground/85 sm:text-xl sm:leading-relaxed [&_a]:font-medium [&_a]:text-brand-orange [&_a]:underline-offset-2 hover:[&_a]:text-brand-orange-bright hover:[&_a]:underline [&_strong]:font-semibold [&_strong]:text-foreground">
        {children}
      </div>
    </div>
  );
}

export type SeoGuideOption = {
  title: string;
  body: ReactNode;
  /** Soft emphasis for the recommended path */
  highlight?: boolean;
};

/** Stacked option rows — asymmetric editorial list, not equal icon cards. */
export function SeoGuideOptions({
  options,
  className,
}: {
  options: SeoGuideOption[];
  className?: string;
}) {
  return (
    <ul className={cn("not-prose mb-10 space-y-3", className)}>
      {options.map((option) => (
        <li
          key={option.title}
          className={cn(
            "rounded-xl border px-4 py-4 transition-[transform,border-color,background-color] duration-200 ease-out sm:px-5",
            option.highlight
              ? "border-brand-orange/35 bg-brand-orange/[0.06]"
              : "border-brand-border/70 bg-background/40 hover:border-brand-border hover:bg-brand-surface/60",
          )}
        >
          <p className="text-[0.95rem] font-semibold tracking-[-0.01em] text-foreground sm:text-base">
            {option.title}
          </p>
          <div className="mt-1.5 text-[0.95rem] leading-relaxed text-foreground/75 [&_a]:font-medium [&_a]:text-brand-orange [&_a]:underline-offset-2 hover:[&_a]:underline">
            {option.body}
          </div>
        </li>
      ))}
    </ul>
  );
}

export type SeoGuideStep = {
  name: string;
  text: ReactNode;
};

/** Ordered steps when sequence itself carries meaning (HowTo pages). */
export function SeoGuideSteps({
  steps,
  className,
}: {
  steps: SeoGuideStep[];
  className?: string;
}) {
  return (
    <ol className={cn("not-prose mb-10 space-y-4", className)}>
      {steps.map((step, index) => (
        <li key={step.name} className="flex gap-4 sm:gap-5">
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-orange/15 font-mono text-sm font-semibold tabular-nums text-brand-orange-bright"
            aria-hidden
          >
            {index + 1}
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="font-semibold tracking-[-0.01em] text-foreground">
              {step.name}
            </p>
            <div className="mt-1 text-[0.95rem] leading-relaxed text-foreground/75 [&_a]:font-medium [&_a]:text-brand-orange [&_a]:underline-offset-2 hover:[&_a]:underline">
              {step.text}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Symptom / bullet list with stronger title/body split. */
export function SeoGuideBulletList({
  items,
  className,
}: {
  items: { title?: string; body: ReactNode }[];
  className?: string;
}) {
  return (
    <ul className={cn("not-prose mb-10 space-y-3", className)}>
      {items.map((item, i) => (
        <li
          key={item.title ?? i}
          className="grid grid-cols-[auto_1fr] gap-x-3 text-[0.95rem] leading-relaxed text-foreground/75"
        >
          <span
            className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-brand-orange/70"
            aria-hidden
          />
          <span>
            {item.title ? (
              <strong className="font-semibold text-foreground">
                {item.title}
              </strong>
            ) : null}
            {item.title ? " — " : null}
            {item.body}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Soft aside for Discord / voice / caveat notes. */
export function SeoGuideNote({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "not-prose mb-10 rounded-xl border border-brand-border/60 bg-muted/40 px-5 py-4 text-[0.95rem] leading-relaxed text-foreground/75 [&_a]:font-medium [&_a]:text-brand-orange [&_a]:underline-offset-2 hover:[&_a]:underline",
        className,
      )}
    >
      {children}
    </aside>
  );
}

export type SeoGuideRelatedLink = {
  href: string;
  label: string;
};

/** Related cluster as navigable rows with hover affordance. */
export function SeoGuideRelated({
  links,
  className,
}: {
  links: SeoGuideRelatedLink[];
  className?: string;
}) {
  return (
    <ul className={cn("not-prose mb-2 divide-y divide-brand-border/50", className)}>
      {links.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            className="group flex items-center justify-between gap-4 py-3.5 text-[0.95rem] font-medium text-foreground transition-colors duration-200 hover:text-brand-orange-bright"
          >
            <span className="text-pretty">{link.label}</span>
            <ArrowUpRight
              className="h-4 w-4 shrink-0 text-brand-orange/70 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-orange-bright"
              aria-hidden
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
