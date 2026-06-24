"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Loader2 } from "lucide-react";

export interface DiscordCredentialsFormProps {
  sessionId?: string;
  className?: string;
}

export function DiscordCredentialsForm({
  sessionId,
  className = "",
}: DiscordCredentialsFormProps) {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  const disabled = useMemo(() => {
    if (!sessionId) return true;
    if (status === "saving" || status === "saved") return true;
    if (value.trim().length === 0) return true;
    return false;
  }, [sessionId, status, value]);

  const submit = useCallback(async () => {
    if (!sessionId) {
      setStatus("error");
      setError("Missing checkout session id. Please refresh the page.");
      return;
    }

    setStatus("saving");
    setError(null);

    try {
      const res = await fetch("/api/save-discord-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, discord: value }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };

      if (!res.ok || !json.ok) {
        setStatus("error");
        setError(json.error ?? "Could not save your Discord contact.");
        return;
      }

      setStatus("saved");
    } catch {
      setStatus("error");
      setError("Network error. Please try again.");
    }
  }, [sessionId, value]);

  return (
    <div className={`bg-[--brand-surface] border border-[--brand-border] rounded-lg p-4 text-sm text-foreground/70 ${className}`.trim()}>
      <h4 className="font-medium text-foreground mb-1">Your Discord contact (optional)</h4>
      <p className="mb-3">
        Leave your Discord username so we can reach you faster about refunds or questions.
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Example: .profun"
          className="flex-1 h-10 rounded-md border border-[--brand-border] bg-background px-3 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-[--brand-orange]/20 focus:border-[--brand-orange]"
          aria-label="Discord username"
          disabled={status === "saving" || status === "saved"}
        />

        <Button
          type="button"
          className="h-10 bg-[--brand-orange] hover:bg-[--brand-orange-deep] text-[--primary-foreground]"
          onClick={submit}
          disabled={disabled}
        >
          {status === "saving" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Saving…
            </>
          ) : status === "saved" ? (
            <>
              <Check className="mr-2 h-4 w-4" aria-hidden="true" />
              Saved
            </>
          ) : (
            "Save"
          )}
        </Button>
      </div>

      {!sessionId ? (
        <p className="mt-2 text-xs text-foreground/50">
          Note: this field is only available when you arrive from Stripe checkout.
        </p>
      ) : null}

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

