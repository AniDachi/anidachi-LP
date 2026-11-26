"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AuthPageCard, AuthPageShell } from "@/components/auth-page-shell";
import { requestExtensionPresence } from "@/lib/extension-presence-client";
import { CHROME_WEB_STORE_URL } from "@/lib/install-cta";
import { isMobileInstallDevice } from "@/lib/mobile-install";

export function RoomInviteExtensionStep({ extensionId, initialMobile, children }: {
  extensionId?: string | null;
  initialMobile: boolean;
  children?: ReactNode;
}) {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    if (!extensionId || initialMobile) return;
    if (isMobileInstallDevice(navigator)) {
      setAvailable(true);
      return;
    }
    let pending: AbortController | undefined;
    function check() {
      if (document.visibilityState === "hidden") return;
      pending?.abort();
      const current = new AbortController();
      pending = current;
      void requestExtensionPresence(extensionId, current.signal).then(present => {
        if (!current.signal.aborted) setAvailable(present);
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

  if (!extensionId || initialMobile || available) return children;
  if (available === null) return <noscript>{children}</noscript>;
  return (
    <AuthPageShell>
      <AuthPageCard>
        <div className="text-center">
          <a
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-ani-text px-5 font-semibold text-ani-canvas"
            href={CHROME_WEB_STORE_URL} target="_blank" rel="noopener noreferrer"
          >
            Install extension
          </a>
          <p className="mt-3 text-sm leading-relaxed text-ani-muted">
            Return here after installation to join the room.
          </p>
        </div>
      </AuthPageCard>
    </AuthPageShell>
  );
}
