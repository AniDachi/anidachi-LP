"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  inferPageTemplateFromPath,
  trackConversion,
} from "@/lib/conversion-events";

export function NavPricingButton() {
  return (
    <Button
      size="sm"
      className="bg-white text-purple-800 hover:bg-purple-50 font-semibold"
      asChild
    >
      <Link
        href="/#pricing"
        onClick={() => {
          if (typeof window === "undefined") return;
          const path = window.location.pathname;
          trackConversion("cta_click", {
            page_path: path,
            page_template: inferPageTemplateFromPath(path),
            placement: "nav",
            cta_variant: "nav_pricing_button",
          });
        }}
      >
        See my plan
      </Link>
    </Button>
  );
}

