"use client";

import { useEffect, useState } from "react";
import { isMobileUserAgent } from "@/lib/mobile-user-agent";

export function useMobileDevice() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(isMobileUserAgent(navigator.userAgent));
  }, []);

  return isMobile;
}

export async function shareOrCopyUrl(
  url: string,
  options: { title: string; text?: string },
): Promise<"shared" | "copied"> {
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: options.title,
        text: options.text,
        url,
      });
      return "shared";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw error;
      }
    }
  }

  await navigator.clipboard.writeText(url);
  return "copied";
}
