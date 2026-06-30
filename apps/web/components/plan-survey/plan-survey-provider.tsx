"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  defaultHomeSurveyAnswers,
  recommendedTierForSurvey,
  type HomeSurveyAnswers,
  type CheckoutTier,
} from "@/lib/home-survey";
import { trackEvent } from "@/lib/gtag";
import { PlanSurveyModal, type PlanSurveyOpenContext } from "./plan-survey-modal";

const LS_KEY = "anidachi_home_survey_v2";

function isValidSegment(
  segment: unknown,
): segment is HomeSurveyAnswers["segment"] {
  return (
    segment === "Friend_group_host" ||
    segment === "Long_distance_watch" ||
    segment === "Community_mod"
  );
}

/** Ignore legacy localStorage entries that only stored the old default segment. */
function isStaleDefaultSurvey(survey: HomeSurveyAnswers): boolean {
  return (
    survey.segment === "Friend_group_host" &&
    !survey.priority &&
    !survey.discovery &&
    !survey.timing &&
    !survey.group_size &&
    !survey.current_solution
  );
}

function safeParseSurvey(raw: string | null): HomeSurveyAnswers | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== "object") return null;
    const anyV = v as Partial<HomeSurveyAnswers>;
    const parsed: HomeSurveyAnswers = {
      segment: isValidSegment(anyV.segment) ? anyV.segment : undefined,
      priority: anyV.priority,
      discovery: anyV.discovery,
      timing: anyV.timing,
      group_size: anyV.group_size,
      current_solution: anyV.current_solution,
    };
    if (!parsed.segment && !parsed.priority && !parsed.timing && !parsed.group_size && !parsed.current_solution) {
      return null;
    }
    if (isStaleDefaultSurvey(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

type OpenSurveyArgs = {
  placement: string;
  ctaVariant: string;
};

type PlanSurveyContextValue = {
  survey: HomeSurveyAnswers;
  setSurvey: (next: HomeSurveyAnswers) => void;
  recommendedTier: CheckoutTier;
  isOpen: boolean;
  openSurvey: (args: OpenSurveyArgs) => void;
  closeSurvey: (reason: "backdrop" | "close_button" | "not_now") => void;
  onSurveyAnswered: (payload: { question_id: string; answer_id: string }) => void;
};

const PlanSurveyContext = createContext<PlanSurveyContextValue | null>(null);

export function PlanSurveyProvider({ children }: { children: React.ReactNode }) {
  const [survey, setSurvey] = useState<HomeSurveyAnswers>(() =>
    defaultHomeSurveyAnswers(),
  );
  const [isOpen, setIsOpen] = useState(false);
  const [openContext, setOpenContext] = useState<PlanSurveyOpenContext>({
    placement: "unknown",
    cta_variant: "unknown",
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fromLs = safeParseSurvey(window.localStorage.getItem(LS_KEY));
    if (fromLs) setSurvey(fromLs);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LS_KEY, JSON.stringify(survey));
  }, [survey]);

  const recommendedTier = useMemo(() => recommendedTierForSurvey(survey), [survey]);

  const onSurveyAnswered = useCallback(
    (payload: { question_id: string; answer_id: string }) => {
      const pagePath =
        typeof window !== "undefined" ? window.location.pathname : "/";
      trackEvent("survey_answered", {
        page_path: pagePath,
        page_template: "unknown",
        ...payload,
      });
    },
    [],
  );

  const openSurvey = useCallback((args: OpenSurveyArgs) => {
    setSurvey(defaultHomeSurveyAnswers());
    setOpenContext({ placement: args.placement, cta_variant: args.ctaVariant });
    setIsOpen(true);
  }, []);

  const closeSurvey = useCallback(() => {
    setIsOpen(false);
  }, []);

  const value = useMemo<PlanSurveyContextValue>(
    () => ({
      survey,
      setSurvey,
      recommendedTier,
      isOpen,
      openSurvey,
      closeSurvey,
      onSurveyAnswered,
    }),
    [closeSurvey, isOpen, onSurveyAnswered, openSurvey, recommendedTier, survey],
  );

  return (
    <PlanSurveyContext.Provider value={value}>
      {children}
      <PlanSurveyModal
        isOpen={isOpen}
        onRequestClose={closeSurvey}
        survey={survey}
        setSurvey={setSurvey}
        onSurveyAnswered={onSurveyAnswered}
        recommendedTier={recommendedTier}
        openContext={openContext}
      />
    </PlanSurveyContext.Provider>
  );
}

export function usePlanSurvey() {
  const ctx = useContext(PlanSurveyContext);
  if (!ctx) {
    throw new Error("usePlanSurvey must be used within PlanSurveyProvider");
  }
  return ctx;
}

