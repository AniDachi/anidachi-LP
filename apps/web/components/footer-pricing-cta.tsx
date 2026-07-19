"use client";

import Link from "next/link";
import { inferPageTemplateFromPath, trackConversion } from "@/lib/conversion-events";

export function FooterPricingCta({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/pricing"
      className={className}
      onClick={() => {
        if (typeof window === "undefined") return;
        const path = window.location.pathname;
        trackConversion("cta_click", {
          page_path: path,
          page_template: inferPageTemplateFromPath(path),
          placement: "footer",
          cta_variant: "footer_pricing",
        });
      }}
    >
      Pricing
    </Link>
  );
}
