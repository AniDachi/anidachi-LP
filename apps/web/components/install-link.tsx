"use client";

import { createContext, useContext, type ComponentProps } from "react";
import Link from "next/link";
import { trackStoreClick } from "@/lib/conversion-events";
import { CHROME_WEB_STORE_URL, INSTALL_HUB_PATH } from "@/lib/install-cta";
import { isMobileInstallDevice } from "@/lib/mobile-install";

export const MobileInstallContext = createContext<{
  open: (href?: string) => void;
  mobilePreview: boolean;
} | null>(null);

/** Keep desktop and modified links native; phone handoff requires an explicit tap. */
export function InstallLink({
  onClick,
  shareHref,
  storePlacement = "install_link",
  ...props
}: ComponentProps<typeof Link> & { shareHref?: string; storePlacement?: string }) {
  const panel = useContext(MobileInstallContext);

  return <Link {...props} onClick={(event) => {
    onClick?.(event);
    if (event.defaultPrevented) return;

    const native = !panel || event.button !== 0 ||
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    const mobile = !native && (panel.mobilePreview || isMobileInstallDevice(navigator)) &&
      typeof window.HTMLDialogElement?.prototype.showModal === "function";
    if (mobile) {
      event.preventDefault();
      panel.open(shareHref ?? (typeof props.href === "string" ? props.href : INSTALL_HUB_PATH));
      return;
    }
    if (props.href === CHROME_WEB_STORE_URL) trackStoreClick(storePlacement);
  }} />;
}
