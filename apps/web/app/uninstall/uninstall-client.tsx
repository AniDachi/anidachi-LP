"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnidachiLogo } from "../../components/anidachi-logo";
import { CHROME_WEB_STORE_URL } from "../../lib/install-cta";
import { UNINSTALL_OFFER_VALID_FOR_MS, type UninstallOffer, type UninstallPlan, type UninstallPrice } from "../../lib/anidachi-auth/uninstall-offer";
import { UninstallSurvey } from "./uninstall-survey";

const money = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount / 100);
const name = (plan: UninstallPlan) => plan === "pro" ? "Pro" : "Plus";
const date = (value: string) => new Date(value).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
type Dialog = "plans" | "review" | "renewal" | "reinstall" | null;
const changed = "Your account or offer changed. Review the current offer before continuing.";
function samePrice(a: UninstallPrice, b: UninstallPrice) {
  return a.planCode === b.planCode && a.currency === b.currency && a.billingPeriod === b.billingPeriod &&
    a.ordinaryAmount === b.ordinaryAmount && a.discountedAmount === b.discountedAmount;
}
function reviewedEqual(a: UninstallOffer, b: UninstallOffer) {
  if (a.ownerUserId !== b.ownerUserId || a.kind !== b.kind) return false;
  // The opaque review token is reissued with a new expiry on every GET. Compare
  // displayed terms here; POST retains the original token for server validation
  // of its expiry and complete snapshot, including terms the browser cannot see.
  if (a.kind === "first_month" && b.kind === "first_month")
    return a.prices.length === b.prices.length && a.prices.every((price) =>
      b.prices.some((fresh) => samePrice(price, fresh)));
  if (a.kind === "renewal" && b.kind === "renewal")
    return a.renewsAt === b.renewsAt && samePrice(a.price, b.price);
  return false;
}
function validPrice(value: unknown): value is UninstallPrice {
  if (!value || typeof value !== "object") return false;
  const p = value as UninstallPrice;
  return (p.planCode === "plus" || p.planCode === "pro") && p.currency === "usd" && p.billingPeriod === "monthly" &&
    Number.isSafeInteger(p.ordinaryAmount) && p.ordinaryAmount > 0 &&
    Number.isSafeInteger(p.discountedAmount) && p.discountedAmount > 0 && p.discountedAmount < p.ordinaryAmount;
}
function validOffer(value: UninstallOffer): boolean {
  if (value.kind === "sign_in") return value.ownerUserId === null;
  if (!value.ownerUserId) return value.kind === "unavailable";
  if (value.kind === "first_month") return typeof value.revision === "string" && !!value.revision &&
    Array.isArray(value.prices) && value.prices.length === 2 && value.prices.every(validPrice) &&
    value.prices.some((p) => p.planCode === "plus") && value.prices.some((p) => p.planCode === "pro");
  if (value.kind === "renewal" || value.kind === "claimed") return validPrice(value.price) &&
    typeof value.renewsAt === "string" && Number.isFinite(Date.parse(value.renewsAt)) &&
    (value.kind === "renewal" ? typeof value.revision === "string" && !!value.revision : ["accepted", "applied", "ineligible", "reconciliation"].includes(value.state));
  return typeof value.reason === "string";
}
async function getOffer(): Promise<UninstallOffer> {
  const response = await fetch("/api/uninstall/offer", { cache: "no-store", credentials: "same-origin" });
  const value = await response.json();
  if (!response.ok || !value || !["sign_in", "first_month", "renewal", "claimed", "manage", "former", "disabled", "unavailable"].includes(value.kind) ||
    !(value.ownerUserId === null || typeof value.ownerUserId === "string") ||
    !Number.isFinite(value.validForMs) || value.validForMs <= 0 || !validOffer(value)) throw new Error("We couldn’t verify your offer. Please retry.");
  return value;
}
function checkoutDestination(value: unknown, kind: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value, window.location.origin);
    if (url.username || url.password) return null;
    if (kind === "checkout" && url.protocol === "https:" && url.hostname === "checkout.stripe.com") return url.href;
    if (kind === "manage_subscription" && url.origin === window.location.origin && url.pathname === "/account/billing") return url.href;
  } catch { /* never follow an unverified destination */ }
  return null;
}

export function UninstallClient({ initialPlan = "plus", stagingInstallation }: {
  initialPlan?: UninstallPlan; stagingInstallation: boolean;
}) {
  const [offer, setOffer] = useState<UninstallOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<UninstallPlan>(initialPlan);
  const [dialog, setDialog] = useState<Dialog>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const generation = useRef(0);
  const alive = useRef(false);
  const actionLock = useRef(false);
  const checkoutRequest = useRef<{ key: string; id: string } | null>(null);
  const fetchedAt = useRef(0);
  const currentOffer = useRef<UninstallOffer | null>(null);
  const applyOffer = useCallback((next: UninstallOffer | null) => {
    currentOffer.current = next; setOffer(next); fetchedAt.current = Date.now();
  }, []);
  const refresh = useCallback(async () => {
    const token = ++generation.current;
    applyOffer(null); setLoading(true); setDialog(null); setError("");
    try {
      const next = await getOffer();
      if (!alive.current || generation.current !== token || document.visibilityState === "hidden") return;
      applyOffer(next);
    } catch {
      if (alive.current && generation.current === token) setError("We couldn’t verify your offer. Please retry.");
    } finally { if (alive.current && generation.current === token) setLoading(false); }
  }, [applyOffer]);
  useEffect(() => {
    alive.current = true;
    void refresh();
    const invalidate = () => {
      ++generation.current; applyOffer(null); setLoading(true); setDialog(null); setError("");
    };
    const visibility = () => { if (document.visibilityState === "hidden") invalidate(); else void refresh(); };
    window.addEventListener("blur", invalidate);
    window.addEventListener("focus", refresh);
    window.addEventListener("pagehide", invalidate);
    window.addEventListener("pageshow", refresh);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      alive.current = false;
      window.removeEventListener("blur", invalidate); window.removeEventListener("focus", refresh);
      window.removeEventListener("pagehide", invalidate); window.removeEventListener("pageshow", refresh);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [applyOffer, refresh]);
  useEffect(() => {
    if (!offer) return;
    const ttl = Math.max(1, Math.min(offer.validForMs || UNINSTALL_OFFER_VALID_FOR_MS, UNINSTALL_OFFER_VALID_FOR_MS));
    const timer = window.setTimeout(() => { void refresh(); }, ttl);
    return () => window.clearTimeout(timer);
  }, [offer, refresh]);
  useEffect(() => {
    const element = dialogRef.current;
    if (!element) return;
    if (dialog && !element.open) {
      returnFocus.current = document.activeElement as HTMLElement;
      element.showModal();
    } else if (!dialog && element.open) {
      element.close();
      const target = returnFocus.current?.isConnected ? returnFocus.current : document.getElementById("uninstall-offer-title");
      target?.focus({ preventScroll: true });
    }
    if (dialog) titleRef.current?.focus({ preventScroll: true });
  }, [dialog]);
  function selectPlan(next: UninstallPlan) {
    setPlan(next);
    const url = new URL(window.location.href);
    url.searchParams.set("plan", next);
    window.history.replaceState(null, "", url);
  }
  function open(next: Dialog) { setError(""); setDialog(next); }
  const active = (token: number) => alive.current && generation.current === token && document.visibilityState !== "hidden";
  async function transact(kind: "checkout" | "claim") {
    const review = currentOffer.current;
    if (actionLock.current || !review?.ownerUserId ||
      (kind === "checkout" ? review.kind !== "first_month" : review.kind !== "renewal")) return;
    actionLock.current = true; setBusy(true); setError("");
    const token = generation.current;
    try {
      const fresh = await getOffer();
      if (!active(token)) return;
      if (!reviewedEqual(review, fresh) || Date.now() - fetchedAt.current >= Math.min(review.validForMs, UNINSTALL_OFFER_VALID_FOR_MS)) {
        applyOffer(fresh); setDialog(null); throw new Error(changed);
      }
      const expectedOwnerUserId = review.ownerUserId;
      let body: object;
      if (review.kind === "first_month" && kind === "checkout") {
        const expectedPrice = review.prices.find((p) => p.planCode === plan);
        if (!expectedPrice) throw new Error("Please review a monthly plan again.");
        const key = `${expectedOwnerUserId}:${review.revision}:${plan}`;
        if (checkoutRequest.current?.key !== key) checkoutRequest.current = { key, id: window.crypto.randomUUID() };
        body = { expectedOwnerUserId, revision: review.revision, planCode: plan, expectedPrice, requestId: checkoutRequest.current.id };
      } else if (review.kind === "renewal") body = { expectedOwnerUserId, revision: review.revision };
      else return;
      const response = await fetch(`/api/uninstall/${kind}`, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!active(token)) return;
      if (result.ownerUserId !== expectedOwnerUserId) {
        await refresh(); throw new Error(changed);
      }
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "We couldn’t confirm the result. Please retry.");
      // A response from the old account must never navigate or announce success.
      const verified = await getOffer();
      if (!active(token)) return;
      if (verified.ownerUserId !== expectedOwnerUserId) {
        applyOffer(verified); setDialog(null); throw new Error(changed);
      }
      if (kind === "claim") {
        if (result.kind !== "claimed" || verified.kind !== "claimed") throw new Error("We couldn’t confirm your discount. Reload the offer to check.");
        applyOffer(verified); setDialog(null);
      } else {
        const destination = checkoutDestination(result.url, result.kind);
        if (!destination) throw new Error("We couldn’t verify checkout. Please retry.");
        window.location.assign(destination);
      }
    } catch (e) {
      if (alive.current && (generation.current === token || (e instanceof Error && e.message === changed)))
        setError(e instanceof Error ? e.message : "We couldn’t confirm the result. Please retry.");
    } finally {
      actionLock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const signedOut = offer?.kind === "sign_in";
  const first = offer?.kind === "first_month" ? offer : null;
  const renewal = offer?.kind === "renewal" ? offer : null;
  const claimed = offer?.kind === "claimed" ? offer : null;
  const selectedPrice = first?.prices.find((p) => p.planCode === plan);
  const surveyOnly = offer?.kind === "former";
  const unavailable = !loading && (!offer || offer.kind === "unavailable");
  const loginHref = `/login?next=${encodeURIComponent(`/uninstall?plan=${plan}`)}`;
  async function manage() {
    if (actionLock.current) return;
    const review = currentOffer.current;
    const token = generation.current;
    actionLock.current = true; setBusy(true); setError("");
    try {
      const fresh = await getOffer();
      if (!active(token)) return;
      if (fresh.ownerUserId !== review?.ownerUserId) {
        applyOffer(fresh); setDialog(null); throw new Error(changed);
      }
      const path = "manageUrl" in fresh ? fresh.manageUrl : "/account/billing";
      const destination = checkoutDestination(path, "manage_subscription");
      if (!destination) throw new Error("Please open your account to manage your subscription.");
      window.location.assign(destination);
    } catch {
      if (active(token)) setError("We couldn’t verify your account. Reload the offer, or open your account to manage your subscription.");
    } finally { actionLock.current = false; if (alive.current) setBusy(false); }
  }
  return <div className="uninstall-page">
    <header className="uninstall-header"><Link href="/" className="uninstall-brand"><AnidachiLogo size={32} aria-hidden priority /><span>AniDachi</span></Link><Link href="/" className="uninstall-home">Home <span aria-hidden="true">↗</span></Link></header>
    <main id="main-content" className="uninstall-main">
      <h1 className="sr-only">AniDachi uninstall feedback</h1>
      <article className="uninstall-card" data-survey-only={surveyOnly}>
        {!surveyOnly ? <><section className="uninstall-offer" aria-label="Your offer" aria-busy={loading}>
          {loading ? <p role="status" className="uninstall-description">Checking your account…</p> : first || renewal ? <>
            <h2 id="uninstall-offer-title" tabIndex={-1} className="uninstall-value">40% off</h2>
            <p className="uninstall-subtitle">{first ? "One month of Plus or Pro" : `Your next month of ${name(renewal!.price.planCode)}`}</p>
            <button className="uninstall-primary" disabled={busy} onClick={() => open(first ? "plans" : "renewal")}>Get 40% off <span aria-hidden="true">→</span></button>
            <p className="uninstall-terms">{first ? "One month only · then the regular monthly price" : <>One month only · then <span className="uninstall-nowrap">{money(renewal!.price.ordinaryAmount)}/month</span></>}</p>
          </> : signedOut ? <>
            <h2 id="uninstall-offer-title" tabIndex={-1} className="uninstall-title">Check your offer</h2>
            <p className="uninstall-description">Sign in to see whether a one-time discount is available for your account.</p>
            <button className="uninstall-primary" onClick={() => open("plans")}>Sign in to check your offer <span aria-hidden="true">→</span></button>
          </> : claimed ? <>
            <h2 id="uninstall-offer-title" tabIndex={-1} className="uninstall-title">{claimed.state === "accepted" ? "40% off your next month" : claimed.state === "applied" ? "Your discount was applied" : "Check your subscription"}</h2>
            {claimed.state === "accepted" ? <><p className="uninstall-description">{name(claimed.price.planCode)} · {money(claimed.price.discountedAmount)} on {date(claimed.renewsAt)} (UTC).<br />Then {money(claimed.price.ordinaryAmount)} / month, before taxes.</p><p className="uninstall-saved" role="status"><span aria-hidden="true">✓</span> Discount saved for your next renewal</p></> : claimed.state === "applied" ? <p className="uninstall-description">Your one-time discount has been applied to your invoice. View your subscription for current billing details.</p> : <p className="uninstall-description">{claimed.state === "reconciliation" ? "We’re checking your discount. Please reload the offer or open subscription management." : "This discount is no longer available for the renewal. View your current subscription for details."}</p>}
            {(claimed.state === "reconciliation" || claimed.state === "ineligible") && <button className="uninstall-secondary" onClick={() => void refresh()}>Reload offer</button>}
          </> : offer?.kind === "manage" ? <>
            <h2 id="uninstall-offer-title" tabIndex={-1} className="uninstall-title">Your subscription</h2><p className="uninstall-description">{offer.reason}</p>
            <button className="uninstall-primary uninstall-cream" disabled={busy} onClick={() => void manage()}>Manage subscription <span aria-hidden="true">↗</span></button>
          </> : unavailable ? <>
            <h2 id="uninstall-offer-title" tabIndex={-1} className="uninstall-title">We couldn’t verify your offer</h2><p className="uninstall-description">Please retry before continuing with an offer.</p><button className="uninstall-secondary" onClick={() => void refresh()}>Retry</button>
          </> : <>
            <h2 id="uninstall-offer-title" tabIndex={-1} className="uninstall-title">Thanks for trying AniDachi</h2><p className="uninstall-description">{offer?.kind === "disabled" ? offer.reason : "No uninstall discount is available for this account."}</p><a className="uninstall-text-link" href="/pricing?billing=monthly">View regular plans ↗</a>
          </>}
          {(renewal || claimed || offer?.kind === "manage") && <div className="uninstall-subscription-help"><p>Uninstalling won’t cancel your subscription.</p><button className="uninstall-text-link" disabled={busy} onClick={() => void manage()} aria-label="Manage subscription">Manage <span aria-hidden="true">↗</span></button></div>}
        </section><div className="uninstall-divider" /></> : null}
        {error && !dialog ? <p role="alert" className="uninstall-error">{error} <a href="/account/billing">Open your account</a></p> : null}
        <UninstallSurvey />
        <div className="uninstall-links">
          {stagingInstallation ? <button className="uninstall-text-link" onClick={() => open("reinstall")}>Reinstall staging extension <span aria-hidden="true">↗</span></button> : <a className="uninstall-text-link" href={CHROME_WEB_STORE_URL}>Reinstall extension <span aria-hidden="true">↗</span></a>}
          {surveyOnly ? <a className="uninstall-text-link" href="/pricing?billing=monthly">View plans ↗</a> : null}
        </div>
        {!(renewal || claimed || offer?.kind === "manage") ? <div className="uninstall-management"><a href="/account/billing" className="uninstall-text-link">Manage subscription ↗</a></div> : null}
      </article>
    </main>
    <dialog ref={dialogRef} className="uninstall-dialog" aria-labelledby="uninstall-dialog-title" onCancel={() => setDialog(null)} onClose={() => setDialog(null)}>
      <button className="uninstall-dialog-close" aria-label="Close dialog" onClick={() => setDialog(null)}>×</button>
      <h2 ref={titleRef} tabIndex={-1} id="uninstall-dialog-title" className="uninstall-dialog-title">{dialog === "reinstall" ? "Reinstall staging extension" : dialog === "renewal" ? "40% off your next month" : dialog === "review" ? `${name(plan)}, billed monthly` : "Choose a plan"}</h2>
      {dialog === "reinstall" ? <><p className="uninstall-dialog-lead">In Chrome, open Extensions → Manage Extensions. Turn on Developer mode, choose Load unpacked, and select your existing reviewed staging extension folder.</p><p className="uninstall-dialog-note">If you don’t have the staging folder, ask the AniDachi team for the current reviewed build.</p></> : dialog === "plans" && (first || signedOut) ? <>
        <p className="uninstall-dialog-lead">{first ? "40% off the first month of your new subscription." : "Choose a monthly plan, then sign in to check eligibility."}</p>
        <fieldset className="uninstall-plan-grid" aria-label="Monthly plan">{(["plus", "pro"] as const).map((value) => {
          const price = first?.prices.find((p) => p.planCode === value);
          return <label className="uninstall-plan" key={value}><input type="radio" name="plan" value={value} checked={plan === value} onChange={() => selectPlan(value)} /><h3>{name(value)}</h3>{price ? <><div className="uninstall-plan-price">{money(price.discountedAmount)}<small>first month</small></div><p className="uninstall-plan-after">Then {money(price.ordinaryAmount)} / month</p></> : <p className="uninstall-plan-after">Price confirmed after sign-in</p>}</label>;
        })}</fieldset>
        {signedOut ? <a className="uninstall-primary" href={loginHref}>Sign in to check your offer <span aria-hidden="true">→</span></a> : <button className="uninstall-primary" disabled={!selectedPrice} onClick={() => open("review")}>Continue <span aria-hidden="true">→</span></button>}
        <p className="uninstall-dialog-note">{first ? "USD · Once per account. No combined discounts." : "Signing in won’t start a purchase."}</p>
      </> : dialog === "review" && selectedPrice ? <>
        <p className="uninstall-dialog-lead">40% off the first month of your new subscription.</p><PriceReview price={selectedPrice} />
        <button className="uninstall-primary" disabled={busy} onClick={() => void transact("checkout")}>{busy ? "Checking…" : "Continue to checkout"} <span aria-hidden="true">→</span></button>
        <button className="uninstall-text-link" disabled={busy} onClick={() => open("plans")}>Change plan</button>
        <p className="uninstall-dialog-note">USD. Renews monthly until canceled. Any applicable taxes are shown at checkout.</p>
      </> : dialog === "renewal" && renewal ? <>
        <p className="uninstall-dialog-lead">Your existing {name(renewal.price.planCode)} plan. Renews {date(renewal.renewsAt)} (UTC). Your plan and renewal date stay the same.</p>
        <PriceReview price={renewal.price} renewal />
        <button className="uninstall-primary" disabled={busy} onClick={() => void transact("claim")}>{busy ? "Checking…" : "Apply to next renewal"} <span aria-hidden="true">→</span></button>
        <p className="uninstall-dialog-note">One renewal only. No charge now. No combined discounts. USD, before any applicable taxes.</p>
      </> : null}
      {error ? <p className="uninstall-error" role="alert">{error}</p> : null}
    </dialog>
  </div>;
}
function PriceReview({ price, renewal = false }: { price: UninstallPrice; renewal?: boolean }) {
  return <div className="uninstall-review"><div className="uninstall-review-total"><span>{renewal ? "Next monthly renewal" : "First month"}</span><strong>{money(price.discountedAmount)}</strong></div><div><span>Then, every month</span><strong>{money(price.ordinaryAmount)}</strong></div></div>;
}
