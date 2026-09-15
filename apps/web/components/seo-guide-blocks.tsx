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
        "mb-6 max-w-[22ch] text-balance text-4xl font-bold tracking-[-0.03em] text-ani-text md:mb-8 md:max-w-none md:text-5xl md:leading-[1.08]",
        className,
      )}
    >
      {children}
    </h1>
  );
}

/**
 * Short-answer / verdict plane. One surface, not a card grid.
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
        "not-prose relative mb-10 overflow-hidden rounded-[20px] border border-ani-line bg-ani-panel px-5 py-5 sm:px-7 sm:py-6",
        className,
      )}
    >
      <div className="relative text-lg leading-relaxed text-ani-muted sm:text-xl sm:leading-relaxed [&_a]:font-medium [&_a]:text-ani-text [&_a]:underline [&_a]:decoration-ani-line [&_a]:underline-offset-2 hover:[&_a]:text-ani-primary [&_strong]:font-semibold [&_strong]:text-ani-text">
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
            "rounded-[12px] border px-4 py-4 transition-[transform,border-color,background-color] duration-200 ease-out sm:px-5",
            option.highlight
              ? "border-ani-control-border bg-ani-selected-quiet"
              : "border-ani-line bg-transparent hover:border-ani-control-border hover:bg-ani-hover",
          )}
        >
          <p className="text-[0.95rem] font-semibold tracking-[-0.01em] text-ani-text sm:text-base">
            {option.title}
          </p>
          <div className="mt-1.5 text-[0.95rem] leading-relaxed text-ani-muted [&_a]:font-medium [&_a]:text-ani-text [&_a]:underline [&_a]:decoration-ani-line [&_a]:underline-offset-2 hover:[&_a]:underline">
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
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ani-line bg-ani-hover font-mono text-sm font-semibold tabular-nums text-ani-text"
            aria-hidden
          >
            {index + 1}
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="font-semibold tracking-[-0.01em] text-ani-text">
              {step.name}
            </p>
            <div className="mt-1 text-[0.95rem] leading-relaxed text-ani-muted [&_a]:font-medium [&_a]:text-ani-text [&_a]:underline [&_a]:decoration-ani-line [&_a]:underline-offset-2 hover:[&_a]:underline">
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
          className="grid grid-cols-[auto_1fr] gap-x-3 text-[0.95rem] leading-relaxed text-ani-muted"
        >
          <span
            className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-ani-progress"
            aria-hidden
          />
          <span>
            {item.title ? (
              <strong className="font-semibold text-ani-text">
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
        "not-prose mb-10 rounded-[12px] border border-ani-line bg-ani-hover px-5 py-4 text-[0.95rem] leading-relaxed text-ani-muted [&_a]:font-medium [&_a]:text-ani-text [&_a]:underline [&_a]:decoration-ani-line [&_a]:underline-offset-2 hover:[&_a]:underline",
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
    <ul className={cn("not-prose mb-2 divide-y divide-ani-line", className)}>
      {links.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            className="group flex items-center justify-between gap-4 py-3.5 text-[0.95rem] font-medium text-ani-text transition-colors duration-200 hover:text-ani-primary"
          >
            <span className="text-pretty">{link.label}</span>
            <ArrowUpRight
              className="h-4 w-4 shrink-0 text-ani-muted transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ani-text"
              aria-hidden
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}
