"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Polls the room landing page while the guest waits for the host to open a
 * video. As soon as the room gains a source URL (server re-render), the page
 * upgrades from the waiting state to the "Open watchroom" CTA — no manual
 * refresh, no dead end (Block 3.1 of the 2026-06-12 execution plan).
 */
export function WaitingRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
