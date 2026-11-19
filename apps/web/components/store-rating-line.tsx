import { Star } from "lucide-react";
import { CHROME_STORE_RATING, shouldShowStoreRating } from "@/lib/extension-store";
import { cn } from "@/lib/utils";

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
 * "★★★★½ 4.6 on the Chrome Web Store", shown under install buttons (English only).
 * Renders nothing when the rating is below the threshold in lib/extension-store.ts.
 */
export function StoreRatingLine({ className }: { className?: string }) {
  if (!shouldShowStoreRating()) return null;
  return (
    <p className={cn("m-0 flex items-center justify-center gap-2 text-sm text-ani-muted", className)}>
      <RatingStars value={CHROME_STORE_RATING.value} />
      <span>
        <span className="font-semibold tabular-nums text-ani-text">
          {CHROME_STORE_RATING.value.toFixed(1)}
        </span>{" "}
        on the Chrome Web Store
      </span>
    </p>
  );
}
