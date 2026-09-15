"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { INSTALL_CTA_LABEL, INSTALL_HUB_PATH } from "@/lib/install-cta";
import { trackConversion, type PageTemplateId } from "@/lib/conversion-events";

export function StickyMobileCheckoutBar({
  pagePath,
  pageTemplate,
}: {
  pagePath: string;
  pageTemplate: PageTemplateId;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const threshold = Math.min(480, Math.max(200, window.innerHeight * 0.2));
      setVisible(window.scrollY > threshold);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-ani-line bg-ani-canvas px-4 py-3 motion-safe:transition-transform motion-safe:duration-[180ms] md:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      role="region"
      aria-label="Install AniDachi on desktop"
      aria-hidden={!visible}
      style={{ transform: visible ? "translateY(0)" : "translateY(100%)" }}
    >
      <Link
        href={INSTALL_HUB_PATH}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-ani-primary px-4 text-[13px] font-semibold text-ani-on-primary transition-colors duration-[180ms] hover:bg-ani-primary-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ani-focus"
        onClick={() => {
          trackConversion("cta_click", {
            page_path: pagePath,
            page_template: pageTemplate,
            placement: "content_mid",
            cta_variant: "sticky_mobile_bar",
          });
        }}
      >
        {INSTALL_CTA_LABEL}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
