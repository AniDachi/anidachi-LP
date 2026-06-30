import type { Metadata } from "next";
import { Suspense } from "react";
import { JoinClient } from "./join-client";

export const metadata: Metadata = {
  title: "Join the waitlist — AniDachi",
  robots: { index: false, follow: false },
};

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-background text-foreground/60">
          Loading…
        </main>
      }
    >
      <JoinClient />
    </Suspense>
  );
}
