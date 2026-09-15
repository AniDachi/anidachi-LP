"use client";

import { useEffect, useState } from "react";

export const EXTENSION_PING_TYPE = "ANIDACHI_EXTENSION_PING";
export const EXTENSION_PRESENT_TYPE = "ANIDACHI_EXTENSION_PRESENT";

const DEFAULT_TIMEOUT_MS = 1500;

/** `null` while checking, then whether the unpacked/store extension answered. */
export function useExtensionPresence(timeoutMs = DEFAULT_TIMEOUT_MS): boolean | null {
  const [detected, setDetected] = useState<boolean | null>(null);

  useEffect(() => {
    let resolved = false;

    function onMessage(event: MessageEvent) {
      if (event.source !== window) return;
      if (event.data?.type === EXTENSION_PRESENT_TYPE) {
        resolved = true;
        setDetected(true);
      }
    }

    window.addEventListener("message", onMessage);
    window.postMessage({ type: EXTENSION_PING_TYPE }, "*");

    const timer = window.setTimeout(() => {
      if (!resolved) setDetected(false);
    }, timeoutMs);

    return () => {
      window.removeEventListener("message", onMessage);
      window.clearTimeout(timer);
    };
  }, [timeoutMs]);

  return detected;
}
