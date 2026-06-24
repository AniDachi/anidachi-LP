"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PrePurchaseDiscordWalkthrough } from "@/components/pre-purchase-discord-walkthrough";
import { FOUNDER_DISCORD_USERNAME } from "@/lib/founder-discord";
import { AnidachiLogo } from "@/components/anidachi-logo";
import {
  Check,
  Lock,
  ShieldCheck,
  X,
} from "lucide-react";
import { trackEvent } from "@/lib/gtag";
import { inferPageTemplateFromPath, trackConversion } from "@/lib/conversion-events";
import {
  PRICING_CTA_LABEL,
  priorityFeatureBullet,
} from "@/lib/home-survey";
import type { CheckoutTier, HomeSurveyAnswers } from "@/lib/home-survey";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

export type PlanSurveyOpenContext = {
  placement: string;
  cta_variant: string;
};

// Steps 1-6 are required questions. Step 7 is the recommendation / checkout.
type SurveyStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const TOTAL_STEPS = 6; // denominator for the progress bar (max questions)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function PlanSurveyModal({
  isOpen,
  onRequestClose,
  survey,
  setSurvey,
  onSurveyAnswered,
  recommendedTier,
  openContext,
}: {
  isOpen: boolean;
  onRequestClose: (reason: "backdrop" | "close_button" | "not_now") => void;
  survey: HomeSurveyAnswers;
  setSurvey: (next: HomeSurveyAnswers) => void;
  onSurveyAnswered: (payload: { question_id: string; answer_id: string }) => void;
  recommendedTier: CheckoutTier;
  openContext: PlanSurveyOpenContext;
}) {
  const [step, setStep] = useState<SurveyStep>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const completedEventFired = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Email capture state (step 5)
  const [emailInput, setEmailInput] = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [waitlistPosition, setWaitlistPosition] = useState<number | null>(null);


  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onRequestClose("close_button");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onRequestClose]);

  // Progress bar: step / TOTAL_STEPS, capped at 100% on the recommendation step
  const progressPct = step === 7 ? 100 : Math.round((step / TOTAL_STEPS) * 100);

  // Recommendation requires every survey step, including email capture.
  const surveyReadyForRecommendation = useMemo(() => {
    return (
      Boolean(survey.segment) &&
      Boolean(survey.priority) &&
      Boolean(survey.group_size) &&
      Boolean(survey.timing) &&
      Boolean(survey.current_solution) &&
      emailSubmitted
    );
  }, [
    emailSubmitted,
    survey.current_solution,
    survey.group_size,
    survey.priority,
    survey.segment,
    survey.timing,
  ]);

  // Reset all local state when the modal opens
  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    setCheckoutError(null);
    setEmailInput("");
    setEmailSubmitted(false);
    setEmailSubmitting(false);
    setEmailError(null);
    setWaitlistPosition(null);
    completedEventFired.current = false;
    const pagePath = typeof window !== "undefined" ? window.location.pathname : "/";
    const pageTemplate = inferPageTemplateFromPath(pagePath);
    trackEvent("survey_opened", {
      page_path: pagePath,
      page_template: pageTemplate,
      placement: openContext.placement,
      cta_variant: openContext.cta_variant,
      recommended_tier: recommendedTier,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Step 7: recover position if email submit did not return one (e.g. blob write misconfig).
  useEffect(() => {
    if (!isOpen || step !== 7 || waitlistPosition !== null || !emailInput.trim()) {
      return;
    }
    void resolveWaitlistPosition(emailInput);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, step, waitlistPosition, emailInput]);

  // Track step views
  useEffect(() => {
    if (!isOpen) return;
    const pagePath = typeof window !== "undefined" ? window.location.pathname : "/";
    const pageTemplate = inferPageTemplateFromPath(pagePath);
    trackEvent("survey_step_viewed", {
      page_path: pagePath,
      page_template: pageTemplate,
      placement: openContext.placement,
      cta_variant: openContext.cta_variant,
      step,
      recommended_tier: recommendedTier,
      segment: survey.segment,
      priority: survey.priority ?? "unset",
      group_size: survey.group_size ?? "unset",
      timing: survey.timing ?? "unset",
      discovery: survey.discovery ?? "unset",
      current_solution: survey.current_solution ?? "unset",
    });
  }, [
    isOpen,
    openContext.cta_variant,
    openContext.placement,
    recommendedTier,
    step,
    survey.current_solution,
    survey.discovery,
    survey.group_size,
    survey.priority,
    survey.segment,
    survey.timing,
  ]);

  // Fire survey_completed when the recommendation step is reached
  useEffect(() => {
    if (!isOpen) return;
    if (step !== 7) return;
    if (!surveyReadyForRecommendation) return;
    if (completedEventFired.current) return;
    completedEventFired.current = true;
    const pagePath = typeof window !== "undefined" ? window.location.pathname : "/";
    const pageTemplate = inferPageTemplateFromPath(pagePath);
    trackEvent("survey_completed", {
      page_path: pagePath,
      page_template: pageTemplate,
      placement: openContext.placement,
      cta_variant: openContext.cta_variant,
      recommended_tier: recommendedTier,
      segment: survey.segment,
      priority: survey.priority ?? "unset",
      discovery: survey.discovery ?? "unset",
      timing: survey.timing ?? "unset",
      group_size: survey.group_size ?? "unset",
      current_solution: survey.current_solution ?? "unset",
    });
  }, [
    isOpen,
    openContext.cta_variant,
    openContext.placement,
    recommendedTier,
    step,
    survey.current_solution,
    survey.discovery,
    survey.group_size,
    survey.priority,
    survey.segment,
    survey.timing,
    surveyReadyForRecommendation,
  ]);


  const closeSurvey = (reason: "backdrop" | "close_button" | "not_now") => {
    const pagePath = typeof window !== "undefined" ? window.location.pathname : "/";
    const pageTemplate = inferPageTemplateFromPath(pagePath);
    trackEvent("survey_closed", {
      page_path: pagePath,
      page_template: pageTemplate,
      placement: openContext.placement,
      cta_variant: openContext.cta_variant,
      reason,
      step,
      recommended_tier: recommendedTier,
      segment: survey.segment,
      priority: survey.priority ?? "unset",
      discovery: survey.discovery ?? "unset",
      timing: survey.timing ?? "unset",
      group_size: survey.group_size ?? "unset",
      current_solution: survey.current_solution ?? "unset",
    });
    onRequestClose(reason);
  };

  const startCheckout = async (tier: CheckoutTier) => {
    setCheckoutError(null);
    const pagePath = typeof window !== "undefined" ? window.location.pathname : "/";
    const pageTemplate = inferPageTemplateFromPath(pagePath);

    trackConversion("checkout_session_started", {
      page_path: pagePath,
      page_template: pageTemplate,
      placement: "hero_survey_recommendation",
      plan_tier: tier,
      recommended_tier: recommendedTier,
      segment: survey.segment,
      priority: survey.priority ?? "unset",
      discovery: survey.discovery ?? "unset",
      timing: survey.timing ?? "unset",
      group_size: survey.group_size ?? "unset",
      current_solution: survey.current_solution ?? "unset",
    });

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planCode: tier }),
      });

      const data = (await response.json()) as {
        url?: string;
        error?: string;
        loginUrl?: string;
      };

      if (!response.ok) {
        if (response.status === 401 && data.loginUrl) {
          window.location.href = data.loginUrl;
          return;
        }
        const message = data.error ?? "Checkout could not start. Please try again.";
        trackConversion("checkout_error", {
          page_path: pagePath,
          page_template: pageTemplate,
          placement: "hero_survey_recommendation",
          plan_tier: tier,
          error_step: "api_response",
          status: response.status,
          message,
        });
        setCheckoutError(message);
        return;
      }

      if (!data.url) {
        trackConversion("checkout_error", {
          page_path: pagePath,
          page_template: pageTemplate,
          placement: "hero_survey_recommendation",
          plan_tier: tier,
          error_step: "missing_checkout_url",
        });
        setCheckoutError("We could not open Stripe. Refresh the page and try again.");
        return;
      }

      trackConversion("checkout_redirect_success", {
        page_path: pagePath,
        page_template: pageTemplate,
        placement: "hero_survey_recommendation",
        plan_tier: tier,
      });

      window.location.href = data.url;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected checkout error";
      trackConversion("checkout_error", {
        page_path: pagePath,
        page_template: pageTemplate,
        placement: "hero_survey_recommendation",
        plan_tier: tier,
        error_step: "client_exception",
        message,
      });
      setCheckoutError(
        "Network error while starting checkout. Check your connection and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resolveWaitlistPosition = async (email: string) => {
    const trimmed = email.trim();
    if (!trimmed) return;
    try {
      const res = await fetch(
        `/api/waitlist-position?email=${encodeURIComponent(trimmed)}`,
      );
      if (!res.ok) return;
      const data = (await res.json()) as { waitlistPosition?: number | null };
      if (typeof data.waitlistPosition === "number" && data.waitlistPosition > 0) {
        setWaitlistPosition(data.waitlistPosition);
      }
    } catch {
      // Keep fallback copy if position lookup fails.
    }
  };

  const submitEmail = async () => {
    const trimmed = emailInput.trim();
    if (!trimmed) {
      setEmailError("Email is required to continue.");
      return;
    }
    if (!EMAIL_RE.test(trimmed)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setEmailError(null);
    setEmailSubmitting(true);
    try {
      const res = await fetch("/api/subscribe-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, survey }),
      });
      const data = (await res.json()) as { ok?: boolean; waitlistPosition?: number | null };
      if (typeof data.waitlistPosition === "number" && data.waitlistPosition > 0) {
        setWaitlistPosition(data.waitlistPosition);
      } else if (res.ok) {
        void resolveWaitlistPosition(trimmed);
      }
      setEmailSubmitted(true);
      setTimeout(() => setStep(6), 1200);
    } catch {
      setEmailError("Could not save — please try again.");
    } finally {
      setEmailSubmitting(false);
    }
  };

  if (!isOpen) return null;


  return (
    <>
      <button
        type="button"
        aria-label="Close survey"
        className="fixed inset-0 z-[75] bg-black/60"
        onClick={() => closeSurvey("backdrop")}
      />

      <div
        ref={dialogRef}
        className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden p-4 pt-20 pb-[max(1rem,env(safe-area-inset-bottom))] overscroll-none pointer-events-none sm:pt-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-survey-title"
      >
      <div className="pointer-events-auto relative flex max-h-[min(90dvh,calc(100vh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-brand-border bg-background text-foreground shadow-2xl backdrop-blur-xl glow-orange-sm">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-brand-border px-6 py-4">
          <div className="flex items-center gap-2">
            <AnidachiLogo size={24} aria-hidden />
            <p id="plan-survey-title" className="text-sm font-semibold text-foreground">
              {step === 7 ? "You're on the list" : `Get early access (${step}/6)`}
            </p>
          </div>
          <Button
            ref={closeButtonRef}
            type="button"
            variant="ghost"
            className="min-h-11 min-w-11 text-foreground/70 hover:bg-brand-orange hover:text-primary-foreground"
            aria-label="Close survey"
            onClick={() => closeSurvey("close_button")}
          >
            <X className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full shrink-0 overflow-hidden rounded-none bg-brand-surface">
          <div
            className="h-full bg-brand-orange transition-all duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5"
          data-scroll-lock-scrollable
        >
          {checkoutError && (
            <div
              className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
              role="alert"
            >
              {checkoutError}
            </div>
          )}

          {/* Step 1 — Who are you watching with? */}
          {step === 1 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Who are you watching with?</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: "Friend_group_host", label: "My friend group" },
                  { id: "Long_distance_watch", label: "Long-distance" },
                  { id: "Community_mod", label: "A community / server" },
                ].map((o) => (
                  <Button
                    key={o.id}
                    type="button"
                    variant="outline"
                    className={`justify-start border-brand-border bg-background text-foreground hover:bg-brand-orange hover:text-primary-foreground hover:border-brand-orange ${
                      survey.segment === o.id ? "border-brand-orange bg-brand-orange/10" : ""
                    }`}
                    onClick={() => {
                      setSurvey({ ...survey, segment: o.id as HomeSurveyAnswers["segment"] });
                      onSurveyAnswered({ question_id: "segment", answer_id: o.id });
                      setStep(2);
                    }}
                  >
                    {o.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 — What matters most? */}
          {step === 2 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-2">What matters most?</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { id: "sync_and_no_spoilers", label: "Stay in sync (no spoilers)" },
                  { id: "chat_and_reactions", label: "Chat + reactions" },
                  { id: "async_progress", label: "Async progress tracking" },
                  { id: "host_controls", label: "Host controls" },
                ].map((o) => (
                  <Button
                    key={o.id}
                    type="button"
                    variant="outline"
                    className={`justify-start border-brand-border bg-background text-foreground hover:bg-brand-orange hover:text-primary-foreground hover:border-brand-orange ${
                      survey.priority === o.id ? "border-brand-orange bg-brand-orange/10" : ""
                    }`}
                    onClick={() => {
                      setSurvey({ ...survey, priority: o.id as HomeSurveyAnswers["priority"] });
                      onSurveyAnswered({ question_id: "priority", answer_id: o.id });
                      setStep(3);
                    }}
                  >
                    {o.label}
                  </Button>
                ))}
              </div>
              <div className="mt-4">
                <Button type="button" variant="ghost" onClick={() => setStep(1)}>Back</Button>
              </div>
            </div>
          )}

          {/* Step 3 — Typical watchroom size? */}
          {step === 3 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Typical watchroom size?</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: "2_3", label: "2–3 people" },
                  { id: "4_8", label: "4–8 people" },
                  { id: "9_plus", label: "9+ people" },
                ].map((o) => (
                  <Button
                    key={o.id}
                    type="button"
                    variant="outline"
                    className={`justify-start border-brand-border bg-background text-foreground hover:bg-brand-orange hover:text-primary-foreground hover:border-brand-orange ${
                      survey.group_size === o.id ? "border-brand-orange bg-brand-orange/10" : ""
                    }`}
                    onClick={() => {
                      setSurvey({ ...survey, group_size: o.id as HomeSurveyAnswers["group_size"] });
                      onSurveyAnswered({ question_id: "group_size", answer_id: o.id });
                      setStep(4);
                    }}
                  >
                    {o.label}
                  </Button>
                ))}
              </div>
              <div className="mt-4">
                <Button type="button" variant="ghost" onClick={() => setStep(2)}>Back</Button>
              </div>
            </div>
          )}

          {/* Step 4 — When do you want to use it? */}
          {step === 4 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-2">When do you want to use it?</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { id: "today", label: "Today" },
                  { id: "this_week", label: "This week" },
                  { id: "planning_ahead", label: "Planning ahead" },
                ].map((o) => (
                  <Button
                    key={o.id}
                    type="button"
                    variant="outline"
                    className={`justify-start border-brand-border bg-background text-foreground hover:bg-brand-orange hover:text-primary-foreground hover:border-brand-orange ${
                      survey.timing === o.id ? "border-brand-orange bg-brand-orange/10" : ""
                    }`}
                    onClick={() => {
                      const timing = o.id as HomeSurveyAnswers["timing"];
                      setSurvey({ ...survey, timing });
                      onSurveyAnswered({ question_id: "timing", answer_id: o.id });
                      setStep(5);
                    }}
                  >
                    {o.label}
                  </Button>
                ))}
              </div>
              {survey.timing === "today" && (
                <p className="mt-2 text-xs text-foreground/60">You can be in a watchroom in about 2 minutes.</p>
              )}
              {survey.timing === "this_week" && (
                <p className="mt-2 text-xs text-foreground/60">Set it up once and reuse it for every episode.</p>
              )}
              <div className="mt-4">
                <Button type="button" variant="ghost" onClick={() => setStep(3)}>Back</Button>
              </div>
            </div>
          )}

          {/* Step 5 — Email capture / claim waitlist spot */}
          {step === 5 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-1">
                Claim your early access spot
              </p>
              <p className="text-xs text-foreground/50 mb-4">
                You&apos;ll be among the first to get access when we launch. We&apos;ll notify you the moment doors open.
              </p>
              {emailSubmitted ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 rounded-lg border border-brand-orange/30 bg-brand-orange/10 px-4 py-3 text-sm text-foreground">
                    <Check className="h-4 w-4 shrink-0 text-brand-orange" aria-hidden="true" />
                    You&apos;re on the list! We&apos;ll reach out the moment we launch.
                  </div>
                  <Button
                    type="button"
                    className="bg-brand-orange hover:bg-brand-orange-deep text-primary-foreground font-semibold"
                    onClick={() => setStep(6)}
                  >
                    Continue
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") submitEmail(); }}
                    placeholder="Your email address"
                    autoComplete="email"
                    inputMode="email"
                    required
                    aria-required="true"
                    className="w-full rounded-lg border border-brand-border bg-brand-surface px-3 py-2 text-base text-foreground placeholder:text-foreground/40 focus:border-brand-orange focus:outline-none focus:ring-2 focus:ring-brand-orange/20"
                  />
                  {emailError && (
                    <p className="text-xs text-destructive">{emailError}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      className="bg-brand-orange hover:bg-brand-orange-deep text-primary-foreground font-semibold"
                      disabled={emailSubmitting || !emailInput.trim()}
                      onClick={submitEmail}
                    >
                      {emailSubmitting ? "Saving…" : "Claim my spot"}
                    </Button>
                  </div>
                </div>
              )}
              <div className="mt-4">
                <Button type="button" variant="ghost" onClick={() => setStep(4)}>Back</Button>
              </div>
            </div>
          )}

          {/* Step 6 — What are you using today? */}
          {step === 6 && (
            <div>
              <p className="text-sm font-medium text-foreground mb-1">What are you using today?</p>
              <p className="text-xs text-foreground/50 mb-3">Helps us tailor the recommendation to what you already know.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { id: "discord_screen_share", label: "Discord screen share" },
                  { id: "teleparty_watch2gether", label: "Teleparty / Watch2Gether" },
                  { id: "nothing_yet", label: "Nothing yet" },
                  { id: "another_tool", label: "Another watch-party tool" },
                  { id: "other", label: "Other" },
                ].map((o) => (
                  <Button
                    key={o.id}
                    type="button"
                    variant="outline"
                    className={`justify-start border-brand-border bg-background text-foreground hover:bg-brand-orange hover:text-primary-foreground hover:border-brand-orange ${
                      survey.current_solution === o.id ? "border-brand-orange bg-brand-orange/10" : ""
                    }`}
                    onClick={() => {
                      setSurvey({
                        ...survey,
                        current_solution: o.id as HomeSurveyAnswers["current_solution"],
                      });
                      onSurveyAnswered({ question_id: "current_solution", answer_id: o.id });
                      setStep(7);
                    }}
                  >
                    {o.label}
                  </Button>
                ))}
              </div>
              <div className="mt-4">
                <Button type="button" variant="ghost" onClick={() => setStep(5)}>Back</Button>
              </div>
            </div>
          )}

          {/* Step 7 — Waitlist confirmed + optional pre-launch pricing */}
          {step === 7 && (
            <div>
              {/* Victory banner */}
              <div className="mb-4 overflow-hidden rounded-xl border border-brand-orange/35 bg-brand-orange/10 px-4 py-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-orange/20">
                    <Check className="h-5 w-5 text-brand-orange" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">You&apos;re on the list!</p>
                    {waitlistPosition !== null ? (
                      <p className="mt-0.5 text-sm text-foreground/70">
                        You&apos;re{" "}
                        <span className="font-bold text-brand-orange">#{waitlistPosition}</span> in
                        line. We&apos;ll notify you the moment we launch.
                      </p>
                    ) : (
                      <p className="mt-0.5 text-sm text-foreground/70">
                        We&apos;ll notify you the moment we launch. You&apos;ll be among the very first in.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* What to expect */}
              <div className="mb-5 rounded-xl border border-brand-border bg-brand-surface px-4 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-orange/80">
                  What happens next
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2 text-sm text-foreground/70">
                    <Check className="h-4 w-4 text-brand-orange mt-0.5 shrink-0" aria-hidden="true" />
                    First access when we go live — no waiting in line
                  </li>
                  <li className="flex items-start gap-2 text-sm text-foreground/70">
                    <Check className="h-4 w-4 text-brand-orange mt-0.5 shrink-0" aria-hidden="true" />
                    Pre-launch pricing locked in forever if you subscribe today
                  </li>
                  <li className="flex items-start gap-2 text-sm text-foreground/70">
                    <Check className="h-4 w-4 text-brand-orange mt-0.5 shrink-0" aria-hidden="true" />
                    Your personalized{" "}
                    <span className="font-medium">
                      {recommendedTier === "pro" ? "Pro" : "Plus"}
                    </span>{" "}
                    plan is ready for you
                  </li>
                </ul>
              </div>

              {/* Optional pre-launch pricing lock */}
              <div className="overflow-hidden rounded-xl p-[2px] animated-gradient-border">
                <div className="rounded-[10px] bg-brand-surface p-4">
                <p className="mb-0.5 text-sm font-semibold text-foreground">
                  Want to lock in pre-launch pricing?
                </p>
                <p className="mb-4 text-xs text-foreground/60">
                  This price is only available before we launch. Lock it in today and keep it
                  forever — even after we go public. Your waitlist spot is confirmed either way.
                </p>

                <div className="mb-3 flex items-start justify-between gap-3 border-b border-brand-border pb-3">
                  <div>
                    <p className="font-semibold text-foreground">
                      {recommendedTier === "pro" ? "Pro" : "Plus"}
                    </p>
                    <p className="text-xs font-medium text-brand-orange-bright">
                      {recommendedTier === "pro"
                        ? "Club hosts and bigger groups who need private rooms and moderator controls"
                        : "Regular watch nights with friends, sync, chat, and shared progress"}
                    </p>
                    <p className="mt-1 text-sm text-foreground/60">
                      {recommendedTier === "pro" ? "$14.99/month" : "$7.99/month"}
                    </p>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-orange/15 px-2.5 py-1 text-xs font-semibold text-brand-orange">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    Recommended
                  </span>
                </div>

                {/* Priority-personalised bullet list */}
                <ul className="mb-4 space-y-2 text-sm text-foreground/70">
                  <li className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" aria-hidden="true" />
                    <span className="font-medium text-foreground/90">{priorityFeatureBullet(survey.priority)}</span>
                  </li>
                  {recommendedTier === "pro" ? (
                    <>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" aria-hidden="true" />
                        Invite-only rooms with approval flow
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" aria-hidden="true" />
                        Everything in Plus, plus moderation tools
                      </li>
                    </>
                  ) : (
                    <>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" aria-hidden="true" />
                        Unlimited watchrooms — create once, reuse every episode
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-orange" aria-hidden="true" />
                        Works with Crunchyroll — no extra subscription needed
                      </li>
                    </>
                  )}
                </ul>

                {/* Trust signal */}
                <div className="mb-3 flex items-center gap-2 rounded-lg border border-brand-orange/25 bg-brand-orange/10 px-3 py-2 text-xs text-foreground/70">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-brand-orange" aria-hidden="true" />
                  Full refund before launch — no questions asked.
                </div>

                <Button
                  className="w-full bg-brand-orange font-semibold text-primary-foreground glow-orange hover:bg-brand-orange-deep hover:glow-orange-lg disabled:opacity-60"
                  disabled={isSubmitting || !surveyReadyForRecommendation}
                  onClick={() => startCheckout(recommendedTier)}
                >
                  {isSubmitting ? "Redirecting to Stripe…" : PRICING_CTA_LABEL}
                </Button>

                <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-foreground/50">
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  Secured by Stripe
                </div>
                </div>
              </div>

              <PrePurchaseDiscordWalkthrough
                className="mt-5"
                username={FOUNDER_DISCORD_USERNAME}
              />

              <div className="mt-4 flex flex-col items-center gap-3">
                <button
                  type="button"
                  className="text-xs text-foreground/50 underline underline-offset-2 transition-colors hover:text-brand-orange"
                  onClick={() => closeSurvey("not_now")}
                >
                  No thanks, I&apos;ll wait for launch
                </button>
                <Button type="button" variant="ghost" onClick={() => setStep(6)}>
                  Back
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  );
}
