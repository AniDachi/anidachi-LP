"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, Chrome, Loader2, ArrowUpRight } from "lucide-react";
import { AnidachiLogo } from "./anidachi-logo";
import { Button } from "./ui/button";
import { ProviderLogo } from "../../extension/src/provider-logo";
import { CHROME_WEB_STORE_URL } from "@/lib/install-cta";
import { EXTENSION_WELCOME_PATH, type ExtensionWelcome } from "@/lib/extension-welcome";
import { requestExtensionPresence } from "@/lib/extension-presence-client";
import { isMobileInstallDevice } from "@/lib/mobile-install";
import { InstallLink } from "./install-link";
import styles from "./extension-install.module.css";

export function ExtensionWelcomeHero({ welcome, extensionId }: {
  welcome: ExtensionWelcome; extensionId?: string | null;
}) {
  const router = useRouter();
  const [present, setPresent] = useState<boolean | null>(null);
  const [mobile, setMobile] = useState<boolean | null>(null);
  const [expired, setExpired] = useState(false);
  // Initial SSR uses document age; later snapshots use the refresh request age.
  // Both clocks are monotonic and independent of the user's wall-clock setting.
  const snapshotRequestStarted = useRef(0);
  const refreshPending = useRef(false);
  const refresh = useCallback(() => {
    if (!refreshPending.current) snapshotRequestStarted.current = performance.now();
    refreshPending.current = true;
    router.refresh();
  }, [router]);
  const active = !expired && (welcome.kind === "trial" || welcome.kind === "paid");
  const expiresInMs = "expiresInMs" in welcome ? welcome.expiresInMs : undefined;

  useEffect(() => {
    refreshPending.current = false;
    setExpired(false);
    if (expiresInMs === undefined) return;
    const remaining = Math.max(0, expiresInMs - Math.max(0, performance.now() - snapshotRequestStarted.current));
    if (remaining === 0) { setExpired(true); refresh(); return; }
    const deadline = performance.now() + remaining;
    let timer: ReturnType<typeof setTimeout>;
    const checkBoundary = () => {
      const left = deadline - performance.now();
      if (left <= 0) { setExpired(true); refresh(); return; }
      // Long annual subscriptions may exceed the browser timer limit.
      timer = setTimeout(checkBoundary, Math.min(left, 2_147_483_647));
    };
    checkBoundary();
    return () => clearTimeout(timer);
  }, [welcome, expiresInMs, refresh]);

  useEffect(() => {
    const isMobile = isMobileInstallDevice(navigator);
    setMobile(isMobile);
    let abort = new AbortController();
    let focusTimer: ReturnType<typeof setTimeout> | undefined;
    let lastFocus = 0;
    const probe = () => {
      abort.abort(); abort = new AbortController();
      const current = abort;
      if (!active || isMobile) return;
      void requestExtensionPresence(extensionId, current.signal).then(value => {
        if (!current.signal.aborted) setPresent(value);
      });
    };
    probe();
    const onFocus = () => {
      if (document.visibilityState === "hidden" || Date.now() - lastFocus < 1000) return;
      clearTimeout(focusTimer);
      focusTimer = setTimeout(() => { lastFocus = Date.now(); probe(); refresh(); }, 150);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => { abort.abort(); clearTimeout(focusTimer); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, [active, extensionId, refresh]);

  const plan = "plan" in welcome ? (welcome.plan === "pro" ? "Pro" : "Plus") : "";
  return (
    <section className={`${styles.hero} ${styles.welcome}`} aria-labelledby="welcome-title">
      <div className={styles.brand}><AnidachiLogo size={44} priority aria-hidden /><span>AniDachi</span></div>
      <h1 id="welcome-title" className={styles.title}>
        {active ? <>Your <span className={styles.welcomeAccent}>{plan}</span>{welcome.kind === "trial"
          ? <><br />{welcome.cardlessWithoutRenewal ? "3-day trial is active." : "trial is active."}</>
          : <> plan is active.</>}</>
          : expired ? "Checking your access…" : welcome.kind === "sign_in" ? "Sign in to continue."
          : welcome.kind === "error" ? "Let’s check your subscription." : "Check your subscription."}
      </h1>
      <p className={styles.welcomeDescription}>
        {active ? (welcome.kind === "trial" && welcome.cardlessWithoutRenewal
          ? "No card needed. No automatic charge." : "You’re ready to watch with friends.")
          : expired ? "Your latest subscription status will appear here."
          : welcome.kind === "sign_in" ? "Use the account you chose for your trial or subscription."
          : welcome.kind === "error" ? "We couldn’t confirm your subscription. Try again in a moment."
          : "There’s no active trial or subscription to confirm for this account."}
      </p>
      {active ? <>
        <div className={styles.welcomeSetup} aria-live="polite">
          {mobile === null || (!mobile && present === null) ? <div role="status" className={styles.welcomeChecking}>
            <Loader2 size={20} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /><span className="sr-only">Preparing your next step</span>
          </div> : mobile ? <>
            <p>Open AniDachi in Chrome on your computer.</p>
            <Button asChild variant="cream" size="control" className={styles.installButton}>
              <InstallLink href={CHROME_WEB_STORE_URL} shareHref={EXTENSION_WELCOME_PATH} target="_blank" rel="noopener noreferrer">
                <Chrome size={22} aria-hidden="true" />Install AniDachi
              </InstallLink>
            </Button>
          </> : present ? <span className={styles.welcomeReady}><Check size={17} aria-hidden="true" />Extension ready</span> : <>
            <Button asChild variant="cream" size="control" className={styles.installButton}>
              <InstallLink href={CHROME_WEB_STORE_URL} shareHref={EXTENSION_WELCOME_PATH} target="_blank" rel="noopener noreferrer"><Chrome size={22} aria-hidden="true" />Install AniDachi<span className="sr-only">, opens in a new tab</span></InstallLink>
            </Button>
            <p>Install the extension, then open a video. Already installed? Choose a platform below.</p>
          </>}
        </div>
        {mobile === false && present !== null ? <>
          <h2 className={styles.welcomePrompt}>Where are we watching?</h2>
          <div className={styles.welcomePlatforms}>
            {(["youtube", "crunchyroll", "netflix"] as const).map(provider => <a key={provider} href={`https://www.${provider}.com`} target="_blank" rel="noopener noreferrer">
              <ProviderLogo provider={provider} label={provider === "youtube" ? "YouTube" : provider === "netflix" ? "Netflix" : "Crunchyroll"} />
              <span>{provider === "youtube" ? "YouTube" : provider === "netflix" ? "Netflix" : "Crunchyroll"}</span><ArrowUpRight size={17} aria-hidden="true" />
              <span className="sr-only">, opens in a new tab</span>
            </a>)}
          </div>
          <p className={styles.welcomeHint}>Choose a video, then open the AniDachi capsule in the player.</p>
        </> : null}
        <Link className={styles.welcomeSecondary} href="/account/billing">Manage subscription</Link>
      </> : <div className={styles.action}>
        {welcome.kind === "error" ? <Button variant="cream" onClick={refresh}>Try again</Button>
          : <Button asChild variant="cream"><Link href={welcome.kind === "sign_in" ? `/login?next=${encodeURIComponent(EXTENSION_WELCOME_PATH)}` : "/account/billing"}>
            {welcome.kind === "sign_in" ? "Sign in" : "View subscription"}</Link></Button>}
      </div>}
    </section>
  );
}
