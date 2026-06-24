"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { trackConversion, type PageTemplateId } from "@/lib/conversion-events";
import { usePlanSurvey } from "@/components/plan-survey/use-plan-survey";

export function StickyMobileCheckoutBar({
  pagePath,
  pageTemplate,
}: {
  pagePath: string;
  pageTemplate: PageTemplateId;
}) {
  const { openSurvey, isOpen: surveyOpen } = usePlanSurvey();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > 480);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (surveyOpen || !visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[--brand-border] bg-background/95 px-4 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.3)] backdrop-blur-xl md:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      role="region"
      aria-label="Quick checkout"
    >
      <Link
        href="/#pricing"
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[--brand-orange] px-4 text-base font-semibold text-[--primary-foreground] transition-colors hover:bg-[--brand-orange-deep] glow-orange"
        onClick={(e) => {
          e.preventDefault();
          trackConversion("cta_click", {
            page_path: pagePath,
            page_template: pageTemplate,
            placement: "content_mid",
            cta_variant: "sticky_mobile_bar",
          });
          openSurvey({
            placement: "content_mid",
            ctaVariant: "sticky_mobile_bar",
          });
        }}
      >
        Get early access
        <ArrowRight className="h-5 w-5" aria-hidden="true" />
      </Link>
    </div>
  );
}
