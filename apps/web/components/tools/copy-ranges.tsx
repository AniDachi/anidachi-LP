"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyRanges({ text, label }: { text: string; label: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (status === "idle") return;
    const timer = window.setTimeout(() => setStatus("idle"), 2000);
    return () => window.clearTimeout(timer);
  }, [status]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex min-h-10 items-center gap-2 rounded-full border border-ani-control-border px-4 text-sm font-medium text-ani-text transition-colors duration-150 hover:border-ani-control-border-hover hover:bg-ani-hover active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ani-focus"
    >
      {status === "copied" ? (
        <Check className="h-4 w-4 text-ani-progress" aria-hidden />
      ) : (
        <Copy className="h-4 w-4 text-ani-muted" aria-hidden />
      )}
      <span aria-live="polite">
        {status === "copied" ? "Copied" : status === "failed" ? "Copy failed" : label}
      </span>
    </button>
  );
}
