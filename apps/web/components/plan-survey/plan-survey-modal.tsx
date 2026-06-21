"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PrePurchaseDiscordWalkthrough } from "@/components/pre-purchase-discord-walkthrough";
import { FOUNDER_DISCORD_USERNAME } from "@/lib/founder-discord";
import { AnidachiLogo } from "@/components/anidachi-logo";
import {
  Check,
  CreditCard,
  Lock,
  ShieldCheck,
  X,
} from "lucide-react";
import { trackEvent } from "@/lib/gtag";
import { inferPageTemplateFromPath, trackConversion } from "@/lib/conversion-events";
import {
  currentSolutionUpgradeText,
  priorityFeatureBullet,
  pricingCtaLabelForTier,
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

  // Objection handler state (step 7)
  const [objectionVisible, setObjectionVisible] = useState(false);
  const [selectedObjection, setSelectedObjection] = useState<string | null>(null);
  const objectionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setObjectionVisible(false);
    setSelectedObjection(null);
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

  // Show the objection handler after 3 seconds of inactivity on the recommendation step
  useEffect(() => {
    if (step !== 7) {
      setObjectionVisible(false);
      setSelectedObjection(null);
      if (objectionTimerRef.current) clearTimeout(objectionTimerRef.current);
      return;
    }
    objectionTimerRef.current = setTimeout(() => setObjectionVisible(true), 10000);
    return () => {
      if (objectionTimerRef.current) clearTimeout(objectionTimerRef.current);
    };
  }, [step]);

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
      await fetch("/api/subscribe-interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, survey }),
      });
      setEmailSubmitted(true);
      setTimeout(() => setStep(6), 1200);
    } catch {
      setEmailError("Could not save — please try again.");
    } finally {
      setEmailSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const upgradeText = currentSolutionUpgradeText(survey.current_solution);

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
      <div className="pointer-events-auto relative flex max-h-[min(90dvh,calc(100vh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-br from-white/95 to-white/90 text-gray-900 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200/70 px-6 py-4">
          <div className="flex items-center gap-2">
            <AnidachiLogo size={24} aria-hidden />
            <p id="plan-survey-title" className="text-sm font-semibold">
              {step === 7 ? "Your plan is ready" : `Find your plan (${step}/6)`}
            </p>
          </div>
          <Button
            ref={closeButtonRef}
            type="button"
            variant="ghost"
            className="min-h-11 min-w-11 text-gray-700 hover:bg-gray-100"
            aria-label="Close survey"
            onClick={() => closeSurvey("close_button")}
          >
            <X className="h-5 w-5" aria-hidden="true" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full shrink-0 overflow-hidden rounded-none bg-gray-100">
          <div
            className="h-full bg-purple-600 transition-all duration-300 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5"
          data-scroll-lock-scrollable
        >
          {checkoutError && (
            <div
              className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              {checkoutError}
            </div>
          )}

          {/* Step 1 — Who are you watching with? */}
          {step === 1 && (
            <div>
              <p className="text-sm font-medium text-gray-900 mb-2">Who are you watching with?</p>
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
                    className={`justify-start border-gray-200 bg-white text-gray-900 hover:bg-gray-50 ${
                      survey.segment === o.id ? "border-purple-400 bg-purple-50" : ""
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
              <p className="text-sm font-medium text-gray-900 mb-2">What matters most?</p>
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
                    className={`justify-start border-gray-200 bg-white text-gray-900 hover:bg-gray-50 ${
                      survey.priority === o.id ? "border-purple-400 bg-purple-50" : ""
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
              <p className="text-sm font-medium text-gray-900 mb-2">Typical watchroom size?</p>
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
                    className={`justify-start border-gray-200 bg-white text-gray-900 hover:bg-gray-50 ${
                      survey.group_size === o.id ? "border-purple-400 bg-purple-50" : ""
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
              <p className="text-sm font-medium text-gray-900 mb-2">When do you want to use it?</p>
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
                    className={`justify-start border-gray-200 bg-white text-gray-900 hover:bg-gray-50 ${
                      survey.timing === o.id ? "border-purple-400 bg-purple-50" : ""
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
                <p className="mt-2 text-xs text-gray-600">You can be in a watchroom in about 2 minutes.</p>
              )}
              {survey.timing === "this_week" && (
                <p className="mt-2 text-xs text-gray-600">Set it up once and reuse it for every episode.</p>
              )}
              <div className="mt-4">
                <Button type="button" variant="ghost" onClick={() => setStep(3)}>Back</Button>
              </div>
            </div>
          )}

          {/* Step 5 — Email capture */}
          {step === 5 && (
            <div>
              <p className="text-sm font-medium text-gray-900 mb-1">
                Save your plan recommendation
              </p>
              <p className="text-xs text-gray-500 mb-4">
                We&apos;ll send it to your inbox so you can come back to it when you&apos;re ready.
              </p>
              {emailSubmitted ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                    <Check className="h-4 w-4 text-green-600 shrink-0" aria-hidden="true" />
                    Got it — we&apos;ll send your plan recommendation shortly.
                  </div>
                  <Button
                    type="button"
                    className="bg-purple-700 hover:bg-purple-800 text-white font-semibold"
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
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-base text-gray-900 placeholder:text-gray-400 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
                  />
                  {emailError && (
                    <p className="text-xs text-red-600">{emailError}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      className="bg-purple-700 hover:bg-purple-800 text-white font-semibold"
                      disabled={emailSubmitting || !emailInput.trim()}
                      onClick={submitEmail}
                    >
                      {emailSubmitting ? "Saving…" : "Send my recommendation"}
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
              <p className="text-sm font-medium text-gray-900 mb-1">What are you using today?</p>
              <p className="text-xs text-gray-500 mb-3">Helps us tailor the recommendation to what you already know.</p>
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
                    className={`justify-start border-gray-200 bg-white text-gray-900 hover:bg-gray-50 ${
                      survey.current_solution === o.id ? "border-purple-400 bg-purple-50" : ""
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

          {/* Step 7 — Recommendation + checkout */}
          {step === 7 && (
            <div>
              {/* Recommendation header */}
              <div className="mb-4 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3">
                <p className="text-sm font-semibold text-purple-900">Recommended for you</p>
                {upgradeText ? (
                  <p className="text-sm text-purple-800">{upgradeText}</p>
                ) : (
                  <p className="text-sm text-purple-800">
                    {recommendedTier === "pro"
                      ? "Pro — best if you want larger rooms, host controls, and longer history."
                      : "Plus — best for regular watchrooms, sync, and shared progress with friends."}
                  </p>
                )}
                <p className="mt-1 text-xs text-purple-700 font-medium">
                  Early access pricing — locks in your rate before public launch.
                </p>
              </div>

              {/* Plan card */}
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {recommendedTier === "pro" ? "Pro" : "Plus"}
                    </p>
                    <p className="text-sm text-gray-600">
                      {recommendedTier === "pro" ? "$14.99/month" : "$7.99/month"}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                      recommendedTier === "pro" ? "bg-gray-100 text-gray-900" : "bg-purple-100 text-purple-800"
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    Recommended
                  </span>
                </div>

                {/* Priority-personalised bullet list */}
                <ul className="mt-3 space-y-1 text-sm text-gray-700">
                  {/* First bullet mirrors back what the user said they care about */}
                  <li className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-purple-600 mt-0.5 shrink-0" aria-hidden="true" />
                    <span className="font-medium">{priorityFeatureBullet(survey.priority)}</span>
                  </li>
                  {recommendedTier === "pro" ? (
                    <>
                      <li className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" aria-hidden="true" />
                        Invite-only rooms with approval flow
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" aria-hidden="true" />
                        Everything in Plus, plus moderation tools
                      </li>
                    </>
                  ) : (
                    <>
                      <li className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" aria-hidden="true" />
                        Unlimited watchrooms — create once, reuse every episode
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" aria-hidden="true" />
                        Works with Crunchyroll — no extra subscription needed
                      </li>
                    </>
                  )}
                </ul>

                {/* Trust signal above the CTA */}
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs text-green-800">
                  <ShieldCheck className="h-4 w-4 text-green-600 shrink-0" aria-hidden="true" />
                  30-day refund during early access — no questions asked.
                </div>

                <Button
                  className={`mt-3 w-full text-white font-semibold disabled:opacity-60 ${
                    recommendedTier === "pro" ? "bg-gray-900 hover:bg-gray-950" : "bg-purple-700 hover:bg-purple-800"
                  }`}
                  disabled={isSubmitting || !surveyReadyForRecommendation}
                  onClick={() => startCheckout(recommendedTier)}
                >
                  {isSubmitting
                    ? "Redirecting to Stripe…"
                    : pricingCtaLabelForTier({ tier: recommendedTier, survey })}
                </Button>

                <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" /> Secure Stripe checkout
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CreditCard className="h-3.5 w-3.5" aria-hidden="true" /> Card
                  </span>
                </div>
              </div>

              <PrePurchaseDiscordWalkthrough
                className="mt-5"
                username={FOUNDER_DISCORD_USERNAME}
              />

              {/* Objection handler — appears after 10 seconds on this step */}
              {objectionVisible && !selectedObjection && (
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-600"
                    onClick={() => setObjectionVisible(true)}
                  >
                    What&apos;s holding you back?
                  </button>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { id: "try_first", label: "I want to try before paying" },
                      { id: "friends_join", label: "Not sure my friends will join" },
                      { id: "price", label: "Price feels high for early access" },
                      { id: "streaming", label: "Not sure it works with my streaming app" },
                    ].map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        className="rounded-lg border border-gray-200 bg-white px-3 py-3 text-left text-sm text-gray-700 hover:border-purple-200 hover:bg-purple-50 transition-colors min-h-11"
                        onClick={() => setSelectedObjection(o.id)}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Objection response */}
              {selectedObjection && (
                <div className="mt-4 rounded-xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm">
                  {selectedObjection === "try_first" && (
                    <div>
                      <p className="font-semibold text-purple-900 mb-1">We&apos;re happy to walk you through it first.</p>
                      <p className="text-purple-800 text-xs">
                        Use the Discord section above to message the founder — we&apos;ll set up a
                        live demo for your group with no commitment.
                      </p>
                    </div>
                  )}
                  {selectedObjection === "friends_join" && (
                    <div>
                      <p className="font-semibold text-purple-900 mb-1">One link, your whole group gets in.</p>
                      <p className="text-purple-800 text-xs">Your subscription covers your watchroom — you just share the room link. Your friends don&apos;t need an account or a subscription to join a session you host.</p>
                    </div>
                  )}
                  {selectedObjection === "price" && (
                    <div>
                      <p className="font-semibold text-purple-900 mb-1">Early access pricing locks in your rate forever.</p>
                      <p className="text-purple-800 text-xs">When AniDachi launches publicly, this price goes up. Early access members keep this rate as long as they stay subscribed. And if it&apos;s not right for you — full refund, no questions.</p>
                    </div>
                  )}
                  {selectedObjection === "streaming" && (
                    <div>
                      <p className="font-semibold text-purple-900 mb-1">Works with the services you already use.</p>
                      <p className="text-purple-800 text-xs">AniDachi supports Crunchyroll and HiDive today, with more services being added during early access. Not sure if your service is covered? Message us and we&apos;ll confirm.</p>
                    </div>
                  )}
                  <button
                    type="button"
                    className="mt-2 text-[11px] text-purple-600 underline underline-offset-2"
                    onClick={() => setSelectedObjection(null)}
                  >
                    ← Back to other questions
                  </button>
                </div>
              )}

              <div className="mt-4">
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
