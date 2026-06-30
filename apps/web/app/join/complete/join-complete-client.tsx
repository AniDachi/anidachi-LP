"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check } from "lucide-react";
import { AnidachiLogo } from "@/components/anidachi-logo";
import { AuthPageCard, AuthPageShell } from "@/components/auth-page-shell";
import { Button } from "@/components/ui/button";

type JoinState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "success";
      waitlistPosition: number | null;
      referralCount: number;
    };

export function JoinCompleteClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const ref = searchParams.get("ref")?.trim() ?? "";
  const started = useRef(false);
  const [state, setState] = useState<JoinState>({ status: "loading" });

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function completeJoin() {
      const res = await fetch("/api/waitlist/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "referral_join",
          referredBy: ref || undefined,
        }),
      });

      if (res.status === 401) {
        const back = ref ? `/join?ref=${encodeURIComponent(ref)}` : "/join";
        router.replace(back);
        return;
      }

      if (!res.ok) {
        setState({
          status: "error",
          message: "Could not join the waitlist. Please try again.",
        });
        return;
      }

      const data = (await res.json()) as {
        waitlistPosition?: number | null;
        referralCount?: number;
      };

      setState({
        status: "success",
        waitlistPosition:
          typeof data.waitlistPosition === "number" ? data.waitlistPosition : null,
        referralCount:
          typeof data.referralCount === "number" ? data.referralCount : 0,
      });
    }

    void completeJoin();
  }, [ref, router]);

  return (
    <AuthPageShell maxWidth="max-w-md">
      <AuthPageCard>
        <div className="mb-6 text-center">
          <AnidachiLogo size={48} priority className="mx-auto" />
          <h1 className="mt-4 text-xl font-bold tracking-tight text-foreground">
            {state.status === "success" ? "You're on the list!" : "Joining waitlist…"}
          </h1>
        </div>

        {state.status === "loading" ? (
          <p className="text-center text-sm text-foreground/60">
            Saving your spot…
          </p>
        ) : null}

        {state.status === "error" ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-destructive">{state.message}</p>
            <Button asChild variant="outline">
              <Link href={ref ? `/join?ref=${encodeURIComponent(ref)}` : "/join"}>
                Try again
              </Link>
            </Button>
          </div>
        ) : null}

        {state.status === "success" ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-brand-orange/35 bg-brand-orange/10 px-4 py-4">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-orange/20">
                <Check className="h-5 w-5 text-brand-orange" aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Spot confirmed</p>
                {state.waitlistPosition !== null ? (
                  <p className="mt-0.5 text-sm text-foreground/70">
                    You&apos;re{" "}
                    <span className="font-bold text-brand-orange">
                      #{state.waitlistPosition}
                    </span>{" "}
                    in line. We&apos;ll notify you when we launch.
                  </p>
                ) : (
                  <p className="mt-0.5 text-sm text-foreground/70">
                    We&apos;ll notify you the moment we launch.
                  </p>
                )}
              </div>
            </div>

            <Button
              asChild
              className="w-full bg-brand-orange font-semibold text-primary-foreground hover:bg-brand-orange-deep"
            >
              <Link href="/">Back to homepage</Link>
            </Button>
          </div>
        ) : null}
      </AuthPageCard>
    </AuthPageShell>
  );
}
