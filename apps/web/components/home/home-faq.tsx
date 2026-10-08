import { Minus, Plus } from "lucide-react";
import { homeFAQ } from "@/lib/home-faq";
import { FaqQuestionList } from "@/components/faq-section";
import styles from "./home-faq.module.css";

// Keep the shared answers and JSON-LD intact; only prioritize their presentation.
const primaryIndexes = [0, 2, 6, 7, 8, 10];
const primaryQuestions = primaryIndexes.map((index) => homeFAQ[index]);
const otherQuestions = homeFAQ.filter((_, index) => !primaryIndexes.includes(index));

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
