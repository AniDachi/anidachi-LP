"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { trackEvent } from "@/lib/gtag";

type Props = {
  referralLink: string;
  referralCount: number;
  className?: string;
};

export function WaitlistReferralCard({
  referralLink,
  referralCount,
  className = "",
}: Props) {
  const [copied, setCopied] = useState(false);

  const copyLink = useCallback(async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(referralLink);
      } else if (typeof document !== "undefined") {
        const el = document.createElement("textarea");
        el.value = referralLink;
        el.style.position = "fixed";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }
      setCopied(true);
      trackEvent("referral_link_copied", { placement: "survey_step_7" });
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard permission denied — user can select the link manually.
    }
  }, [referralLink]);

  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg border border-brand-border/80 bg-brand-surface/60 px-3 py-2 ${className}`.trim()}
    >
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-foreground">
          Move up the list
          <span className="font-normal text-foreground/45"> · +10 per friend</span>
          {referralCount > 0 ? (
            <span className="ml-1 font-medium text-brand-orange">
              ({referralCount} joined)
            </span>
          ) : null}
        </p>
        <p className="truncate text-[10px] text-foreground/45">
          Friends sign up at your link to see their #
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 shrink-0 gap-1 border-brand-border/80 bg-background px-2.5 text-[11px] text-foreground hover:border-brand-orange/50 hover:bg-brand-orange hover:text-primary-foreground"
        onClick={copyLink}
      >
        {copied ? (
          <>
            <Check className="h-3 w-3" aria-hidden="true" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-3 w-3" aria-hidden="true" />
            Copy link
          </>
        )}
      </Button>
    </div>
  );
}
