"use client";

import { useEffect, useState, type ReactNode } from "react";
import styles from "./invite-ticket.module.css";
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
  if (available === null) return <><span role="status" className={styles.note}>Checking extension…</span><noscript>{children}</noscript></>;
  return <InviteInstallPrompt />;
}

export function InviteInstallPrompt() {
  return (
    <>
      <h2>Install the extension</h2>
      <p className={styles.note}>AniDachi lets you watch together. After installing, return here to join.</p>
      <a className={styles.primary} href={CHROME_WEB_STORE_URL} target="_blank" rel="noopener noreferrer">Install extension</a>
    </>
  );
}
