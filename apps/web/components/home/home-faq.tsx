import { Minus, Plus } from "lucide-react";
import { homeFAQ } from "@/lib/home-faq";
import { FaqQuestionList } from "@/components/faq-section";
import styles from "./home-faq.module.css";

// The shared copy puts the core product questions first, for UI and JSON-LD.
const primaryQuestions = homeFAQ.slice(0, 6);
const otherQuestions = homeFAQ.slice(6);

export function HomeFAQ() {
  return (
    <section id="faq" className={styles.section} aria-labelledby="home-faq-title">
      <div className={styles.container}>
        <h2 id="home-faq-title">Questions? <span>Answers.</span></h2>
        <FaqQuestionList questions={primaryQuestions} />
        <details className={styles.more}>
          <summary>
            <span className={styles.closedLabel}>More questions</span>
            <span className={styles.openLabel}>Fewer questions</span>
            <Plus className={styles.plus} size={18} aria-hidden="true" />
            <Minus className={styles.minus} size={18} aria-hidden="true" />
          </summary>
          <FaqQuestionList questions={otherQuestions} />
        </details>
      </div>
    </section>
  );
}
