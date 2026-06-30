import type { Metadata } from "next";
import { Suspense } from "react";
import { JoinCompleteClient } from "./join-complete-client";

export const metadata: Metadata = {
  title: "Waitlist confirmed — AniDachi",
  robots: { index: false, follow: false },
};

export default function JoinCompletePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background text-foreground/60">
          Loading…
        </main>
      }
    >
      <JoinCompleteClient />
    </Suspense>
  );
}
