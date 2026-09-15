"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { DiscordIcon } from "@/components/discord-icon";
import {
  DISCORD_SERVER_CTA_LABEL,
  DISCORD_SERVER_INVITE_URL,
} from "@/lib/community-discord";
import {
  inferPageTemplateFromPath,
  trackConversion,
} from "@/lib/conversion-events";
import { cn } from "@/lib/utils";

type JoinDiscordButtonProps = {
  variant: "nav" | "hero" | "footer";
  placement: string;
  className?: string;
  onClick?: () => void;
  /** Use 44px min touch height (mobile drawer). */
  touchTarget?: boolean;
};

function trackDiscordClick(placement: string) {
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  trackConversion("cta_click", {
    page_path: path,
    page_template: inferPageTemplateFromPath(path),
    placement,
    cta_variant: "join_discord_server",
  });
}

export function JoinDiscordButton({
  variant,
  placement,
  className,
  onClick,
  touchTarget = false,
}: JoinDiscordButtonProps) {
  useEffect(() => {
    if (variant !== "hero" || typeof window === "undefined") {
      return;
    }
    trackConversion("cta_impression", {
      page_path: window.location.pathname,
      page_template: "home",
      placement,
      cta_variant: "join_discord_server",
    });
  }, [variant, placement]);

  const handleClick = () => {
    trackDiscordClick(placement);
    onClick?.();
  };

  if (variant === "footer") {
    return (
      <a
        href={DISCORD_SERVER_INVITE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "flex min-h-11 items-center gap-1.5 py-1 text-ani-muted transition-colors hover:text-ani-text",
          className,
        )}
        onClick={handleClick}
      >
        <DiscordIcon className="h-4 w-4 shrink-0 text-[#5865F2]" />
        {DISCORD_SERVER_CTA_LABEL}
      </a>
    );
  }

  if (variant === "hero") {
    return (
      <Button
        asChild
        size="touch"
        variant="outline"
        className={cn(
          "w-full border border-[#5865F2]/40 bg-transparent px-8 text-base font-semibold text-foreground/80 transition-all duration-300 hover:border-[#5865F2] hover:bg-[#5865F2]/10 hover:text-foreground sm:w-auto",
          className,
        )}
      >
        <a
          href={DISCORD_SERVER_INVITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClick}
        >
          <DiscordIcon className="h-5 w-5 text-[#5865F2]" aria-hidden="true" />
          {DISCORD_SERVER_CTA_LABEL}
        </a>
      </Button>
    );
  }

  return (
    <Button
      asChild
      variant="creamQuiet"
      size="control"
      className={cn(
        "px-0 text-ani-muted hover:bg-transparent hover:text-ani-text",
        touchTarget && "w-full justify-start px-3",
        className,
      )}
    >
      <a
        href={DISCORD_SERVER_INVITE_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
      >
        <DiscordIcon className="h-4 w-4" aria-hidden="true" />
        {DISCORD_SERVER_CTA_LABEL}
      </a>
    </Button>
  );
}
