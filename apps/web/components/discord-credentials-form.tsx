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
    <div className={`rounded-[12px] border border-ani-line bg-ani-panel p-4 text-sm text-ani-muted ${className}`.trim()}>
      <h4 className="mb-1 font-medium text-ani-text">Your Discord contact (optional)</h4>
      <p className="mb-3">
        Leave your Discord username so we can reach you faster about refunds or questions.
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Example: .profun"
          className="h-10 flex-1 rounded-full border border-ani-control-border bg-ani-canvas px-3 text-sm text-ani-text placeholder:text-ani-muted focus:border-ani-focus focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ani-focus"
          aria-label="Discord username"
          disabled={status === "saving" || status === "saved"}
        />

        <Button
          type="button"
          variant="cream"
          size="control"
          className="h-11"
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
        <p className="mt-2 text-xs text-ani-muted">
          Note: this field is only available when you arrive from Stripe checkout.
        </p>
      ) : null}

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

