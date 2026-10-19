"use client";

import type { ComponentProps } from "react";
import { trackStoreClick } from "@/lib/conversion-events";
import { CHROME_WEB_STORE_URL } from "@/lib/install-cta";

/** Plain Chrome Web Store link for server components; reports `extension_store_clicked`. */
export function TrackedStoreLink({
  placement,
  onClick,
  ...props
}: Omit<ComponentProps<"a">, "href"> & { placement: string }) {
  return <a {...props} href={CHROME_WEB_STORE_URL} onClick={(event) => {
    onClick?.(event);
    trackStoreClick(placement);
  }} />;
}
