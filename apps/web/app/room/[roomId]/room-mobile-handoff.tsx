"use client";

import { useCallback, useState } from "react";
import { Copy, Monitor, Share2 } from "lucide-react";
import { shareOrCopyUrl, useMobileDevice } from "@/lib/use-mobile-device";

type RoomMobileHandoffProps = {
  variant: "waiting" | "ready" | "joined";
};

const COPY: Record<RoomMobileHandoffProps["variant"], { title: string; body: string }> = {
  waiting: {
    title: "Open on desktop Chrome",
    body: "Playback runs in the Chrome extension on a computer. You can keep this tab open — it updates when the host starts the video.",
  },
  ready: {
    title: "Continue on desktop Chrome",
    body: "Synced watch parties need the AniDachi extension on a desktop browser. Send this room link to your computer to join.",
  },
  joined: {
    title: "You're in — open on desktop",
    body: "You're joined on mobile. Copy or share this link and open it in Chrome on your computer to watch together.",
  },
};

export function RoomMobileHandoff({ variant }: RoomMobileHandoffProps) {
  const isMobile = useMobileDevice();
  const [status, setStatus] = useState<"idle" | "shared" | "copied">("idle");

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    try {
      const result = await shareOrCopyUrl(url, {
        title: "AniDachi watchroom",
        text: "Join my AniDachi watchroom",
      });
      setStatus(result === "shared" ? "shared" : "copied");
    } catch {
      setStatus("idle");
    }
  }, []);

  if (!isMobile) return null;

  const copy = COPY[variant];
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="mt-6 rounded-xl border border-brand-border bg-brand-surface px-4 py-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-orange/15 text-brand-orange">
          <Monitor className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{copy.title}</p>
          <p className="mt-1 text-sm text-foreground/55">{copy.body}</p>
          <button
            type="button"
            onClick={() => void handleShare()}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-brand-border bg-background px-4 text-sm font-semibold text-foreground transition hover:border-brand-orange/40 hover:text-brand-orange"
          >
            {canShare ? (
              <Share2 className="h-4 w-4" aria-hidden />
            ) : (
              <Copy className="h-4 w-4" aria-hidden />
            )}
            {status === "shared"
              ? "Link shared"
              : status === "copied"
                ? "Link copied"
                : canShare
                  ? "Share room link"
                  : "Copy room link"}
          </button>
        </div>
      </div>
    </div>
  );
}
