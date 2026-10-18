"use client";

import { InstallLink } from "@/components/install-link";
import {
  inferPageTemplateFromPath,
  trackConversion,
} from "@/lib/conversion-events";
import { INSTALL_CTA_LABEL, INSTALL_HUB_PATH } from "@/lib/install-cta";

export function NavPricingLink({
  className = "text-ani-muted transition-colors hover:text-ani-text",
  label = INSTALL_CTA_LABEL,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <InstallLink
      href={INSTALL_HUB_PATH}
      className={className}
      onClick={() => {
        if (typeof window === "undefined") return;
        const path = window.location.pathname;
        trackConversion("cta_click", {
          page_path: path,
          page_template: inferPageTemplateFromPath(path),
          placement: "nav",
          cta_variant: "nav_install",
        });
      }}
    >
      {label}
    </InstallLink>
  );
}
