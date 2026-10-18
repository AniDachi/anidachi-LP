"use client";

import { createContext, useContext, type ComponentProps } from "react";
import Link from "next/link";
import { INSTALL_HUB_PATH } from "@/lib/install-cta";
import { isMobileInstallDevice } from "@/lib/mobile-install";

export const MobileInstallContext = createContext<{
  open: (href?: string) => void;
  mobilePreview: boolean;
} | null>(null);

/** Keep desktop and modified links native; phone handoff requires an explicit tap. */
export function InstallLink({
  onClick,
  shareHref,
  ...props
}: ComponentProps<typeof Link> & { shareHref?: string }) {
  const panel = useContext(MobileInstallContext);

  return <Link {...props} onClick={(event) => {
    onClick?.(event);
    if (!panel || event.defaultPrevented || event.button !== 0 ||
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const mobile = panel.mobilePreview || isMobileInstallDevice(navigator);
    if (!mobile || typeof window.HTMLDialogElement?.prototype.showModal !== "function") return;

    event.preventDefault();
    panel.open(shareHref ?? (typeof props.href === "string" ? props.href : INSTALL_HUB_PATH));
  }} />;
}
