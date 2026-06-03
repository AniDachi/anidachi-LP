"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { DiscordIcon } from "@/components/discord-icon";
import { FOUNDER_DISCORD_USERNAME } from "@/lib/founder-discord";

export interface DiscordContactProps {
  username?: string;
  className?: string;
}

/** Shared founder Discord card (post-purchase /success and pre-purchase survey). */
export function DiscordContact({
  username = FOUNDER_DISCORD_USERNAME,
  className = "",
}: DiscordContactProps) {
  const [copied, setCopied] = useState(false);

  const copyUsername = useCallback(async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(username);
      } else if (typeof document !== "undefined") {
        const el = document.createElement("textarea");
        el.value = username;
        el.style.position = "fixed";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
      }

      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // If copy fails (permissions/browser), we silently fail; user can still select text manually.
    }
  }, [username]);

  return (
    <div
      className={`bg-gray-50 rounded-lg p-4 text-sm text-gray-600 ${className}`.trim()}
    >
      <h4 className="font-medium text-gray-900 mb-1 flex items-center gap-2">
        <DiscordIcon className="h-5 w-5 shrink-0 text-[#5865F2]" />
        DM the AniDachi Founder
      </h4>
      <p className="mb-3 flex flex-wrap items-center gap-1.5">
        <span>Message</span>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-[#5865F2]/25 bg-[#5865F2]/5 px-2 py-0.5 font-mono text-gray-900 select-all">
          <DiscordIcon className="h-4 w-4 shrink-0 text-[#5865F2]" />
          {username}
        </span>
        <span>on Discord</span>
      </p>

      <Button
        type="button"
        variant="outline"
        className="bg-transparent"
        onClick={copyUsername}
      >
        {copied ? (
          <>
            <Check className="mr-2 h-4 w-4" aria-hidden="true" />
            Copied
          </>
        ) : (
          <>
            <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
            Copy username
          </>
        )}
      </Button>
    </div>
  );
}
