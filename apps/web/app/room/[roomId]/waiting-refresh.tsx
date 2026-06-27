"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type RoomStatusResponse = {
  sourceUrl?: string | null;
};

/**
 * Polls room status while the guest waits for the host to open a video.
 * Uses the lightweight rooms API instead of full page re-renders every interval.
 */
export function WaitingRefresh({
  roomId,
  intervalMs = 5000,
}: {
  roomId: string;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}`);
        if (res.status === 404) {
          router.refresh();
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as RoomStatusResponse;
        if (data.sourceUrl) {
          router.refresh();
        }
      } catch {
        // Keep polling until the host opens a video or the tab closes.
      }
    }

    void poll();
    const id = window.setInterval(() => {
      void poll();
    }, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [router, roomId, intervalMs]);

  return null;
}
