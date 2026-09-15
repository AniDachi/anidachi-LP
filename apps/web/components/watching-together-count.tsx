"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Live CRM signup count (`/api/waitlist-stats`). Hidden until a positive
 * count loads so we never flash a zero.
 */
export function WatchingTogetherCount({ className }: { className?: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/waitlist-stats")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { count?: number | null } | null) => {
        if (cancelled || typeof data?.count !== "number" || data.count <= 0) {
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
      Join{" "}
      <span className="font-semibold tabular-nums text-ani-text">
        {count.toLocaleString()}
      </span>{" "}
      people already signed up on AniDachi
    </p>
  );
}
