"use client";

import { Monitor } from "lucide-react";
import { AuthPageCard, AuthPageShell } from "@/components/auth-page-shell";
import { AnidachiLogo } from "@/components/anidachi-logo";

export function ExtensionConnectMobileConfirm({
  callbackUrl,
}: {
  callbackUrl: string;
}) {
  return (
    <AuthPageShell maxWidth="max-w-md">
      <AuthPageCard>
        <div className="mb-6 text-center">
          <AnidachiLogo size={48} priority className="mx-auto" />
          <h1 className="mt-4 text-xl font-bold tracking-tight text-foreground">
            Switch to Chrome on your computer
          </h1>
          <p className="mt-2 text-sm text-foreground/55">
            You&apos;re signed in on mobile. Open Chrome on your desktop and return to the
            extension connect flow to finish linking AniDachi.
          </p>
        </div>

        <div className="rounded-xl border border-brand-border bg-background px-4 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-orange/15 text-brand-orange">
              <Monitor className="h-5 w-5" aria-hidden />
            </span>
            <p className="text-sm text-foreground/70">
              If you already have the extension open on desktop, tap continue there. This
              button is only for completing the link from a desktop browser session.
            </p>
          </div>
        </div>

        <a
          href={callbackUrl}
          className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand-orange px-5 text-sm font-semibold text-primary-foreground transition hover:bg-brand-orange-deep"
        >
          Continue extension connect
        </a>

        <p className="mt-4 text-center text-xs text-foreground/45">
          On mobile, the extension install lives on desktop Chrome — not in this browser.
        </p>
      </AuthPageCard>
    </AuthPageShell>
  );
}
