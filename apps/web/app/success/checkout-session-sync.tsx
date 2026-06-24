"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type SyncState =
  | { status: "idle" | "syncing"; message: string }
  | { status: "synced"; message: string }
  | { status: "error"; message: string };

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  plus: "Plus",
  pro: "Pro",
};

export function CheckoutSessionSync({
  sessionId,
  initialPlanCode,
}: {
  sessionId?: string;
  initialPlanCode: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<SyncState>({
    status: sessionId ? "idle" : "synced",
    message: sessionId
      ? "Confirming your subscription with Stripe..."
      : `Your current AniDachi plan is ${PLAN_LABELS[initialPlanCode] ?? initialPlanCode}.`,
  });

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    async function sync() {
      setState({ status: "syncing", message: "Confirming your subscription with Stripe..." });
      try {
        const response = await fetch("/api/billing/sync-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, next: "/account" }),
        });
        const payload = (await response.json().catch(() => null)) as {
          ok?: boolean;
          planCode?: string;
          error?: string;
        } | null;
        if (cancelled) return;

        if (!response.ok || !payload?.ok) {
          setState({
            status: "error",
            message:
              payload?.error ??
              "Stripe confirmed the payment, but AniDachi has not finished updating the account yet.",
          });
          return;
        }

        const planLabel = PLAN_LABELS[payload.planCode ?? ""] ?? payload.planCode ?? "your paid plan";
        setState({
          status: "synced",
          message: `Your AniDachi account is active on ${planLabel}.`,
        });
        router.refresh();
      } catch {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              "Network error while confirming your subscription. Refresh this page or open Account in a minute.",
          });
        }
      }
    }

    sync();
    return () => {
      cancelled = true;
    };
  }, [router, sessionId]);

  const isSynced = state.status === "synced";
  const isError = state.status === "error";

  return (
    <div
      className={`rounded-lg border p-4 text-sm ${
        isSynced
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : isError
            ? "border-amber-200 bg-amber-50 text-amber-900"
            : "border-brand-orange/30 bg-brand-orange/10 text-purple-900"
      }`}
    >
      <div className="flex items-start gap-3">
        {isSynced ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        ) : isError ? (
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        ) : (
          <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <p className="font-medium">{state.message}</p>
          {isError ? (
            <p className="mt-1 text-xs opacity-80">
              If Account still shows the wrong plan, keep this checkout tab open and tell us the
              checkout session id from the URL.
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild className="bg-brand-orange text-primary-foreground hover:bg-brand-orange-deep">
          <Link href="/account">Open account</Link>
        </Button>
        <Button asChild variant="outline" className="bg-transparent">
          <Link href="/#pricing">Back to plans</Link>
        </Button>
      </div>
    </div>
  );
}
