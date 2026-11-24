"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { requestExtensionPresence } from "@/lib/extension-presence-client";
import { CHROME_WEB_STORE_URL } from "@/lib/install-cta";
import { isMobileInstallDevice } from "@/lib/mobile-install";

export function RoomInviteExtensionStep({ extensionId, initialMobile, children }: {
  extensionId?: string | null;
  initialMobile: boolean;
  children?: ReactNode;
}) {
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!extensionId || initialMobile || isMobileInstallDevice(navigator)) return;
    let pending: AbortController | undefined;
    function check() {
      if (document.visibilityState === "hidden") return;
      pending?.abort();
      const current = new AbortController();
      pending = current;
      void requestExtensionPresence(extensionId, current.signal).then(present => {
        if (!current.signal.aborted) setMissing(!present);
      });
    }
    check();
    window.addEventListener("focus", check);
    window.addEventListener("pageshow", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      pending?.abort();
      window.removeEventListener("focus", check);
      window.removeEventListener("pageshow", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [extensionId, initialMobile]);

  if (!missing || !extensionId || initialMobile) return children;
  return (
    <section className="mx-auto max-w-sm text-center" aria-label="Extension setup">
      <h2 className="text-xl font-semibold tracking-tight text-ani-text">
        Install AniDachi to join
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ani-muted">
        Add the extension to Chrome, then return to this tab to join the room.
      </p>
      <a className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-ani-text px-5 font-semibold text-ani-canvas"
        href={CHROME_WEB_STORE_URL} target="_blank" rel="noopener noreferrer">
        Install extension <ArrowUpRight size={16} aria-hidden="true" />
      </a>
      <div>
        <button type="button" className="mt-2 min-h-11 text-sm font-medium text-ani-text underline underline-offset-4"
          onClick={() => window.location.reload()}>Check again</button>
      </div>
      {children && <details className="mt-2 text-sm text-ani-muted">
        <summary className="cursor-pointer">Already installed?</summary>
        <div className="mt-3">{children}</div>
      </details>}
    </section>
  );
}
