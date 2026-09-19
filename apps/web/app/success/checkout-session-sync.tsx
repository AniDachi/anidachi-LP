"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, CreditCard, Loader2 } from "lucide-react";
import { AnidachiLogo } from "@/components/anidachi-logo";
import { Button } from "@/components/ui/button";
import { CardContent, CardDescription, CardHeader } from "@/components/ui/card";

type SyncState = {
  status: "syncing" | "synced" | "error" | "missing" | "inactive";
  message: string;
};

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  plus: "Plus",
  pro: "Pro",
};

export function CheckoutSessionSync({
  sessionId,
  initialPlanCode,
  children,
}: {
  sessionId?: string;
  initialPlanCode: string;
  children?: ReactNode;
}) {
  const router = useRouter();
  const [state, setState] = useState<SyncState>({
    status: sessionId ? "syncing" : "missing",
    message: sessionId
      ? "Confirming your subscription with Stripe..."
      : `Your current AniDachi plan is ${PLAN_LABELS[initialPlanCode] ?? initialPlanCode}.`,
  });

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;
    async function sync() {
      setState({
        status: "syncing",
        message: "Confirming your subscription with Stripe...",
      });
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

        if (
          !response.ok ||
          !payload?.ok ||
          !["free", "plus", "pro"].includes(payload.planCode ?? "")
        ) {
          setState({
            status: "error",
            message:
              payload?.error ??
              "We could not verify your subscription. Refresh this page or check Account → Subscription.",
          });
          return;
        }

        const planLabel = PLAN_LABELS[payload.planCode ?? ""];
        const hasPaidAccess =
          payload.planCode === "plus" || payload.planCode === "pro";
        setState({
          status: hasPaidAccess ? "synced" : "inactive",
          message: hasPaidAccess
            ? `Your AniDachi account is active on ${planLabel}.`
            : "Your current AniDachi plan is Free. Check Account → Subscription for details.",
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
  const isSyncing = state.status === "syncing";
  const StatusIcon = isSynced
    ? CheckCircle2
    : isError
      ? AlertCircle
      : isSyncing
        ? Loader2
        : CreditCard;
  const title = isSynced
    ? "Subscription confirmed"
    : isError
      ? "Could not confirm your subscription"
      : isSyncing
        ? "Checking your subscription"
        : state.status === "missing"
          ? "Your subscription"
          : "Subscription status";
  const description = isSynced
    ? "Your subscription is ready to use."
    : isError
      ? "Check your account or refresh this page to try again."
      : isSyncing
        ? "Please wait while we check your checkout with Stripe."
        : "View your current plan and billing details in your account.";

  return (
    <>
      <CardHeader className="text-center">
        <div className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center">
          <AnidachiLogo size={64} priority />
          <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-ani-line bg-ani-panel">
            <StatusIcon
              className={`h-4 w-4 ${isSynced ? "text-ani-progress" : isError ? "text-destructive" : "text-ani-muted"} ${isSyncing ? "animate-spin motion-reduce:animate-none" : ""}`}
              aria-hidden="true"
            />
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-ani-text">
          {title}
        </h1>
        <CardDescription className="text-lg mt-2">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div
          role={isError ? "alert" : "status"}
          className={`rounded-lg border p-4 text-sm ${
            isSynced
              ? "border-ani-line bg-ani-selected-quiet text-ani-text"
              : isError
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-ani-line bg-ani-panel text-ani-muted"
          }`}
        >
          <div className="flex items-start gap-3">
            <StatusIcon
              className={`mt-0.5 h-5 w-5 shrink-0 ${isSynced ? "text-ani-progress" : ""} ${isSyncing ? "animate-spin motion-reduce:animate-none" : ""}`}
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="font-medium">{state.message}</p>
              {isError ? (
                <p className="mt-1 text-xs opacity-80">
                  If Account still shows the wrong plan, keep this checkout tab
                  open and tell us the checkout session id from the URL.
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="cream" size="control">
              <Link href="/extension">Download for Chrome</Link>
            </Button>
            <Button asChild variant="outline" className="bg-transparent">
              <Link href="/account">Open account</Link>
            </Button>
          </div>
        </div>
        {children}
      </CardContent>
    </>
  );
}
