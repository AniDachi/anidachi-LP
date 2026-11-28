"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, Mail, Monitor, Smartphone } from "lucide-react";
import { AnidachiLogo } from "./anidachi-logo";
import styles from "./mobile-install-panel.module.css";

export function MobileInstallEmail({ titleId, descriptionId }: { titleId: string; descriptionId: string }) {
  const [accountEmail, setAccountEmail] = useState("");
  const [editedEmail, setEditedEmail] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const pending = useRef<AbortController | null>(null);
  const email = editedEmail ?? accountEmail;

  useEffect(() => {
    const controller = new AbortController();
    async function prefill() {
      try {
        const response = await fetch("/api/me", { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json();
        if (!controller.signal.aborted && typeof data?.user?.email === "string") setAccountEmail(data.user.email);
      } catch { /* The address can always be entered manually. */ }
    }
    void prefill();
    return () => {
      controller.abort();
      pending.current?.abort();
    };
  }, []);

  useEffect(() => { if (sentTo) heading.current?.focus(); }, [sentTo]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || sentTo) return;
    const address = email.trim();
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError("");
    const timeout = setTimeout(() => controller.abort(), 22000);
    try {
      const response = await fetch("/api/extension/install-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address }),
        signal: controller.signal,
      });
      if (response.ok && (await response.json()).ok === true) {
        setSentTo(address);
      } else if (response.status === 429) {
        const minutes = Math.ceil(Number(response.headers.get("Retry-After")) / 60);
        setError(minutes > 0 ? `Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}, or use Share link.` : "Try again later, or use Share link.");
      } else if (response.status === 400) {
        setError("Enter a valid email address.");
      } else {
        setError("Couldn't send the link. Try again or use Share link.");
      }
    } catch {
      setError("Couldn't confirm the email was sent. Check your inbox or use Share link.");
    } finally {
      clearTimeout(timeout);
      pending.current = null;
      setBusy(false);
    }
  }

  return <>
    <div className={styles.art} aria-hidden="true">
      <span className={styles.device}><Smartphone size={55} strokeWidth={1.4} absoluteStrokeWidth /><AnidachiLogo size={17} aria-hidden /></span>
      <ArrowRight className={styles.arrow} size={27} strokeWidth={1.4} />
      <span className={styles.device}>
        <Monitor size={78} strokeWidth={1.5} absoluteStrokeWidth /><Mail className={styles.mail} size={21} strokeWidth={1.5} />
        {sentTo && <span className={styles.stamp}><Check size={12} strokeWidth={3} /></span>}
      </span>
    </div>
    <div key={sentTo ? "sent" : "form"} className={styles.stage}>
      <h2 id={titleId} ref={heading} tabIndex={-1} className={styles.title}>{sentTo ? "Check your inbox" : <>Install AniDachi on<br /> your computer</>}</h2>
      {sentTo ? <>
        <p id={descriptionId} className={styles.description}>We sent the install link to<br /><strong>{sentTo}</strong></p>
        <p className={styles.hint}>Open the email in Chrome on your computer to add AniDachi.</p>
        <button type="button" className={styles.edit} onClick={() => {
          setEditedEmail(sentTo);
          setSentTo("");
          window.requestAnimationFrame(() => input.current?.focus());
        }}>Change email</button>
      </> : <>
        <p id={descriptionId} className={styles.description}>We’ll email you a link to install AniDachi in Chrome on your computer.</p>
        <form className={styles.form} aria-busy={busy} onSubmit={submit}>
          <label htmlFor={`${titleId}-email`}>Email address</label>
          <input id={`${titleId}-email`} ref={input} type="email" autoComplete="email" inputMode="email" required
            maxLength={254} readOnly={busy} placeholder="you@example.com" value={email}
            aria-describedby={error ? `${titleId}-error` : undefined}
            onChange={event => { setEditedEmail(event.target.value); setError(""); }} />
          {error && <p id={`${titleId}-error`} className={styles.error} role="alert">{error}</p>}
          <button type="submit" className={styles.primary} disabled={busy}><Mail size={18} aria-hidden="true" />{busy ? "Sending…" : "Send install link"}</button>
        </form>
      </>}
    </div>
  </>;
}
