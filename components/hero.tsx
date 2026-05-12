"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DiscordContact } from "@/components/discord-contact";
import {
  Check,
  Chrome,
  CreditCard,
  Lock,
  MessageCircle,
  Play,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { trackEvent } from "@/lib/gtag";
import { trackConversion } from "@/lib/conversion-events";
import { pricingCtaLabelForTier } from "@/lib/home-survey";
import type { CheckoutTier, HomeSurveyAnswers } from "@/lib/home-survey";

export function Hero({
  survey,
  setSurvey,
  onSurveyAnswered,
  recommendedTier,
}: {
  survey: HomeSurveyAnswers;
  setSurvey: (next: HomeSurveyAnswers) => void;
  onSurveyAnswered: (payload: {
    question_id: string;
    answer_id: string;
  }) => void;
  recommendedTier: CheckoutTier;
}) {
  const [showSurvey, setShowSurvey] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const completedEventFired = useRef(false);

  const surveyReadyForRecommendation = useMemo(() => {
    return (
      Boolean(survey.segment) &&
      Boolean(survey.priority) &&
      Boolean(survey.group_size) &&
      Boolean(survey.timing) &&
      Boolean(survey.discovery)
    );
  }, [
    survey.discovery,
    survey.group_size,
    survey.priority,
    survey.segment,
    survey.timing,
  ]);

  const closeSurvey = (reason: "backdrop" | "close_button" | "not_now") => {
    trackEvent("survey_closed", {
      page_path: "/",
      page_template: "home",
      reason,
      step,
      recommended_tier: recommendedTier,
      segment: survey.segment,
      priority: survey.priority ?? "unset",
      discovery: survey.discovery ?? "unset",
      timing: survey.timing ?? "unset",
      group_size: survey.group_size ?? "unset",
    });
    setShowSurvey(false);
  };

  useEffect(() => {
    trackConversion("cta_impression", {
      page_path: "/",
      page_template: "home",
      placement: "hero",
      cta_variant: "hero_survey_recommended_plan",
    });
  }, []);

  useEffect(() => {
    if (!showSurvey) return;
    completedEventFired.current = false;
    trackEvent("survey_opened", {
      page_path: "/",
      page_template: "home",
      placement: "hero",
      recommended_tier: recommendedTier,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSurvey]);

  useEffect(() => {
    if (!showSurvey) return;
    trackEvent("survey_step_viewed", {
      page_path: "/",
      page_template: "home",
      step,
      recommended_tier: recommendedTier,
      segment: survey.segment,
      priority: survey.priority ?? "unset",
      group_size: survey.group_size ?? "unset",
      timing: survey.timing ?? "unset",
      discovery: survey.discovery ?? "unset",
    });
  }, [
    recommendedTier,
    showSurvey,
    step,
    survey.discovery,
    survey.group_size,
    survey.priority,
    survey.segment,
    survey.timing,
  ]);

  useEffect(() => {
    if (!showSurvey) return;
    if (step !== 6) return;
    if (!surveyReadyForRecommendation) return;
    if (completedEventFired.current) return;
    completedEventFired.current = true;
    trackEvent("survey_completed", {
      page_path: "/",
      page_template: "home",
      placement: "hero",
      recommended_tier: recommendedTier,
      segment: survey.segment,
      priority: survey.priority ?? "unset",
      discovery: survey.discovery ?? "unset",
      timing: survey.timing ?? "unset",
      group_size: survey.group_size ?? "unset",
    });
  }, [
    recommendedTier,
    showSurvey,
    step,
    survey.discovery,
    survey.group_size,
    survey.priority,
    survey.segment,
    survey.timing,
    surveyReadyForRecommendation,
  ]);

  const startCheckout = async (tier: CheckoutTier) => {
    setCheckoutError(null);
    const pagePath =
      typeof window !== "undefined" ? window.location.pathname : "/";

    trackConversion("checkout_session_started", {
      page_path: pagePath,
      page_template: "home",
      placement: "hero_survey_recommendation",
      plan_tier: tier,
      recommended_tier: recommendedTier,
      segment: survey.segment,
      priority: survey.priority ?? "unset",
      discovery: survey.discovery ?? "unset",
      timing: survey.timing ?? "unset",
      group_size: survey.group_size ?? "unset",
    });

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });

      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok) {
        const message =
          data.error ?? "Checkout could not start. Please try again.";
        trackConversion("checkout_error", {
          page_path: pagePath,
          page_template: "home",
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
          page_template: "home",
          placement: "hero_survey_recommendation",
          plan_tier: tier,
          error_step: "missing_checkout_url",
        });
        setCheckoutError(
          "We could not open Stripe. Refresh the page and try again.",
        );
        return;
      }

      trackConversion("checkout_redirect_success", {
        page_path: pagePath,
        page_template: "home",
        placement: "hero_survey_recommendation",
        plan_tier: tier,
      });

      window.location.href = data.url;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected checkout error";
      trackConversion("checkout_error", {
        page_path: pagePath,
        page_template: "home",
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

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-purple-600 via-purple-700 to-blue-800 text-white">
      <div className="absolute inset-0">
        <div className="absolute top-20 left-10 w-20 h-20 bg-purple-400/20 rounded-full blur-xl animate-pulse" />
        <div className="absolute top-40 right-20 w-32 h-32 bg-blue-400/20 rounded-full blur-xl animate-pulse delay-1000" />
        <div className="absolute bottom-20 left-1/3 w-24 h-24 bg-purple-300/20 rounded-full blur-xl animate-pulse delay-500" />
      </div>

      <div className="absolute inset-0 bg-black/20" />
      <div className="relative container mx-auto px-4 py-24 lg:py-32">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
            Your friends are watching without you. Fix that.
          </h1>
          <p className="text-xl md:text-2xl mb-4 text-purple-100 max-w-3xl mx-auto leading-relaxed">
            Sync with your crew across any timezone. Create a watchroom, share
            the link, react to every plot twist — even when you don&apos;t watch
            at the same time.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <Button
              size="lg"
              className="bg-white text-purple-700 hover:bg-purple-50 px-8 py-4 text-lg font-semibold shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
              onClick={() => {
                trackConversion("cta_click", {
                  page_path: "/",
                  page_template: "home",
                  placement: "hero",
                  cta_variant: "hero_survey_recommended_plan",
                  recommended_tier: recommendedTier,
                  segment: survey.segment,
                  priority: survey.priority ?? "unset",
                });
                setShowSurvey(true);
                setStep(1);
              }}
            >
              <Play className="h-5 w-5" aria-hidden="true" />
              Help me pick a plan
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="text-purple-100 hover:text-white hover:bg-white/10 px-8 py-4 text-lg font-semibold bg-transparent backdrop-blur-sm transition-all duration-300"
            >
              <a
                href="#how-it-works"
                onClick={() =>
                  trackEvent("extension_clicked", { cta: "hero_extension" })
                }
              >
                <Chrome className="h-5 w-5" aria-hidden="true" />
                See How It Works
              </a>
            </Button>
          </div>

          {showSurvey && (
            <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
              <button
                type="button"
                aria-label="Close survey"
                className="absolute inset-0 bg-black/60"
                onClick={() => closeSurvey("backdrop")}
              />

              <div className="relative w-full max-w-2xl rounded-2xl border border-white/15 bg-gradient-to-br from-white/95 to-white/90 text-gray-900 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3 border-b border-gray-200/70 px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Sparkles
                      className="h-5 w-5 text-purple-700"
                      aria-hidden="true"
                    />
                    <p className="text-sm font-semibold">
                      Find your plan ({Math.min(step, 6)}/6)
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-gray-700 hover:bg-gray-100"
                    onClick={() => closeSurvey("close_button")}
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                    Close
                  </Button>
                </div>

                <div className="px-6 py-5">
                  {checkoutError && (
                    <div
                      className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                      role="alert"
                    >
                      {checkoutError}
                    </div>
                  )}

                  {step === 1 && (
                    <div>
                      <p className="text-sm font-medium text-gray-900 mb-2">
                        Who are you watching with?
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {[
                          { id: "Friend_group_host", label: "My friend group" },
                          { id: "Long_distance_watch", label: "Long-distance" },
                          {
                            id: "Community_mod",
                            label: "A community / server",
                          },
                        ].map((o) => (
                          <Button
                            key={o.id}
                            type="button"
                            variant="outline"
                            className={`justify-start border-gray-200 bg-white text-gray-900 hover:bg-gray-50 ${
                              survey.segment === o.id
                                ? "border-purple-300 ring-4 ring-purple-100 shadow-sm"
                                : ""
                            }`}
                            onClick={() => {
                              setSurvey({
                                ...survey,
                                segment: o.id as HomeSurveyAnswers["segment"],
                              });
                              onSurveyAnswered({
                                question_id: "segment",
                                answer_id: o.id,
                              });
                              setStep(2);
                            }}
                          >
                            {o.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  {step === 2 && (
                    <div>
                      <p className="text-sm font-medium text-gray-900 mb-2">
                        What matters most?
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          {
                            id: "sync_and_no_spoilers",
                            label: "Stay in sync (no spoilers)",
                          },
                          {
                            id: "chat_and_reactions",
                            label: "Chat + reactions",
                          },
                          {
                            id: "async_progress",
                            label: "Async progress tracking",
                          },
                          { id: "host_controls", label: "Host controls" },
                        ].map((o) => (
                          <Button
                            key={o.id}
                            type="button"
                            variant="outline"
                            className={`justify-start border-gray-200 bg-white text-gray-900 hover:bg-gray-50 ${
                              survey.priority === o.id
                                ? "border-purple-300 ring-4 ring-purple-100 shadow-sm"
                                : ""
                            }`}
                            onClick={() => {
                              setSurvey({
                                ...survey,
                                priority: o.id as HomeSurveyAnswers["priority"],
                              });
                              onSurveyAnswered({
                                question_id: "priority",
                                answer_id: o.id,
                              });
                              setStep(3);
                            }}
                          >
                            {o.label}
                          </Button>
                        ))}
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setStep(1)}
                        >
                          Back
                        </Button>
                      </div>
                    </div>
                  )}

                  {step === 3 && (
                    <div>
                      <p className="text-sm font-medium text-gray-900 mb-2">
                        Typical watchroom size?
                      </p>
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
                              survey.group_size === o.id
                                ? "border-purple-300 ring-4 ring-purple-100 shadow-sm"
                                : ""
                            }`}
                            onClick={() => {
                              setSurvey({
                                ...survey,
                                group_size:
                                  o.id as HomeSurveyAnswers["group_size"],
                              });
                              onSurveyAnswered({
                                question_id: "group_size",
                                answer_id: o.id,
                              });
                              setStep(4);
                            }}
                          >
                            {o.label}
                          </Button>
                        ))}
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setStep(2)}
                        >
                          Back
                        </Button>
                      </div>
                    </div>
                  )}

                  {step === 4 && (
                    <div>
                      <p className="text-sm font-medium text-gray-900 mb-2">
                        When do you want to use it?
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {[
                          { id: "today", label: "Today" },
                          { id: "this_week", label: "This week" },
                          { id: "just_researching", label: "Just researching" },
                        ].map((o) => (
                          <Button
                            key={o.id}
                            type="button"
                            variant="outline"
                            className={`justify-start border-gray-200 bg-white text-gray-900 hover:bg-gray-50 ${
                              survey.timing === o.id
                                ? "border-purple-300 ring-4 ring-purple-100 shadow-sm"
                                : ""
                            }`}
                            onClick={() => {
                              setSurvey({
                                ...survey,
                                timing: o.id as HomeSurveyAnswers["timing"],
                              });
                              onSurveyAnswered({
                                question_id: "timing",
                                answer_id: o.id,
                              });
                              setStep(5);
                            }}
                          >
                            {o.label}
                          </Button>
                        ))}
                      </div>
                      {survey.timing === "today" && (
                        <p className="mt-2 text-xs text-gray-600">
                          You can be in a watchroom in about 2 minutes.
                        </p>
                      )}
                      {survey.timing === "this_week" && (
                        <p className="mt-2 text-xs text-gray-600">
                          Set it up once and reuse it for every episode.
                        </p>
                      )}
                      <div className="mt-4 flex items-center justify-between">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setStep(3)}
                        >
                          Back
                        </Button>
                      </div>
                    </div>
                  )}

                  {step === 5 && (
                    <div>
                      <p className="text-sm font-medium text-gray-900 mb-2">
                        How did you find AniDachi?
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          { id: "google_search", label: "Google search" },
                          { id: "reddit", label: "Reddit" },
                          { id: "discord", label: "Discord" },
                          { id: "friend", label: "Friend" },
                          { id: "other", label: "Other" },
                        ].map((o) => (
                          <Button
                            key={o.id}
                            type="button"
                            variant="outline"
                            className={`justify-start border-gray-200 bg-white text-gray-900 hover:bg-gray-50 ${
                              survey.discovery === o.id
                                ? "border-purple-300 ring-4 ring-purple-100 shadow-sm"
                                : ""
                            }`}
                            onClick={() => {
                              setSurvey({
                                ...survey,
                                discovery:
                                  o.id as HomeSurveyAnswers["discovery"],
                              });
                              onSurveyAnswered({
                                question_id: "discovery",
                                answer_id: o.id,
                              });
                              setStep(6);
                            }}
                          >
                            {o.label}
                          </Button>
                        ))}
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setStep(4)}
                        >
                          Back
                        </Button>
                      </div>
                    </div>
                  )}

                  {step === 6 && (
                    <div>
                      <div className="mb-4 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3">
                        <p className="text-sm font-semibold text-purple-900">
                          Recommended for you
                        </p>
                        <p className="text-sm text-purple-800">
                          {recommendedTier === "anime_junkie"
                            ? "Anime Junkie — best if you want host controls and moderated rooms."
                            : "Crunchyroll Subscriber — best for watchrooms, sync, and async progress on top of Crunchyroll."}
                        </p>
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold">
                              {recommendedTier === "anime_junkie"
                                ? "Anime Junkie"
                                : "Crunchyroll Subscriber"}
                            </p>
                            <p className="text-sm text-gray-600">
                              {recommendedTier === "anime_junkie"
                                ? "$38/month"
                                : "$8/month"}
                            </p>
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${
                              recommendedTier === "anime_junkie"
                                ? "bg-gray-100 text-gray-900"
                                : "bg-purple-100 text-purple-800"
                            }`}
                          >
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            Recommended
                          </span>
                        </div>

                        <ul className="mt-3 space-y-1 text-sm text-gray-700">
                          {recommendedTier === "anime_junkie" ? (
                            <>
                              <li className="flex items-start gap-2">
                                <Check
                                  className="h-4 w-4 text-green-600 mt-0.5"
                                  aria-hidden="true"
                                />
                                Everything in Subscriber
                              </li>
                              <li className="flex items-start gap-2">
                                <Check
                                  className="h-4 w-4 text-green-600 mt-0.5"
                                  aria-hidden="true"
                                />
                                Invite-only rooms + approvals
                              </li>
                              <li className="flex items-start gap-2">
                                <Check
                                  className="h-4 w-4 text-green-600 mt-0.5"
                                  aria-hidden="true"
                                />
                                Host & moderator controls
                              </li>
                            </>
                          ) : (
                            <>
                              <li className="flex items-start gap-2">
                                <Check
                                  className="h-4 w-4 text-green-600 mt-0.5"
                                  aria-hidden="true"
                                />
                                Unlimited watchrooms
                              </li>
                              <li className="flex items-start gap-2">
                                <Check
                                  className="h-4 w-4 text-green-600 mt-0.5"
                                  aria-hidden="true"
                                />
                                Sync + async progress
                              </li>
                              <li className="flex items-start gap-2">
                                <Check
                                  className="h-4 w-4 text-green-600 mt-0.5"
                                  aria-hidden="true"
                                />
                                Chat & reactions
                              </li>
                            </>
                          )}
                        </ul>

                        <Button
                          className={`mt-4 w-full text-white font-semibold disabled:opacity-60 ${
                            recommendedTier === "anime_junkie"
                              ? "bg-gray-900 hover:bg-gray-950"
                              : "bg-purple-700 hover:bg-purple-800"
                          }`}
                          disabled={
                            isSubmitting || !surveyReadyForRecommendation
                          }
                          onClick={() => startCheckout(recommendedTier)}
                        >
                          {isSubmitting
                            ? "Redirecting to Stripe…"
                            : pricingCtaLabelForTier({
                                tier: recommendedTier,
                                survey,
                              })}
                        </Button>
                        <p className="mt-2 text-[11px] text-gray-600">
                          Secure Stripe checkout · Cancel &amp; refund anytime
                          in early access · No account sharing
                        </p>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-gray-600">
                          <span className="inline-flex items-center gap-1">
                            <Lock className="h-3.5 w-3.5" aria-hidden="true" />{" "}
                            Stripe
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <CreditCard
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />{" "}
                            Card
                          </span>
                        </div>
                      </div>

                      {survey.timing === "just_researching" && (
                        <div className="mt-5">
                          <DiscordContact
                            username=".profun"
                            className="border border-gray-200"
                          />
                          <div className="mt-3 flex flex-col sm:flex-row gap-2">
                            <Button
                              asChild
                              variant="outline"
                              className="bg-transparent"
                            >
                              <a href="mailto:goshan.tolochko@gmail.com?subject=AniDachi%20plan%20recommendation">
                                Email me this plan
                              </a>
                            </Button>
                            <Button
                              asChild
                              className="bg-purple-700 hover:bg-purple-800 text-white"
                            >
                              <a href="/guides/how-to-watch-anime-with-friends-on-discord">
                                See the Discord setup guide
                              </a>
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setStep(5)}
                        >
                          Back
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-2xl mx-auto">
            <div className="flex flex-col items-center gap-2 p-4 bg-white/10 backdrop-blur-sm rounded-lg">
              <Users className="h-6 w-6 text-purple-200" aria-hidden="true" />
              <span className="text-sm font-medium">Crunchyroll Detection</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 bg-white/10 backdrop-blur-sm rounded-lg">
              <MessageCircle
                className="h-6 w-6 text-purple-200"
                aria-hidden="true"
              />
              <span className="text-sm font-medium">Real-time Chat</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4 bg-white/10 backdrop-blur-sm rounded-lg">
              <Play className="h-6 w-6 text-purple-200" aria-hidden="true" />
              <span className="text-sm font-medium">Perfect Sync</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
