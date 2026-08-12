import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Section title block for the marketing home — no eyebrow kickers. */
export function HomeSectionHeader({
  title,
  description,
  className,
  align = "center",
  titleAs: TitleTag = "h2",
}: {
  title: ReactNode;
  description?: ReactNode;
  className?: string;
  align?: "center" | "left";
  titleAs?: "h1" | "h2";
}) {
  return (
    <div
      className={cn(
        "mb-10",
        align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl text-left",
        className,
      )}
    >
      <TitleTag
        className={cn(
          "text-balance text-3xl font-bold tracking-[-0.03em] text-foreground md:text-4xl md:leading-[1.1]",
          description ? "mb-4" : null,
        )}
      >
        {title}
      </TitleTag>
      {description ? (
        <p
          className={cn(
            "text-pretty text-base leading-relaxed text-foreground/70 md:text-lg",
            align === "center" ? "mx-auto" : null,
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  );
}
