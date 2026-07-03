"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Share2 } from "lucide-react";
import { shareOrCopyUrl, useMobileDevice } from "@/lib/use-mobile-device";

const EXTENSION_HANDSHAKE_TIMEOUT_MS = 1500;

/**
 * Detects whether the Anidachi extension is installed by sending a postMessage
 * and waiting for a known response within a short timeout.
 */
export function ExtensionCheck() {
  const [detected, setDetected] = useState<boolean | null>(null);
  const [linkStatus, setLinkStatus] = useState<"idle" | "shared" | "copied">("idle");
  const isMobile = useMobileDevice();

  useEffect(() => {
    let resolved = false;

    function onMessage(event: MessageEvent) {
      if (event.data?.type === "ANIDACHI_EXTENSION_PRESENT") {
        resolved = true;
        setDetected(true);
      }
    }

    window.addEventListener("message", onMessage);
    window.postMessage({ type: "ANIDACHI_EXTENSION_PING" }, "*");

    const timer = setTimeout(() => {
      if (!resolved) setDetected(false);
    }, EXTENSION_HANDSHAKE_TIMEOUT_MS);

    return () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
    };
  }, []);

  const copyRoomLink = useCallback(async () => {
    try {
      const result = await shareOrCopyUrl(window.location.href, {
        title: "AniDachi watchroom",
        text: "Open this watchroom on your desktop in Chrome",
      });
      setLinkStatus(result === "shared" ? "shared" : "copied");
    } catch {
      setLinkStatus("idle");
    }
  }, []);

  if (detected === null) return null;

  if (!detected) {
    const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

    return (
      <div className="mt-6 flex flex-col gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200">
        <div className="flex items-start gap-3">
          <svg
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 shrink-0 text-amber-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          <span>
            {isMobile ? (
              <>
                You&apos;re on mobile. AniDachi playback requires the Chrome extension on a
                desktop. Copy this link and open it on your computer, then install the extension
                from the Chrome Web Store if needed.
              </>
            ) : (
              <>
                You need the AniDachi extension to join the live session.{" "}
                <a
                  href="https://chrome.google.com/webstore"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold underline underline-offset-2 hover:text-amber-100"
                >
                  Install from Chrome Web Store
                </a>
              </>
            )}
          </span>
        </div>
        {isMobile ? (
          <button
            type="button"
            onClick={() => void copyRoomLink()}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/5 px-4 font-semibold text-amber-100 transition hover:bg-amber-400/15"
          >
            {canShare ? (
              <Share2 className="h-4 w-4" aria-hidden />
            ) : (
              <Copy className="h-4 w-4" aria-hidden />
            )}
            {linkStatus === "shared"
              ? "Link shared"
              : linkStatus === "copied"
                ? "Link copied"
                : canShare
                  ? "Share link to desktop"
                  : "Copy link for desktop"}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <p className="mt-4 flex items-center gap-2 text-sm text-brand-orange">
      <span className="inline-block h-2 w-2 rounded-full bg-brand-orange" />
      Extension detected
    </p>
  );
}
