import { Minus, Plus } from "lucide-react";
import { homeFAQ } from "@/lib/home-faq";
import { deHomeFAQ } from "@/lib/locale/de-home-faq";
import type { PageLocale } from "@/lib/locale/ui-strings";
import { FaqQuestionList } from "@/components/faq-section";
import styles from "./home-faq.module.css";

const COPY = {
  en: { title: "Questions?", accent: "Answers.", more: "More questions", fewer: "Fewer questions" },
  de: { title: "Fragen?", accent: "Antworten.", more: "Mehr Fragen", fewer: "Weniger Fragen" },
} as const;

export function HomeFAQ({ locale = "en" }: { locale?: PageLocale } = {}) {
  const copy = COPY[locale];
  // The shared copy puts the core product questions first, for UI and JSON-LD.
  const questions = locale === "de" ? deHomeFAQ : homeFAQ;
  const primaryQuestions = questions.slice(0, 6);
  const otherQuestions = questions.slice(6);
  return (
    <section id="faq" className={styles.section} aria-labelledby="home-faq-title">
      <div className={styles.container}>
        <h2 id="home-faq-title">{copy.title} <span>{copy.accent}</span></h2>
        <FaqQuestionList questions={primaryQuestions} />
        <details className={styles.more}>
          <summary>
            <span className={styles.closedLabel}>{copy.more}</span>
            <span className={styles.openLabel}>{copy.fewer}</span>
            <Plus className={styles.plus} size={18} aria-hidden="true" />
            <Minus className={styles.minus} size={18} aria-hidden="true" />
          </summary>
          <FaqQuestionList questions={otherQuestions} />
        </details>
      </div>
    </section>
  );
}
