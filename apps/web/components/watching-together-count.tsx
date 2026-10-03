"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Historical signup baseline plus new accounts (`/api/community-stats`).
 * Hidden until a valid count loads so outages never display a fake zero.
 */
export function WatchingTogetherCount({ className }: { className?: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/community-stats", { signal: AbortSignal.timeout(4000) })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { count?: number | null } | null) => {
        if (
          cancelled ||
          typeof data?.count !== "number" ||
          !Number.isSafeInteger(data.count) ||
          data.count <= 0
        ) {
          return;
        }
        setCount(data.count);
      })
      .catch(() => {
        // Keep the surrounding install copy if the count cannot be loaded.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (count === null) return null;

  return (
    <p className={cn("text-sm text-ani-muted", className)}>
      <span className="font-semibold tabular-nums text-ani-text">
        {count.toLocaleString("en-US")}
      </span>{" "}
      people have joined AniDachi
    </p>
  );
}
