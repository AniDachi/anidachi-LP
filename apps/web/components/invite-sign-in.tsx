import { LoginOAuthButtons } from "@/app/login/login-oauth-buttons";
import { LoginEmailForm } from "@/app/login/login-email-form";
import styles from "./invite-ticket.module.css";

export function InviteSignIn({ returnTo, emailEnabled, error, preview = false }: {
  returnTo: string; emailEnabled: boolean; error?: string | null; preview?: boolean;
}) {
  const next = encodeURIComponent(returnTo);
  return <div className={styles.login}>
    <h2>Sign in to join</h2>
    {error && <p role="alert" className={styles.note}>{error}</p>}
    <LoginOAuthButtons safeNext={next} provider="google" preview={preview} />
    {emailEnabled && <LoginEmailForm returnTo={returnTo} preview={preview} />}
    <details className={styles.options}>
      <summary>More sign-in options</summary>
      <LoginOAuthButtons safeNext={next} provider="discord" preview={preview} />
    </details>
    <p className={styles.terms}>By continuing, you agree to our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>.</p>
  </div>;
}
