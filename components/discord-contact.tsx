"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy, MessageCircle } from "lucide-react";

export interface DiscordContactProps {
  username: string;
  profileUrl?: string;
  className?: string;
}

export function DiscordContact({
  username,
  profileUrl,
  className = "",
}: DiscordContactProps) {
  const [copied, setCopied] = useState(false);

  const discordAppUrl = useMemo(() => {
    // Prefer a direct profile link when available.
    if (profileUrl && profileUrl.length > 0) return profileUrl;

    // Otherwise, the most reliable action is opening Discord.
    return "https://discord.com/channels/@me";
  }, [profileUrl]);

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
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        DM the AniDachi Founder
      </h4>
      <p className="mb-3">
        Message{" "}
        <span className="font-mono text-gray-900 select-all">{username}</span>
        {" "}directly on Discord
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
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

        <Button
          asChild
          className="bg-purple-600 hover:bg-purple-700 text-white"
        >
          <a href={discordAppUrl} target="_blank" rel="noreferrer">
            DM on Discord
          </a>
        </Button>
      </div>
    </div>
  );
}
