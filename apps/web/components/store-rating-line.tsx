import { Star } from "lucide-react";
import { CHROME_STORE_RATING, shouldShowStoreRating } from "@/lib/extension-store";
import { cn } from "@/lib/utils";
import type { PageLocale } from "@/lib/locale/ui-strings";

const SUFFIX: Record<PageLocale, string> = {
  en: "on the Chrome Web Store",
  de: "im Chrome Web Store",
};

function RatingStars({ value }: { value: number }) {
  const stars = Array.from({ length: 5 }, (_, i) => (
    <Star key={i} className="h-3.5 w-3.5 shrink-0 fill-current" aria-hidden="true" />
  ));
  return (
    <span className="relative inline-flex" aria-hidden="true">
      <span className="flex gap-0.5 text-white/15">{stars}</span>
      <span
        className="absolute inset-y-0 left-0 flex gap-0.5 overflow-hidden text-ani-progress"
        style={{ width: `${(value / 5) * 100}%` }}
      >
        {stars}
      </span>
    </span>
  );
}

/**
 * "★★★★½ 4.6 on the Chrome Web Store" ("4,6 im Chrome Web Store" in German), shown under install buttons.
 * Renders nothing when the rating is below the threshold in lib/extension-store.ts.
 */
export function StoreRatingLine({
  className,
  locale = "en",
}: {
  className?: string;
  locale?: PageLocale;
}) {
  if (!shouldShowStoreRating()) return null;
  const value = CHROME_STORE_RATING.value.toLocaleString(locale === "de" ? "de-DE" : "en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return (
    <p className={cn("m-0 flex items-center justify-center gap-2 text-sm text-ani-muted", className)}>
      <RatingStars value={CHROME_STORE_RATING.value} />
      <span>
        <span className="font-semibold tabular-nums text-ani-text">
          {value}
        </span>{" "}
        {SUFFIX[locale]}
      </span>
    </p>
  );
}
