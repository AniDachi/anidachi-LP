"use client";

import { useSearchParams } from "next/navigation";
import { AnidachiLogo } from "@/components/anidachi-logo";
import { AuthPageCard, AuthPageShell } from "@/components/auth-page-shell";
import { LoginOAuthButtons } from "@/app/login/login-oauth-buttons";

export function JoinClient() {
  const searchParams = useSearchParams();
  const ref = searchParams.get("ref")?.trim() ?? "";

  const returnPath = ref
    ? `/join/complete?ref=${encodeURIComponent(ref)}`
    : "/join/complete";
  const safeNext = encodeURIComponent(returnPath);

  return (
    <AuthPageShell maxWidth="max-w-md">
      <AuthPageCard>
        <div className="mb-6 text-center">
          <AnidachiLogo size={48} priority className="mx-auto" />
          <h1 className="mt-4 text-xl font-bold tracking-tight text-foreground">
            Join the AniDachi waitlist
          </h1>
          <p className="mt-1.5 text-sm text-foreground/50">
            {ref
              ? "A friend invited you — sign in below to claim your spot."
              : "Sign in to claim your early access spot."}
          </p>
        </div>

        <LoginOAuthButtons safeNext={safeNext} />

        <p className="mt-5 text-center text-xs text-foreground/45">
          Discord or Google · No survey required
        </p>
      </AuthPageCard>
    </AuthPageShell>
  );
}
