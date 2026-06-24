import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuthPageCard, AuthPageShell } from "@/components/auth-page-shell";
import { AnidachiLogo } from "@/components/anidachi-logo";
import { getSession } from "@/lib/anidachi-auth/session";
import { sanitizeAuthReturnTo } from "@/lib/anidachi-auth/return-to";
import { getLoginContext } from "@/lib/login-context";
import { LoginOAuthButtons } from "./login-oauth-buttons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in — AniDachi",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

const ERROR_MESSAGES: Record<string, string> = {
  missing_params: "Something went wrong during sign-in. Please try again.",
  invalid_state: "Session expired. Please try again.",
  oauth_failed: "Sign-in failed. Please try again.",
  db_error: "Unable to create your account. Please try again.",
  token_error: "Unable to complete sign-in. Please try again.",
  extension_invalid_redirect: "Extension sign-in link was invalid. Please try again from the extension.",
};

export default async function LoginPage({ searchParams }: Props) {
  const { next, error } = await searchParams;
  const sanitizedNext = sanitizeAuthReturnTo(next);
  const session = await getSession();
  if (session) redirect(sanitizedNext || "/account");

  const safeNext = sanitizedNext ? encodeURIComponent(sanitizedNext) : "";
  const loginContext = getLoginContext(sanitizedNext);

  const errorMessage = error
    ? (ERROR_MESSAGES[error] ?? "An error occurred. Please try again.")
    : null;

  return (
    <AuthPageShell maxWidth="max-w-md">
      <AuthPageCard>
        <div className="mb-6 text-center">
          <AnidachiLogo size={48} priority className="mx-auto" />
          <h1 className="mt-4 text-xl font-bold tracking-tight text-foreground">
            {loginContext.headline}
          </h1>
          <p className="mt-1.5 text-sm text-foreground/50">{loginContext.subtitle}</p>
          {loginContext.extensionNote ? (
            <p className="mt-2 text-xs font-medium text-brand-orange">
              {loginContext.extensionNote}
            </p>
          ) : null}
        </div>

        {errorMessage ? (
          <div
            className="mb-5 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
            role="alert"
          >
            <p>{errorMessage}</p>
            <p className="mt-1.5 text-xs text-red-200/80">
              Try again with Discord or Google below.
            </p>
          </div>
        ) : null}

        <LoginOAuthButtons safeNext={safeNext} />

        <p className="mt-5 text-center text-xs text-foreground/45">
          Syncs with Crunchyroll · Free to start
        </p>

        <p className="mt-6 text-center text-xs text-foreground/45">
          By continuing you agree to our{" "}
          <a href="/terms" className="underline underline-offset-2 hover:text-foreground/70">
            Terms
          </a>{" "}
          and{" "}
          <a href="/privacy" className="underline underline-offset-2 hover:text-foreground/70">
            Privacy Policy
          </a>
          .
        </p>
      </AuthPageCard>
    </AuthPageShell>
  );
}
