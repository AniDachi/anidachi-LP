"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Info, Share2 } from "lucide-react";
import {
  INSTALL_CTA_LABEL,
  INSTALL_HUB_PATH,
  installHubHref,
} from "@/lib/install-cta";
import { shareOrCopyUrl, useMobileDevice } from "@/lib/use-mobile-device";

/** Installation help; room admission does not depend on an extension handshake. */
export function ExtensionCheck() {
  const [linkStatus, setLinkStatus] = useState<"idle" | "shared" | "copied">("idle");
  const [installHref, setInstallHref] = useState(INSTALL_HUB_PATH);
  const isMobile = useMobileDevice();

  useEffect(() => {
    setInstallHref(installHubHref(window.location.pathname));
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

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <aside
      aria-label="AniDachi extension information"
      className="mt-6 flex flex-col gap-3 rounded-xl border border-ani-line bg-ani-panel px-4 py-3 text-sm text-ani-muted"
    >
      <div className="flex items-start gap-3">
        <Info aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
        <span>
          {isMobile ? (
            <>
              You&apos;re on mobile. AniDachi playback requires the Chrome extension on a
              desktop. Copy this link and open it on your computer, then{" "}
              <a
                href={installHref}
                className="font-semibold text-ani-text underline underline-offset-2 hover:text-ani-primary"
              >
                install from the AniDachi install page
              </a>{" "}
              if needed.
            </>
          ) : (
            <>
              Watch together in desktop Chrome with the AniDachi extension.{" "}
              <a
                href={installHref}
                className="font-semibold text-ani-text underline underline-offset-2 hover:text-ani-primary"
              >
                {INSTALL_CTA_LABEL}
              </a>{" "}
              if you haven&apos;t installed it yet.
            </>
          )}
        </span>
      </div>
      {isMobile ? (
        <button
          type="button"
          onClick={() => void copyRoomLink()}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-ani-line bg-ani-hover px-4 font-semibold text-ani-text transition hover:bg-ani-panel"
        >
          {canShare ? <Share2 className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {linkStatus === "shared"
            ? "Link shared"
            : linkStatus === "copied"
              ? "Link copied"
              : canShare
                ? "Share link to desktop"
                : "Copy link for desktop"}
        </button>
      ) : null}
    </aside>
  );
}
