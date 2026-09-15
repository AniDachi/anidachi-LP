"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  inferPageTemplateFromPath,
  trackConversion,
} from "@/lib/conversion-events";
import { INSTALL_CTA_LABEL, INSTALL_HUB_PATH } from "@/lib/install-cta";

export function NavPricingButton() {
  return (
    <Button asChild variant="cream" size="control">
      <Link
        href={INSTALL_HUB_PATH}
        onClick={() => {
          if (typeof window === "undefined") return;
          const path = window.location.pathname;
          trackConversion("cta_click", {
            page_path: path,
            page_template: inferPageTemplateFromPath(path),
            placement: "nav",
            cta_variant: "nav_install_button",
          });
        }}
      >
        {INSTALL_CTA_LABEL}
      </Link>
    </Button>
  );
}
